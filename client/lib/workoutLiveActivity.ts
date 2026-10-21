import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Lock-screen / Dynamic Island view of the running workout: current exercise,
 * the next set, and the rest countdown — so you don't unlock the phone
 * between sets.
 *
 * The native module only exists in builds made after expo-live-activity was
 * added. Older dev clients and iOS < 16.2 simply get no Live Activity; every
 * call here is a no-op there instead of a crash.
 */

type LiveActivityModule = typeof import("expo-live-activity");

const STORAGE_KEY = "@workout_live_activity_id";

// Chalk & Iron, as hex — the widget can't read the JS theme.
const CONFIG = {
  backgroundColor: "#191B1D",
  titleColor: "#ECE9E1",
  subtitleColor: "#9BA09A",
  progressViewTint: "#ECE9E1",
  progressViewLabelColor: "#ECE9E1",
  timerType: "digital" as const,
  padding: { horizontal: 20, vertical: 16 },
};

let cached: LiveActivityModule | null | undefined;
function nativeModule(): LiveActivityModule | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (Platform.OS !== "ios") return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require("expo") as typeof import("expo");
    if (!requireOptionalNativeModule("ExpoLiveActivity")) return cached;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require("expo-live-activity") as LiveActivityModule;
  } catch {
    cached = null;
  }
  return cached;
}

export interface WorkoutActivityState {
  /** Exercise you're on (or up next while resting). */
  title: string;
  /** e.g. "Satz 2 von 4 · 80 kg × 8" or "Pause · danach Satz 3 von 4". */
  subtitle: string;
  /** Epoch ms the rest ends; null when not resting. */
  restEndsAt: number | null;
  /** 0–1 share of sets done, shown when not resting. */
  progress: number;
}

let currentId: string | null = null;
// Serialise start/update/stop: they're fired from effects and can overlap.
let queue: Promise<void> = Promise.resolve();
function enqueue(job: () => Promise<void>): Promise<void> {
  queue = queue.then(job, job).catch(() => {});
  return queue;
}

function toNative(s: WorkoutActivityState) {
  return {
    title: s.title,
    subtitle: s.subtitle,
    progressBar:
      s.restEndsAt && s.restEndsAt > Date.now()
        ? { date: s.restEndsAt }
        : { progress: Math.max(0, Math.min(1, s.progress)) },
  };
}

export function syncWorkoutActivity(state: WorkoutActivityState): Promise<void> {
  const la = nativeModule();
  if (!la) return Promise.resolve();
  return enqueue(async () => {
    if (!currentId) {
      // An activity left behind by a previous app run (crash, force-quit)
      // would otherwise sit next to the new one until iOS expires it.
      const stale = await AsyncStorage.getItem(STORAGE_KEY);
      if (stale) {
        try {
          la.stopActivity(stale, toNative(state));
        } catch {
          // already gone
        }
      }
      currentId = la.startActivity(toNative(state), CONFIG) ?? null;
      if (currentId) await AsyncStorage.setItem(STORAGE_KEY, currentId);
      else await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    la.updateActivity(currentId, toNative(state));
  });
}

/** Ends the lock-screen activity — finishing or discarding the workout. */
export function endWorkoutActivity(): Promise<void> {
  const la = nativeModule();
  if (!la) return Promise.resolve();
  return enqueue(async () => {
    const id = currentId ?? (await AsyncStorage.getItem(STORAGE_KEY));
    currentId = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    if (!id) return;
    try {
      la.stopActivity(id, { title: "", subtitle: "", progressBar: { progress: 1 } });
    } catch {
      // already gone
    }
  });
}
