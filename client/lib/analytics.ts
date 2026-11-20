import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";

import { getApiUrl } from "@/lib/query-client";
import { isCardioSession, type WorkoutSession } from "@/lib/storage";

/**
 * Anonymous product events for the STRATEGY.md metrics: a random id of its
 * own (never the account or backup id), a fixed list of event names, no plan
 * or exercise content. Sent in batches to our own server; switched off in
 * Profile → "Anonyme Nutzungsstatistik".
 */

export type AnalyticsEvent =
  | "first_open"
  | "first_set_logged"
  | "workout_completed"
  | "import_succeeded"
  | "import_failed"
  | "ai_plan_adjusted"
  | "pro_purchased";

type Props = Record<string, string | number | boolean>;
type Queued = { name: AnalyticsEvent; ts: string; props?: Props };

const ID_KEY = "analytics.anonId";
const OPT_OUT_KEY = "analytics.optOut";
const QUEUE_KEY = "analytics.queue";
const ONCE_PREFIX = "analytics.once.";
const FLUSH_DELAY_MS = 10_000;
const MAX_QUEUE = 200;

let queue: Queued[] | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function anonId(): Promise<string> {
  let id = await AsyncStorage.getItem(ID_KEY);
  if (!id) {
    id = randomId();
    await AsyncStorage.setItem(ID_KEY, id);
  }
  return id;
}

export async function isAnalyticsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(OPT_OUT_KEY)) !== "1";
}

/** Turning it off also drops whatever is still waiting to be sent. */
export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(OPT_OUT_KEY, enabled ? "0" : "1");
  if (!enabled) {
    queue = [];
    await AsyncStorage.removeItem(QUEUE_KEY);
  }
}

async function loadQueue(): Promise<Queued[]> {
  if (queue) return queue;
  try {
    queue = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? "[]");
  } catch {
    queue = [];
  }
  return queue!;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DELAY_MS);
}

export async function flush(): Promise<void> {
  if (flushing || Platform.OS === "web") return;
  const pending = await loadQueue();
  if (pending.length === 0) return;
  flushing = true;
  const batch = pending.slice(0, 50);
  try {
    const res = await fetch(new URL("/api/events", getApiUrl()).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        anonId: await anonId(),
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version ?? null,
        events: batch,
      }),
    });
    if (res.ok || res.status === 400) {
      // 400 = something the server will never accept; don't retry it forever.
      queue = pending.slice(batch.length);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      if (queue.length > 0) scheduleFlush();
    }
  } catch {
    // Offline: keep the queue for the next try.
  } finally {
    flushing = false;
  }
}

export async function track(name: AnalyticsEvent, props?: Props): Promise<void> {
  try {
    if (!(await isAnalyticsEnabled())) return;
    // Dev builds talk to the production API too; their events would skew the
    // real numbers. Log them instead.
    if (__DEV__) {
      console.log("[analytics]", name, props ?? "");
      return;
    }
    const pending = await loadQueue();
    pending.push({ name, ts: new Date().toISOString(), ...(props ? { props } : {}) });
    queue = pending.slice(-MAX_QUEUE);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    scheduleFlush();
  } catch {
    // Analytics must never break the app.
  }
}

/** For "first …" events: recorded once per install. */
export async function trackOnce(name: AnalyticsEvent, props?: Props): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(ONCE_PREFIX + name)) === "1") return;
    await AsyncStorage.setItem(ONCE_PREFIX + name, "1");
    await track(name, props);
  } catch {
    // ignore
  }
}

/** Send what's queued when the app goes to the background. */
export function startAnalytics(): () => void {
  void trackOnce("first_open");
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "background") void flush();
  });
  return () => sub.remove();
}

/** A saved session — counts only, nothing of what was trained. */
export function trackWorkoutCompleted(session: WorkoutSession): void {
  void track("workout_completed", {
    type: isCardioSession(session) ? "cardio" : "strength",
    sets: (session.exerciseProgress ?? []).reduce(
      (n, ep) => n + ep.sets.filter((s) => s.completed).length,
      0,
    ),
    minutes: Math.round((session.duration ?? 0) / 60),
  });
}
