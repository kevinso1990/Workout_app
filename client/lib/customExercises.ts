/**
 * The user's own exercises and how each exercise is measured.
 *
 * Exercises created from the workout's picker used to go only to the server,
 * which never lists custom rows back — so they could not be found again,
 * renamed, or told apart from the separate list the Exercises tab kept.
 * Both now share this one local list.
 *
 * Measure: an exercise is logged as weight × reps or in seconds. The default
 * is guessed from the name ("Plank", "… Hold") and the target ("30-45 s");
 * the user's explicit choice wins, keyed by name, for catalogue exercises
 * too — a hyperextension can be done for reps or held.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { isHoldExercise } from "@/lib/exerciseTaxonomy";
import { isTimedTarget } from "@/lib/planStructure";
import { STORAGE_KEYS, type WorkoutPlan, type WorkoutSession } from "@/lib/storage";

export const CUSTOM_EXERCISES_KEY = "@fitplan_custom_exercises";
const MEASURE_OVERRIDES_KEY = "@exercise_measure_overrides";

export type ExerciseMeasure = "weight" | "time";

export interface CustomExercise {
  id: string;
  name: string;
  nameDe?: string;
  muscleGroup: string;
  equipment: string;
  isCustom?: boolean;
}

export type MeasureOverrides = Record<string, ExerciseMeasure>;

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function isTimedExercise(
  name: string,
  reps: string | null | undefined,
  overrides: MeasureOverrides,
): boolean {
  const chosen = overrides[nameKey(name)];
  if (chosen) return chosen === "time";
  return isHoldExercise(name) || isTimedTarget(reps);
}

export async function loadCustomExercises(): Promise<CustomExercise[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
    return raw ? (JSON.parse(raw) as CustomExercise[]) : [];
  } catch {
    return [];
  }
}

export async function saveCustomExercises(list: CustomExercise[]): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(list));
}

/** Adds an exercise unless one with the same name exists; returns the stored one. */
export async function addCustomExercise(
  exercise: Omit<CustomExercise, "id" | "isCustom">,
): Promise<CustomExercise> {
  const list = await loadCustomExercises();
  const existing = list.find((c) => nameKey(c.name) === nameKey(exercise.name));
  if (existing) return existing;
  const created: CustomExercise = { ...exercise, id: `custom-${Date.now()}`, isCustom: true };
  await saveCustomExercises([...list, created]);
  return created;
}

export async function loadMeasureOverrides(): Promise<MeasureOverrides> {
  try {
    const raw = await AsyncStorage.getItem(MEASURE_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as MeasureOverrides) : {};
  } catch {
    return {};
  }
}

export async function setMeasureOverride(name: string, measure: ExerciseMeasure): Promise<MeasureOverrides> {
  const overrides = { ...(await loadMeasureOverrides()), [nameKey(name)]: measure };
  await AsyncStorage.setItem(MEASURE_OVERRIDES_KEY, JSON.stringify(overrides));
  return overrides;
}

/** Plans with every exercise called `from` renamed to `to`; same array if none was. */
export function renameExerciseInPlans(plans: WorkoutPlan[], from: string, to: string): WorkoutPlan[] {
  let changed = false;
  const next = plans.map((plan) => {
    let planChanged = false;
    const days = plan.days.map((day) => {
      if (!day.exercises.some((e) => nameKey(e.name) === nameKey(from))) return day;
      planChanged = true;
      return {
        ...day,
        exercises: day.exercises.map((e) => (nameKey(e.name) === nameKey(from) ? { ...e, name: to } : e)),
      };
    });
    if (!planChanged) return plan;
    changed = true;
    return { ...plan, days, lastModified: new Date().toISOString() };
  });
  return changed ? next : plans;
}

/** Sessions with the exercise renamed, so its progress stays one line. */
export function renameExerciseInHistory(history: WorkoutSession[], from: string, to: string): WorkoutSession[] {
  let changed = false;
  const next = history.map((session) => {
    if (!session.exercises.some((e) => nameKey(e.name) === nameKey(from))) return session;
    changed = true;
    return {
      ...session,
      exercises: session.exercises.map((e) => (nameKey(e.name) === nameKey(from) ? { ...e, name: to } : e)),
    };
  });
  return changed ? next : history;
}

export type RenameResult = { ok: true } | { ok: false; reason: "empty" | "taken" | "missing" };

/**
 * Renames one of the user's exercises everywhere it is used: the list, its
 * measure choice, every plan and the workout history.
 */
export async function renameCustomExercise(
  id: string,
  newName: string,
  takenNames: (name: string) => boolean,
): Promise<RenameResult> {
  const to = newName.trim();
  if (!to) return { ok: false, reason: "empty" };
  const list = await loadCustomExercises();
  const target = list.find((c) => c.id === id);
  if (!target) return { ok: false, reason: "missing" };
  const from = target.name;
  if (nameKey(from) === nameKey(to)) {
    if (from !== to) await saveCustomExercises(list.map((c) => (c.id === id ? { ...c, name: to } : c)));
    return { ok: true };
  }
  if (list.some((c) => c.id !== id && nameKey(c.name) === nameKey(to)) || takenNames(to)) {
    return { ok: false, reason: "taken" };
  }

  await saveCustomExercises(list.map((c) => (c.id === id ? { ...c, name: to, nameDe: undefined } : c)));

  const overrides = await loadMeasureOverrides();
  if (overrides[nameKey(from)]) {
    const { [nameKey(from)]: measure, ...rest } = overrides;
    await AsyncStorage.setItem(MEASURE_OVERRIDES_KEY, JSON.stringify({ ...rest, [nameKey(to)]: measure }));
  }

  const plansRaw = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_PLANS);
  if (plansRaw) {
    const plans = JSON.parse(plansRaw) as WorkoutPlan[];
    const renamed = renameExerciseInPlans(plans, from, to);
    if (renamed !== plans) await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_PLANS, JSON.stringify(renamed));
  }
  const historyRaw = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_HISTORY);
  if (historyRaw) {
    const history = JSON.parse(historyRaw) as WorkoutSession[];
    const renamed = renameExerciseInHistory(history, from, to);
    if (renamed !== history) await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_HISTORY, JSON.stringify(renamed));
  }
  return { ok: true };
}
