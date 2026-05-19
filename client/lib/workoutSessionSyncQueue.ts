import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";

import { getApiUrl } from "@/lib/query-client";
import type { CompletedSessionSyncPayload } from "@/lib/activeWorkoutPersistence";

const QUEUE_KEY = "@workout_session_sync_queue";
const TOKEN_KEY = "workoutapp_auth_token";
const DEVICE_ID_KEY = "device_id";
const SYNC_TIMEOUT_MS = 20_000;

type QueuedWorkoutSession = {
  id: string;
  session: CompletedSessionSyncPayload;
  enqueuedAt: number;
  attempts: number;
};

let flushInFlight: Promise<void> | null = null;
let appStateSubscribed = false;

async function readQueue(): Promise<QueuedWorkoutSession[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedWorkoutSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedWorkoutSession[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-device-id": await getDeviceId(),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * POST completed session to backend. Never throws — returns false on failure.
 */
export async function trySyncWorkoutSessionToServer(
  session: CompletedSessionSyncPayload,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    const url = new URL("/api/sessions/sync-local", getApiUrl()).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ session }),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Queue then attempt immediate sync; failures stay queued for background flush. */
export async function enqueueAndTrySyncWorkoutSession(
  session: CompletedSessionSyncPayload,
): Promise<void> {
  const queue = await readQueue();
  const existing = queue.findIndex((q) => q.id === session.id);
  const entry: QueuedWorkoutSession = {
    id: session.id,
    session,
    enqueuedAt: Date.now(),
    attempts: existing >= 0 ? queue[existing].attempts : 0,
  };
  if (existing >= 0) queue[existing] = entry;
  else queue.push(entry);
  await writeQueue(queue);

  const ok = await trySyncWorkoutSessionToServer(session);
  if (ok) {
    await writeQueue(queue.filter((q) => q.id !== session.id));
  }
}

/**
 * Replay queued sessions in order. Stops at first failure. Never rejects.
 */
export async function flushWorkoutSyncQueue(): Promise<void> {
  if (flushInFlight) {
    await flushInFlight.catch(() => {});
    return;
  }

  flushInFlight = (async () => {
    let queue = await readQueue();
    while (queue.length > 0) {
      const item = queue[0];
      const ok = await trySyncWorkoutSessionToServer(item.session);
      if (!ok) {
        queue[0] = { ...item, attempts: item.attempts + 1 };
        await writeQueue(queue);
        break;
      }
      queue = queue.slice(1);
      await writeQueue(queue);
    }
  })();

  try {
    await flushInFlight;
  } catch {
    // non-fatal
  } finally {
    flushInFlight = null;
  }
}

export function registerWorkoutSyncAppStateListener(): () => void {
  if (appStateSubscribed) return () => {};
  appStateSubscribed = true;

  const onChange = (state: AppStateStatus) => {
    if (state === "active") {
      void flushWorkoutSyncQueue();
    }
  };

  const sub = AppState.addEventListener("change", onChange);
  void flushWorkoutSyncQueue();

  return () => {
    sub.remove();
    appStateSubscribed = false;
  };
}
