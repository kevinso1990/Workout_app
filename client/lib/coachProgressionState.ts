import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  didUserOverrideSuggestion,
  type LoggedSetSnapshot,
} from "@shared/coachProgression";
import type { ExerciseProgress, WorkoutSession } from "@/lib/storage";

const STORAGE_KEY = "coach_progression_state_v1";

export interface ExerciseCoachState {
  /** Sessions left where weight increases are suppressed. */
  conservativeCyclesRemaining: number;
  /** Consecutive sessions with downward override vs suggestion. */
  overrideStreak: number;
}

export interface ExerciseCoachSessionMeta {
  suggestedWeightKg: number;
  maxLoggedWeightKg: number;
  userOverrodeSuggestion: boolean;
  hadEasySet: boolean;
}

const DEFAULT_EXERCISE_STATE: ExerciseCoachState = {
  conservativeCyclesRemaining: 0,
  overrideStreak: 0,
};

function exerciseKey(name: string): string {
  return name.trim().toLowerCase();
}

type CoachProgressionStore = {
  byExercise: Record<string, ExerciseCoachState>;
};

async function readStore(): Promise<CoachProgressionStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { byExercise: {} };
    const parsed = JSON.parse(raw) as CoachProgressionStore;
    return parsed?.byExercise ? parsed : { byExercise: {} };
  } catch {
    return { byExercise: {} };
  }
}

async function writeStore(store: CoachProgressionStore): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export async function getExerciseCoachState(
  exerciseName: string,
): Promise<ExerciseCoachState> {
  const store = await readStore();
  return store.byExercise[exerciseKey(exerciseName)] ?? { ...DEFAULT_EXERCISE_STATE };
}

export async function getCoachStatesForExercises(
  exerciseNames: string[],
): Promise<Record<string, ExerciseCoachState>> {
  const store = await readStore();
  const out: Record<string, ExerciseCoachState> = {};
  for (const name of exerciseNames) {
    const key = exerciseKey(name);
    out[key] = store.byExercise[key] ?? { ...DEFAULT_EXERCISE_STATE };
  }
  return out;
}

/** Clears conservative mode when the user marks a set as Easy. */
export async function clearConservativeModeForExercise(
  exerciseName: string,
): Promise<void> {
  const store = await readStore();
  const key = exerciseKey(exerciseName);
  store.byExercise[key] = {
    conservativeCyclesRemaining: 0,
    overrideStreak: 0,
  };
  await writeStore(store);
}

export function maxLoggedWeightFromSets(sets: LoggedSetSnapshot[]): number {
  let max = 0;
  for (const s of sets) {
    if (s.completed === false) continue;
    const w = parseFloat(String(s.weight).replace(",", "."));
    if (Number.isFinite(w) && w > max) max = w;
  }
  return max;
}

export function sessionHadEasySet(sets: LoggedSetSnapshot[]): boolean {
  return sets.some((s) => s.completed !== false && s.rating === "green");
}

/**
 * After a workout is saved, update per-exercise coach memory (override streak + conservative cycles).
 */
export async function recordSessionCoachOutcomes(
  dayExercises: { id: string; name: string }[],
  exerciseProgress: ExerciseProgress[],
  suggestionsByExerciseId: Record<string, number>,
): Promise<void> {
  const store = await readStore();

  for (const ex of dayExercises) {
    const ep = exerciseProgress.find((p) => p.exerciseId === ex.id);
    if (!ep) continue;

    const meta = ep.coachMeta;
    const suggested =
      meta?.suggestedWeightKg ?? suggestionsByExerciseId[ex.id] ?? 0;
    const maxLogged =
      meta?.maxLoggedWeightKg ?? maxLoggedWeightFromSets(ep.sets);
    const hadEasy = meta?.hadEasySet ?? sessionHadEasySet(ep.sets);
    const overrode =
      meta?.userOverrodeSuggestion ??
      didUserOverrideSuggestion(suggested, maxLogged);

    const key = exerciseKey(ex.name);
    const prev = store.byExercise[key] ?? { ...DEFAULT_EXERCISE_STATE };

    if (hadEasy) {
      store.byExercise[key] = {
        conservativeCyclesRemaining: 0,
        overrideStreak: 0,
      };
      continue;
    }

    let conservativeCyclesRemaining = prev.conservativeCyclesRemaining;
    let overrideStreak = prev.overrideStreak;

    if (overrode) {
      overrideStreak += 1;
      if (overrideStreak >= 2) {
        conservativeCyclesRemaining = Math.max(conservativeCyclesRemaining, 2);
        overrideStreak = 0;
      }
    } else {
      overrideStreak = 0;
    }

    if (conservativeCyclesRemaining > 0) {
      conservativeCyclesRemaining -= 1;
    }

    store.byExercise[key] = {
      conservativeCyclesRemaining: Math.max(0, conservativeCyclesRemaining),
      overrideStreak,
    };
  }

  await writeStore(store);
}

/** Build coach meta to persist on each exercise for historic override inspection. */
export function buildExerciseCoachMeta(
  sets: LoggedSetSnapshot[],
  suggestedWeightKg: number,
): ExerciseCoachSessionMeta {
  const maxLoggedWeightKg = maxLoggedWeightFromSets(sets);
  return {
    suggestedWeightKg,
    maxLoggedWeightKg,
    hadEasySet: sessionHadEasySet(sets),
    userOverrodeSuggestion: didUserOverrideSuggestion(
      suggestedWeightKg,
      maxLoggedWeightKg,
    ),
  };
}

/** Last saved session for same plan day (for streak inference when meta missing). */
export function findPreviousSessionForDay(
  history: WorkoutSession[],
  planId: string,
  dayName: string,
  excludeSessionId?: string,
): WorkoutSession | undefined {
  return [...history]
    .filter(
      (s) =>
        s.planId === planId &&
        s.dayName === dayName &&
        s.id !== excludeSessionId,
    )
    .sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    )[0];
}
