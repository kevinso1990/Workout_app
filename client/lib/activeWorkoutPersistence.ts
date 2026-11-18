import AsyncStorage from "@react-native-async-storage/async-storage";

import { endWorkoutActivity } from "@/lib/workoutLiveActivity";

import type { ExerciseProgress, WorkoutPlan, WorkoutSession } from "@/lib/storage";
import type { ExerciseCoachState } from "@/lib/coachProgressionState";

/** Strict key for in-progress workout crash recovery. */
export const ACTIVE_WORKOUT_STORAGE_KEY = "@active_workout_session";

const DRAFT_VERSION = 1 as const;

export interface ActiveWorkoutDraft {
  version: typeof DRAFT_VERSION;
  savedAt: string;
  route: {
    planId: string;
    planName: string;
    dayIndex: number;
  };
  plan: WorkoutPlan;
  progress: ExerciseProgress[];
  lastWeekProgress: ExerciseProgress[];
  currentExerciseIndex: number;
  currentSetIndex: number;
  workoutStartedAt: number;
  showRestTimer: boolean;
  restTimeLeft: number;
  restTimerEndAt: number | null;
  prsThisSession: Array<{ exerciseName: string; weight: number; reps: number }>;
  coachStateByExercise: Record<string, ExerciseCoachState>;
  sessionSuggestionsByExerciseId: Record<string, number>;
  restTimerEnabled: boolean;
}

const draftListeners = new Set<(draft: ActiveWorkoutDraft | null) => void>();

/**
 * Called after the draft is saved (with it) or cleared (with null). Screens
 * that only read the draft on focus — the Today card, the timer bar over the
 * tabs — would otherwise show a stale state until the next focus.
 */
export function onActiveWorkoutDraftChange(
  listener: (draft: ActiveWorkoutDraft | null) => void,
): () => void {
  draftListeners.add(listener);
  return () => {
    draftListeners.delete(listener);
  };
}

export async function saveActiveWorkoutDraft(
  draft: ActiveWorkoutDraft,
): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_WORKOUT_STORAGE_KEY, JSON.stringify(draft));
  draftListeners.forEach((listener) => listener(draft));
}

export async function loadActiveWorkoutDraft(): Promise<ActiveWorkoutDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_WORKOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveWorkoutDraft;
    if (parsed?.version !== DRAFT_VERSION) return null;
    if (!parsed.route?.planId || !parsed.plan?.days?.length) return null;
    if (!Array.isArray(parsed.progress) || parsed.progress.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearActiveWorkoutDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
  } catch {
    // non-fatal
  }
  // Every way a workout ends (finished, discarded, replaced) goes through
  // here, so this is where the lock-screen activity goes away too.
  void endWorkoutActivity();
  draftListeners.forEach((listener) => listener(null));
}

export async function hasActiveWorkoutDraft(): Promise<boolean> {
  const draft = await loadActiveWorkoutDraft();
  return draft != null;
}

/** Completed session payload queued for server sync (local history is already saved). */
export type CompletedSessionSyncPayload = WorkoutSession;

/**
 * A draft older than this is no longer "the workout running now": its clock
 * restarts when resumed, and it doesn't hide today's plan.
 */
export const STALE_DRAFT_MS = 6 * 60 * 60 * 1000;

export function isLiveDraft(draft: { workoutStartedAt: number }, now = Date.now()): boolean {
  return now - draft.workoutStartedAt <= STALE_DRAFT_MS;
}
