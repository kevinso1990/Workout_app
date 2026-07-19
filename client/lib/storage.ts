import AsyncStorage from "@react-native-async-storage/async-storage";
import { computeAdaptiveProgression } from "@shared/coachProgression";

const STORAGE_KEYS = {
  /** Legal disclaimer accepted (v1 — bump key if disclaimer text materially changes). */
  DISCLAIMER_ACCEPTED_V1: "disclaimer_accepted_v1",
  ONBOARDING_COMPLETE: "onboarding_complete",
  USER_PREFERENCES: "user_preferences",
  WORKOUT_PLANS: "workout_plans",
  WORKOUT_HISTORY: "workout_history",
  BODY_MEASUREMENTS: "body_measurements",
  PROGRESS_PHOTOS: "progress_photos",
};

export type FitnessLevel = "beginner" | "intermediate" | "advanced";
export type FitnessGoal = "build_muscle" | "lose_fat" | "get_stronger";
export type Equipment = "full_gym" | "dumbbells_only" | "home_minimal" | "bodyweight" | "kettlebell";
export type MuscleGroupType = "chest" | "back" | "shoulders" | "arms" | "legs" | "core";

export interface UserPreferences {
  workoutDaysPerWeek: number;
  splitPreference: "choose" | "recommended";
  exercisePreference: "choose" | "default";
  cardioDays?: string[];
  fitnessLevel?: FitnessLevel | null;
  fitnessGoals?: FitnessGoal[];
  equipment?: Equipment | null;
  focusMuscles?: MuscleGroupType[];
  /** Whether to show an automatic rest countdown after each set. Default true. */
  restTimerEnabled?: boolean;
}

const DEFAULT_USER_PREFERENCES: UserPreferences = {
  workoutDaysPerWeek: 3,
  splitPreference: "recommended",
  exercisePreference: "default",
};

/** Merged prefs when toggling rest timer — shared by Profile and ActiveWorkout (no duplicated defaults). */
export function mergeRestTimerPreference(
  prefs: UserPreferences | null,
  restTimerEnabled: boolean,
): UserPreferences {
  return { ...DEFAULT_USER_PREFERENCES, ...prefs, restTimerEnabled };
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  /** Catalog / import equipment slug (e.g. `bodyweight`, `barbell`). */
  equipment?: string | null;
  /** e.g. `calisthenics` — used for bodyweight-only set logging. */
  mechanics?: string | null;
  targetRIR?: number;
  /** Optional kg hint from KI-Import / Plan-Builder; used as initial slider values when no last-session data. */
  targetWeight?: number;
  /** Optional rep target (single number); complements `reps` (may be a range string). */
  targetReps?: number;
}

export interface WorkoutDay {
  dayName: string;
  exercises: Exercise[];
}

export type WorkoutType = "strength" | "cardio";

export type CardioSportType =
  | "running"
  | "football"
  | "tennis"
  | "cycling"
  | "swimming"
  | "boxing"
  | "custom";

export interface CardioSessionMeta {
  sport: CardioSportType;
  /** Display label when sport === custom */
  sportLabel?: string;
  durationMinutes: number;
  distanceKm?: number | null;
  rpe: number;
  notes?: string | null;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  daysPerWeek: number;
  days: WorkoutDay[];
  createdAt: string;
  lastModified: string;
}

export type SetType = "working" | "warmup" | "failure" | "dropset";

export interface SetData {
  weight: string;
  reps: string;
  rating: "green" | "yellow" | "red" | null;
  completed: boolean;
  notes?: string;
  setType?: SetType;
}

/**
 * Compound lifts get larger weight jumps because they recruit more muscle mass
 * and adapt faster than isolation or cable movements.
 * Shared with ProgressScreen (1RM tracking) and ActiveWorkoutScreen (progression UI).
 */
export const COMPOUND_LIFTS = [
  "Barbell Back Squat",
  "Barbell Deadlift",
  "Barbell Bench Press",
  "Barbell Bent-Over Row",
  "Barbell Overhead Press",
  "Machine Leg Press",
];

export interface WeightRecommendation {
  recommendedWeight: number;
  recommendedReps?: number;
  reason: string;
  confidence: "increase" | "hold" | "decrease";
  /** i18n key suffix under activeWorkout.coach.progression.* */
  contextKey?: string;
  contextParams?: Record<string, string | number>;
  suggestedWeightKg?: number;
  previousWorkingWeightKg?: number;
}

/**
 * @deprecated Prefer `computeAdaptiveProgression` from `@shared/coachProgression`.
 * Thin wrapper for callers that do not pass coach state.
 */
export function calculateProgressionWeight(
  lastSets: Array<{ weight: string; reps: string; rating?: SetType | "green" | "yellow" | "red" | null; completed?: boolean }>,
  targetReps: string,
  exerciseName: string,
  conservativeCyclesRemaining = 0,
): WeightRecommendation | null {
  const result = computeAdaptiveProgression({
    exerciseName,
    targetRepsLabel: targetReps,
    plannedSetCount: lastSets.length,
    lastSets: lastSets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      completed: s.completed,
      rating:
        s.rating === "green" || s.rating === "yellow" || s.rating === "red"
          ? s.rating
          : null,
    })),
    conservativeCyclesRemaining,
  });
  if (!result) return null;
  return {
    recommendedWeight: result.recommendedWeight,
    recommendedReps: result.recommendedReps,
    reason: result.reason,
    confidence: result.confidence,
    contextKey: result.contextKey,
    contextParams: result.contextParams,
    suggestedWeightKg: result.suggestedWeightKg,
    previousWorkingWeightKg: result.previousWorkingWeightKg,
  };
}

export interface ExerciseCoachMeta {
  suggestedWeightKg: number;
  maxLoggedWeightKg: number;
  userOverrodeSuggestion: boolean;
  hadEasySet: boolean;
}

export interface ExerciseProgress {
  exerciseId: string;
  sets: SetData[];
  coachMeta?: ExerciseCoachMeta;
}

export interface WorkoutSession {
  id: string;
  planId: string;
  planName: string;
  dayName: string;
  completedAt: string;
  exercises: Exercise[];
  exerciseProgress?: ExerciseProgress[];
  duration?: number;
  /** Defaults to strength for legacy sessions. */
  workoutType?: WorkoutType;
  cardio?: CardioSessionMeta;
}

export function isCardioSession(session: WorkoutSession): boolean {
  return session.workoutType === "cardio" || !!session.cardio;
}

export function isStrengthSession(session: WorkoutSession): boolean {
  return !isCardioSession(session);
}

export function sessionDisplayTitle(session: WorkoutSession): string {
  if (isCardioSession(session)) {
    const sport = session.cardio?.sport;
    if (sport === "custom" && session.cardio?.sportLabel) {
      return session.cardio.sportLabel;
    }
    return session.planName || session.dayName || "Cardio";
  }
  return session.planName || session.dayName || "Strength";
}

export async function getDisclaimerAccepted(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.DISCLAIMER_ACCEPTED_V1);
    return value === "true";
  } catch {
    return false;
  }
}

export async function setDisclaimerAccepted(accepted: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.DISCLAIMER_ACCEPTED_V1, accepted.toString());
}

export async function getOnboardingComplete(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
    return value === "true";
  } catch {
    return false;
  }
}

export async function setOnboardingComplete(complete: boolean): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.ONBOARDING_COMPLETE,
    complete.toString()
  );
}

export async function getUserPreferences(): Promise<UserPreferences | null> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function setUserPreferences(
  preferences: UserPreferences
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.USER_PREFERENCES,
    JSON.stringify(preferences)
  );
}

export async function getWorkoutPlans(): Promise<WorkoutPlan[]> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_PLANS);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

export async function saveWorkoutPlan(plan: WorkoutPlan): Promise<void> {
  const plans = await getWorkoutPlans();
  const existingIndex = plans.findIndex((p) => p.id === plan.id);
  if (existingIndex >= 0) {
    plans[existingIndex] = plan;
  } else {
    plans.push(plan);
  }
  await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_PLANS, JSON.stringify(plans));
}

export async function deleteWorkoutPlan(planId: string): Promise<void> {
  const plans = await getWorkoutPlans();
  const filteredPlans = plans.filter((p) => p.id !== planId);
  await AsyncStorage.setItem(
    STORAGE_KEYS.WORKOUT_PLANS,
    JSON.stringify(filteredPlans)
  );
}

export async function duplicateWorkoutPlan(planId: string): Promise<WorkoutPlan | null> {
  const plans = await getWorkoutPlans();
  const planToDuplicate = plans.find((p) => p.id === planId);
  if (!planToDuplicate) return null;

  const newPlan: WorkoutPlan = {
    ...planToDuplicate,
    id: Date.now().toString(),
    name: `${planToDuplicate.name} (Copy)`,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    days: planToDuplicate.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({ ...ex, id: `${ex.id}-${Date.now()}` })),
    })),
  };

  plans.push(newPlan);
  await AsyncStorage.setItem(STORAGE_KEYS.WORKOUT_PLANS, JSON.stringify(plans));
  return newPlan;
}

export async function getWorkoutHistory(): Promise<WorkoutSession[]> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUT_HISTORY);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

export async function addWorkoutSession(
  session: WorkoutSession
): Promise<void> {
  const history = await getWorkoutHistory();
  history.unshift(session);
  await AsyncStorage.setItem(
    STORAGE_KEYS.WORKOUT_HISTORY,
    JSON.stringify(history)
  );
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
}

/** Overwrites the full workout history (used by cloud restore). */
export async function replaceWorkoutHistory(
  history: WorkoutSession[],
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.WORKOUT_HISTORY,
    JSON.stringify(Array.isArray(history) ? history : []),
  );
}

/** Overwrites the full set of workout plans (used by cloud restore). */
export async function replaceWorkoutPlans(
  plans: WorkoutPlan[],
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.WORKOUT_PLANS,
    JSON.stringify(Array.isArray(plans) ? plans : []),
  );
}

export const DEFAULT_EXERCISES: Record<string, Exercise[]> = {
  Push: [
    {
      id: "bench-press",
      name: "Barbell Bench Press",
      muscleGroup: "Chest",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "overhead-press",
      name: "Barbell Overhead Press",
      muscleGroup: "Shoulders",
      sets: 3,
      reps: "8-10",
    },
    {
      id: "incline-dumbbell-press",
      name: "Incline Dumbbell Press",
      muscleGroup: "Chest",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "lateral-raises",
      name: "Dumbbell Lateral Raises",
      muscleGroup: "Shoulders",
      sets: 3,
      reps: "12-15",
    },
    {
      id: "tricep-pushdowns",
      name: "Cable Tricep Pushdown",
      muscleGroup: "Triceps",
      sets: 3,
      reps: "10-12",
    },
  ],
  Pull: [
    {
      id: "deadlift",
      name: "Barbell Deadlift",
      muscleGroup: "Back",
      sets: 4,
      reps: "5-6",
    },
    {
      id: "barbell-rows",
      name: "Barbell Bent-Over Row",
      muscleGroup: "Back",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "lat-pulldowns",
      name: "Wide-Grip Lat Pulldown",
      muscleGroup: "Back",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "face-pulls",
      name: "Cable Face Pulls",
      muscleGroup: "Rear Delts",
      sets: 3,
      reps: "12-15",
    },
    {
      id: "bicep-curls",
      name: "Bicep Curls",
      muscleGroup: "Biceps",
      sets: 3,
      reps: "10-12",
    },
  ],
  Legs: [
    {
      id: "squats",
      name: "Barbell Back Squat",
      muscleGroup: "Quads",
      sets: 4,
      reps: "6-8",
    },
    {
      id: "romanian-deadlift",
      name: "Romanian Deadlift",
      muscleGroup: "Hamstrings",
      sets: 3,
      reps: "8-10",
    },
    {
      id: "leg-press",
      name: "Machine Leg Press",
      muscleGroup: "Quads",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "leg-curls",
      name: "Lying Leg Curl",
      muscleGroup: "Hamstrings",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "calf-raises",
      name: "Standing Calf Raises",
      muscleGroup: "Calves",
      sets: 4,
      reps: "12-15",
    },
  ],
  Upper: [
    {
      id: "bench-press",
      name: "Barbell Bench Press",
      muscleGroup: "Chest",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "lat-pulldowns",
      name: "Wide-Grip Lat Pulldown",
      muscleGroup: "Back",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "db-shoulder-press",
      name: "Dumbbell Shoulder Press",
      muscleGroup: "Shoulders",
      sets: 3,
      reps: "8-10",
    },
    {
      id: "seated-cable-rows",
      name: "Seated Cable Rows",
      muscleGroup: "Back",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "lateral-raises",
      name: "Dumbbell Lateral Raises",
      muscleGroup: "Shoulders",
      sets: 3,
      reps: "12-15",
    },
  ],
  Lower: [
    {
      id: "squats",
      name: "Barbell Back Squat",
      muscleGroup: "Quads",
      sets: 4,
      reps: "6-8",
    },
    {
      id: "romanian-deadlift",
      name: "Romanian Deadlift",
      muscleGroup: "Hamstrings",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "leg-press",
      name: "Machine Leg Press",
      muscleGroup: "Quads",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "leg-curls",
      name: "Lying Leg Curl",
      muscleGroup: "Hamstrings",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "calf-raises",
      name: "Standing Calf Raises",
      muscleGroup: "Calves",
      sets: 4,
      reps: "12-15",
    },
  ],
  // ── Full Body variants ────────────────────────────────────────────────────
  // Single-day fallback (used when only 1 Full Body day exists in the plan).
  // Contains 6 exercises: quad compound · hinge · chest push ·
  //   horizontal row · vertical pull · shoulder press.
  "Full Body": [
    { id: "fb-squat",    name: "Barbell Back Squat",       muscleGroup: "Quads",      sets: 4, reps: "5-6"   },
    { id: "fb-rdl",      name: "Romanian Deadlift",         muscleGroup: "Hamstrings", sets: 3, reps: "8-10"  },
    { id: "fb-bench",    name: "Barbell Bench Press",       muscleGroup: "Chest",      sets: 3, reps: "8-10"  },
    { id: "fb-bbrow",    name: "Barbell Bent-Over Row",     muscleGroup: "Back",       sets: 3, reps: "8-10"  },
    { id: "fb-pulldown", name: "Wide-Grip Lat Pulldown",    muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "fb-dbpress",  name: "Dumbbell Shoulder Press",   muscleGroup: "Shoulders",  sets: 3, reps: "10-12" },
  ],
  // Variant A — barbell-centric strength focus
  "Full Body A": [
    { id: "fba-squat",    name: "Barbell Back Squat",       muscleGroup: "Quads",      sets: 4, reps: "5-6"   },
    { id: "fba-rdl",      name: "Romanian Deadlift",         muscleGroup: "Hamstrings", sets: 3, reps: "8-10"  },
    { id: "fba-bench",    name: "Barbell Bench Press",       muscleGroup: "Chest",      sets: 3, reps: "8-10"  },
    { id: "fba-bbrow",    name: "Barbell Bent-Over Row",     muscleGroup: "Back",       sets: 3, reps: "8-10"  },
    { id: "fba-pulldown", name: "Wide-Grip Lat Pulldown",    muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "fba-dbpress",  name: "Dumbbell Shoulder Press",   muscleGroup: "Shoulders",  sets: 3, reps: "10-12" },
  ],
  // Variant B — machine/dumbbell hypertrophy focus
  "Full Body B": [
    { id: "fbb-legpress",  name: "Machine Leg Press",         muscleGroup: "Quads",      sets: 4, reps: "10-12" },
    { id: "fbb-hipthrust", name: "Hip Thrust",                muscleGroup: "Glutes",     sets: 3, reps: "10-12" },
    { id: "fbb-inclinedb", name: "Incline Dumbbell Press",    muscleGroup: "Chest",      sets: 3, reps: "8-10"  },
    { id: "fbb-cablerow",  name: "Seated Cable Row",          muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "fbb-pullups",   name: "Pull-Ups",                  muscleGroup: "Back",       sets: 3, reps: "8-10"  },
    { id: "fbb-latraises", name: "Dumbbell Lateral Raises",   muscleGroup: "Shoulders",  sets: 3, reps: "12-15" },
  ],
  // Variant C — mixed compounds for full-spectrum stimulus
  "Full Body C": [
    { id: "fbc-frontsq",  name: "Front Squat",               muscleGroup: "Quads",      sets: 4, reps: "5-6"   },
    { id: "fbc-bss",      name: "Bulgarian Split Squat",      muscleGroup: "Quads",      sets: 3, reps: "10-12" },
    { id: "fbc-dbench",   name: "Dumbbell Bench Press",       muscleGroup: "Chest",      sets: 3, reps: "8-10"  },
    { id: "fbc-tbarrow",  name: "T-Bar Row",                  muscleGroup: "Back",       sets: 3, reps: "8-10"  },
    { id: "fbc-chinups",  name: "Chin-Ups",                   muscleGroup: "Back",       sets: 3, reps: "8-10"  },
    { id: "fbc-arnold",   name: "Arnold Press",               muscleGroup: "Shoulders",  sets: 3, reps: "10-12" },
  ],
  Chest: [
    {
      id: "bench-press",
      name: "Barbell Bench Press",
      muscleGroup: "Chest",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "incline-dumbbell-press",
      name: "Incline Dumbbell Press",
      muscleGroup: "Chest",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "cable-flyes",
      name: "Cable Flyes",
      muscleGroup: "Chest",
      sets: 3,
      reps: "12-15",
    },
    {
      id: "dips",
      name: "Dips",
      muscleGroup: "Chest",
      sets: 3,
      reps: "8-12",
    },
  ],
  Back: [
    {
      id: "deadlift",
      name: "Barbell Deadlift",
      muscleGroup: "Back",
      sets: 4,
      reps: "5-6",
    },
    {
      id: "barbell-rows",
      name: "Barbell Bent-Over Row",
      muscleGroup: "Back",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "lat-pulldowns",
      name: "Wide-Grip Lat Pulldown",
      muscleGroup: "Back",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "seated-cable-rows",
      name: "Seated Cable Rows",
      muscleGroup: "Back",
      sets: 3,
      reps: "10-12",
    },
  ],
  Shoulders: [
    {
      id: "overhead-press",
      name: "Barbell Overhead Press",
      muscleGroup: "Shoulders",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "lateral-raises",
      name: "Dumbbell Lateral Raises",
      muscleGroup: "Shoulders",
      sets: 4,
      reps: "12-15",
    },
    {
      id: "face-pulls",
      name: "Cable Face Pulls",
      muscleGroup: "Rear Delts",
      sets: 3,
      reps: "12-15",
    },
    {
      id: "front-raises",
      name: "Dumbbell Front Raises",
      muscleGroup: "Shoulders",
      sets: 3,
      reps: "12-15",
    },
  ],
  Arms: [
    {
      id: "bicep-curls",
      name: "Bicep Curls",
      muscleGroup: "Biceps",
      sets: 4,
      reps: "10-12",
    },
    {
      id: "tricep-pushdowns",
      name: "Cable Tricep Pushdown",
      muscleGroup: "Triceps",
      sets: 4,
      reps: "10-12",
    },
    {
      id: "hammer-curls",
      name: "Hammer Curls",
      muscleGroup: "Biceps",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "skull-crushers",
      name: "Skull Crushers",
      muscleGroup: "Triceps",
      sets: 3,
      reps: "10-12",
    },
  ],
};

// ── Equipment-aware exercise pools ───────────────────────────────────────────
// Each key is an equipment type from the onboarding screen.
// Each value maps split-day names to a list of exercises using only that
// equipment (plus bodyweight which is always allowed as a fallback).
// The SplitSelectionScreen reads from here so the generated plan is
// guaranteed to respect the user's selection — no LLM prompt needed.
//
// BEGINNER_GYM_EXERCISES — Full Gym access but zero barbell experience.
// Rule: machines first, dumbbells second, barbells never.
// Beginners need guided range-of-motion to learn movement patterns safely
// before progressing to free barbell work (typically after 3-6 months).
const BEGINNER_GYM_EXERCISES: Record<string, Exercise[]> = {
  Push: [
    { id: "beg-machine-chest",   name: "Machine Chest Press",       muscleGroup: "Chest",     sets: 3, reps: "10-12" },
    { id: "beg-incline-db",      name: "Incline Dumbbell Press",    muscleGroup: "Chest",     sets: 3, reps: "10-12" },
    { id: "beg-db-shoulder",     name: "Dumbbell Shoulder Press",   muscleGroup: "Shoulders", sets: 3, reps: "10-12" },
    { id: "beg-lat-raises",      name: "Dumbbell Lateral Raises",   muscleGroup: "Shoulders", sets: 3, reps: "12-15" },
    { id: "beg-cable-pushdown",  name: "Cable Tricep Pushdown",     muscleGroup: "Triceps",   sets: 3, reps: "12-15" },
  ],
  Pull: [
    { id: "beg-lat-pulldown",    name: "Wide-Grip Lat Pulldown",    muscleGroup: "Back",      sets: 3, reps: "10-12" },
    { id: "beg-seated-row",      name: "Seated Cable Row",          muscleGroup: "Back",      sets: 3, reps: "10-12" },
    { id: "beg-machine-row",     name: "Machine Row",               muscleGroup: "Back",      sets: 3, reps: "10-12" },
    { id: "beg-face-pull",       name: "Cable Face Pulls",          muscleGroup: "Rear Delts",sets: 3, reps: "12-15" },
    { id: "beg-db-curl",         name: "Dumbbell Bicep Curl",       muscleGroup: "Biceps",    sets: 3, reps: "12-15" },
  ],
  Legs: [
    { id: "beg-leg-press",       name: "Machine Leg Press",         muscleGroup: "Quads",     sets: 4, reps: "10-12" },
    { id: "beg-leg-curl",        name: "Lying Leg Curl",            muscleGroup: "Hamstrings",sets: 3, reps: "10-12" },
    { id: "beg-leg-ext",         name: "Leg Extension",             muscleGroup: "Quads",     sets: 3, reps: "12-15" },
    { id: "beg-glute-bridge",    name: "Glute Bridge",              muscleGroup: "Glutes",    sets: 3, reps: "12-15" },
    { id: "beg-calf-raises",     name: "Standing Calf Raises",      muscleGroup: "Calves",    sets: 4, reps: "15-20" },
  ],
  Upper: [
    { id: "beg-machine-chest",   name: "Machine Chest Press",       muscleGroup: "Chest",     sets: 3, reps: "10-12" },
    { id: "beg-lat-pulldown",    name: "Wide-Grip Lat Pulldown",    muscleGroup: "Back",      sets: 3, reps: "10-12" },
    { id: "beg-db-shoulder",     name: "Dumbbell Shoulder Press",   muscleGroup: "Shoulders", sets: 3, reps: "10-12" },
    { id: "beg-seated-row",      name: "Seated Cable Row",          muscleGroup: "Back",      sets: 3, reps: "10-12" },
    { id: "beg-db-curl",         name: "Dumbbell Bicep Curl",       muscleGroup: "Biceps",    sets: 3, reps: "12-15" },
  ],
  Lower: [
    { id: "beg-leg-press",       name: "Machine Leg Press",         muscleGroup: "Quads",     sets: 3, reps: "10-12" },
    { id: "beg-leg-curl",        name: "Lying Leg Curl",            muscleGroup: "Hamstrings",sets: 3, reps: "10-12" },
    { id: "beg-goblet-squat",    name: "Goblet Squat",              muscleGroup: "Quads",     sets: 3, reps: "10-12" },
    { id: "beg-glute-bridge",    name: "Glute Bridge",              muscleGroup: "Glutes",    sets: 3, reps: "12-15" },
    { id: "beg-calf-raises",     name: "Standing Calf Raises",      muscleGroup: "Calves",    sets: 3, reps: "15-20" },
  ],
  // ── Full Body variants (beginner) ────────────────────────────────────────
  "Full Body": [
    { id: "beg-fb-legpress",  name: "Machine Leg Press",         muscleGroup: "Quads",      sets: 3, reps: "10-12" },
    { id: "beg-fb-legcurl",   name: "Lying Leg Curl",            muscleGroup: "Hamstrings", sets: 3, reps: "10-12" },
    { id: "beg-fb-chest",     name: "Machine Chest Press",       muscleGroup: "Chest",      sets: 3, reps: "10-12" },
    { id: "beg-fb-cablerow",  name: "Seated Cable Row",          muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "beg-fb-pulldown",  name: "Wide-Grip Lat Pulldown",    muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "beg-fb-dbshoulder",name: "Dumbbell Shoulder Press",   muscleGroup: "Shoulders",  sets: 3, reps: "10-12" },
  ],
  "Full Body A": [
    { id: "beg-fba-legpress",  name: "Machine Leg Press",         muscleGroup: "Quads",      sets: 4, reps: "10-12" },
    { id: "beg-fba-legcurl",   name: "Lying Leg Curl",            muscleGroup: "Hamstrings", sets: 3, reps: "10-12" },
    { id: "beg-fba-chest",     name: "Machine Chest Press",       muscleGroup: "Chest",      sets: 3, reps: "10-12" },
    { id: "beg-fba-cablerow",  name: "Seated Cable Row",          muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "beg-fba-pulldown",  name: "Wide-Grip Lat Pulldown",    muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "beg-fba-dbshoulder",name: "Dumbbell Shoulder Press",   muscleGroup: "Shoulders",  sets: 3, reps: "10-12" },
  ],
  "Full Body B": [
    { id: "beg-fbb-goblet",    name: "Goblet Squat",              muscleGroup: "Quads",      sets: 3, reps: "12-15" },
    { id: "beg-fbb-bridge",    name: "Glute Bridge",              muscleGroup: "Glutes",     sets: 3, reps: "12-15" },
    { id: "beg-fbb-incline",   name: "Incline Dumbbell Press",    muscleGroup: "Chest",      sets: 3, reps: "10-12" },
    { id: "beg-fbb-machrow",   name: "Machine Row",               muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "beg-fbb-pulldown",  name: "Wide-Grip Lat Pulldown",    muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "beg-fbb-latraises", name: "Dumbbell Lateral Raises",   muscleGroup: "Shoulders",  sets: 3, reps: "12-15" },
  ],
  "Full Body C": [
    { id: "beg-fbc-legext",    name: "Leg Extension",             muscleGroup: "Quads",      sets: 3, reps: "12-15" },
    { id: "beg-fbc-legcurl",   name: "Lying Leg Curl",            muscleGroup: "Hamstrings", sets: 3, reps: "10-12" },
    { id: "beg-fbc-pecdeck",   name: "Pec Deck Machine",          muscleGroup: "Chest",      sets: 3, reps: "12-15" },
    { id: "beg-fbc-cablerow",  name: "Seated Cable Row",          muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "beg-fbc-machrow",   name: "Machine Row",               muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "beg-fbc-facepull",  name: "Cable Face Pulls",          muscleGroup: "Rear Delts", sets: 3, reps: "12-15" },
  ],
  Chest: [
    { id: "beg-machine-chest",   name: "Machine Chest Press",       muscleGroup: "Chest",     sets: 4, reps: "10-12" },
    { id: "beg-incline-db",      name: "Incline Dumbbell Press",    muscleGroup: "Chest",     sets: 3, reps: "10-12" },
    { id: "beg-cable-flyes",     name: "Cable Flyes",               muscleGroup: "Chest",     sets: 3, reps: "12-15" },
    { id: "beg-pec-deck",        name: "Pec Deck Machine",          muscleGroup: "Chest",     sets: 3, reps: "12-15" },
    { id: "beg-cable-pushdown",  name: "Cable Tricep Pushdown",     muscleGroup: "Triceps",   sets: 3, reps: "12-15" },
  ],
  Back: [
    { id: "beg-lat-pulldown",    name: "Wide-Grip Lat Pulldown",    muscleGroup: "Back",      sets: 4, reps: "10-12" },
    { id: "beg-seated-row",      name: "Seated Cable Row",          muscleGroup: "Back",      sets: 3, reps: "10-12" },
    { id: "beg-machine-row",     name: "Machine Row",               muscleGroup: "Back",      sets: 3, reps: "10-12" },
    { id: "beg-face-pull",       name: "Cable Face Pulls",          muscleGroup: "Rear Delts",sets: 3, reps: "12-15" },
    { id: "beg-db-curl",         name: "Dumbbell Bicep Curl",       muscleGroup: "Biceps",    sets: 3, reps: "12-15" },
  ],
  Shoulders: [
    { id: "beg-machine-shoulder",name: "Machine Shoulder Press",    muscleGroup: "Shoulders", sets: 4, reps: "10-12" },
    { id: "beg-lat-raises",      name: "Dumbbell Lateral Raises",   muscleGroup: "Shoulders", sets: 4, reps: "12-15" },
    { id: "beg-face-pull",       name: "Cable Face Pulls",          muscleGroup: "Rear Delts",sets: 3, reps: "12-15" },
    { id: "beg-db-front-raise",  name: "Dumbbell Front Raises",     muscleGroup: "Shoulders", sets: 3, reps: "12-15" },
    { id: "beg-rear-delt-fly",   name: "Rear Delt Machine Fly",     muscleGroup: "Rear Delts",sets: 3, reps: "12-15" },
  ],
  Arms: [
    { id: "beg-db-curl",         name: "Dumbbell Bicep Curl",       muscleGroup: "Biceps",    sets: 4, reps: "12-15" },
    { id: "beg-cable-pushdown",  name: "Cable Tricep Pushdown",     muscleGroup: "Triceps",   sets: 4, reps: "12-15" },
    { id: "beg-hammer-curls",    name: "Hammer Curls",              muscleGroup: "Biceps",    sets: 3, reps: "12-15" },
    { id: "beg-overhead-tri",    name: "Overhead Tricep Extension", muscleGroup: "Triceps",   sets: 3, reps: "12-15" },
    { id: "beg-machine-curl",    name: "Machine Bicep Curl",        muscleGroup: "Biceps",    sets: 3, reps: "12-15" },
  ],
};

const DUMBBELL_EXERCISES: Record<string, Exercise[]> = {
  Push: [
    { id: "db-bench-press",    name: "Dumbbell Bench Press",    muscleGroup: "Chest",      sets: 4, reps: "8-10" },
    { id: "incline-db-press",  name: "Incline Dumbbell Press",  muscleGroup: "Chest",      sets: 3, reps: "10-12" },
    { id: "db-shoulder-press", name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders",  sets: 3, reps: "8-10" },
    { id: "lateral-raises",    name: "Dumbbell Lateral Raises",          muscleGroup: "Shoulders",  sets: 3, reps: "12-15" },
    { id: "overhead-tricep",   name: "Overhead Tricep Extension", muscleGroup: "Triceps",  sets: 3, reps: "10-12" },
  ],
  Pull: [
    { id: "db-row",            name: "Dumbbell Row",            muscleGroup: "Back",       sets: 4, reps: "8-10" },
    { id: "chest-sup-row",     name: "Chest Supported Row",     muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "rear-delt-fly",     name: "Rear Delt Fly",           muscleGroup: "Rear Delts", sets: 3, reps: "12-15" },
    { id: "dumbbell-curl",     name: "Dumbbell Bicep Curl",           muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
    { id: "hammer-curls",      name: "Hammer Curls",            muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
  ],
  Legs: [
    { id: "goblet-squat",      name: "Goblet Squat",            muscleGroup: "Quads",      sets: 4, reps: "8-10" },
    { id: "romanian-deadlift", name: "Romanian Deadlift",       muscleGroup: "Hamstrings", sets: 3, reps: "8-10" },
    { id: "bulgarian-ss",      name: "Bulgarian Split Squat",   muscleGroup: "Quads",      sets: 3, reps: "10-12" },
    { id: "walking-lunges",    name: "Walking Lunges",          muscleGroup: "Quads",      sets: 3, reps: "10-12" },
    { id: "glute-bridge",      name: "Glute Bridge",            muscleGroup: "Glutes",     sets: 3, reps: "12-15" },
  ],
  Upper: [
    { id: "db-bench-press",    name: "Dumbbell Bench Press",    muscleGroup: "Chest",      sets: 4, reps: "8-10" },
    { id: "db-row",            name: "Dumbbell Row",            muscleGroup: "Back",       sets: 4, reps: "8-10" },
    { id: "db-shoulder-press", name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders",  sets: 3, reps: "8-10" },
    { id: "rear-delt-fly",     name: "Rear Delt Fly",           muscleGroup: "Rear Delts", sets: 3, reps: "12-15" },
    { id: "hammer-curls",      name: "Hammer Curls",            muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
  ],
  Lower: [
    { id: "goblet-squat",      name: "Goblet Squat",            muscleGroup: "Quads",      sets: 4, reps: "8-10" },
    { id: "romanian-deadlift", name: "Romanian Deadlift",       muscleGroup: "Hamstrings", sets: 4, reps: "8-10" },
    { id: "bulgarian-ss",      name: "Bulgarian Split Squat",   muscleGroup: "Quads",      sets: 3, reps: "10-12" },
    { id: "walking-lunges",    name: "Walking Lunges",          muscleGroup: "Quads",      sets: 3, reps: "10-12" },
    { id: "glute-bridge",      name: "Glute Bridge",            muscleGroup: "Glutes",     sets: 3, reps: "12-15" },
  ],
  "Full Body": [
    { id: "goblet-squat",      name: "Goblet Squat",            muscleGroup: "Quads",      sets: 3, reps: "8-10" },
    { id: "db-bench-press",    name: "Dumbbell Bench Press",    muscleGroup: "Chest",      sets: 3, reps: "8-10" },
    { id: "db-row",            name: "Dumbbell Row",            muscleGroup: "Back",       sets: 3, reps: "8-10" },
    { id: "romanian-deadlift", name: "Romanian Deadlift",       muscleGroup: "Hamstrings", sets: 3, reps: "8-10" },
    { id: "db-shoulder-press", name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders",  sets: 3, reps: "10-12" },
  ],
  Chest: [
    { id: "db-bench-press",    name: "Dumbbell Bench Press",    muscleGroup: "Chest",      sets: 4, reps: "8-10" },
    { id: "incline-db-press",  name: "Incline Dumbbell Press",  muscleGroup: "Chest",      sets: 3, reps: "10-12" },
    { id: "db-flyes",          name: "Dumbbell Flyes",          muscleGroup: "Chest",      sets: 3, reps: "12-15" },
    { id: "overhead-tricep",   name: "Overhead Tricep Extension", muscleGroup: "Triceps",  sets: 3, reps: "10-12" },
    { id: "tricep-kickback",   name: "Tricep Kickback",         muscleGroup: "Triceps",    sets: 3, reps: "12-15" },
  ],
  Back: [
    { id: "db-row",            name: "Dumbbell Row",            muscleGroup: "Back",       sets: 4, reps: "8-10" },
    { id: "chest-sup-row",     name: "Chest Supported Row",     muscleGroup: "Back",       sets: 3, reps: "10-12" },
    { id: "rear-delt-fly",     name: "Rear Delt Fly",           muscleGroup: "Rear Delts", sets: 3, reps: "12-15" },
    { id: "dumbbell-curl",     name: "Dumbbell Bicep Curl",           muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
    { id: "hammer-curls",      name: "Hammer Curls",            muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
  ],
  Shoulders: [
    { id: "db-shoulder-press", name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders",  sets: 4, reps: "8-10" },
    { id: "lateral-raises",    name: "Dumbbell Lateral Raises",          muscleGroup: "Shoulders",  sets: 4, reps: "12-15" },
    { id: "rear-delt-fly",     name: "Rear Delt Fly",           muscleGroup: "Rear Delts", sets: 3, reps: "12-15" },
    { id: "front-raises",      name: "Dumbbell Front Raises",            muscleGroup: "Shoulders",  sets: 3, reps: "12-15" },
    { id: "db-shrug",          name: "Dumbbell Shrug",          muscleGroup: "Traps",      sets: 3, reps: "12-15" },
  ],
  Arms: [
    { id: "dumbbell-curl",     name: "Dumbbell Bicep Curl",           muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
    { id: "hammer-curls",      name: "Hammer Curls",            muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
    { id: "overhead-tricep",   name: "Overhead Tricep Extension", muscleGroup: "Triceps",  sets: 3, reps: "10-12" },
    { id: "tricep-kickback",   name: "Tricep Kickback",         muscleGroup: "Triceps",    sets: 3, reps: "12-15" },
    { id: "incline-db-curl",   name: "Incline Dumbbell Curl",   muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
  ],
};

const BODYWEIGHT_EXERCISES: Record<string, Exercise[]> = {
  Push: [
    { id: "push-ups",        name: "Push-Ups",         muscleGroup: "Chest",    sets: 4, reps: "10-15" },
    { id: "chest-dips",      name: "Chest Dips",       muscleGroup: "Chest",    sets: 3, reps: "8-12" },
    { id: "diamond-push",    name: "Diamond Push-Ups", muscleGroup: "Triceps",  sets: 3, reps: "8-12" },
    { id: "tricep-dips",     name: "Tricep Dips",      muscleGroup: "Triceps",  sets: 3, reps: "8-12" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",     sets: 3, reps: "45-60s" },
  ],
  Pull: [
    { id: "pull-ups",        name: "Pull-Ups",         muscleGroup: "Back",     sets: 4, reps: "5-10" },
    { id: "chin-ups",        name: "Chin-Ups",         muscleGroup: "Back",     sets: 3, reps: "5-10" },
    { id: "hyperextension",  name: "Hyperextension",   muscleGroup: "Back",     sets: 3, reps: "12-15" },
    { id: "dead-bug",        name: "Dead Bug",         muscleGroup: "Core",     sets: 3, reps: "10-12" },
    { id: "hanging-lr",      name: "Hanging Leg Raise",muscleGroup: "Core",     sets: 3, reps: "8-12" },
  ],
  Legs: [
    { id: "reverse-lunges",  name: "Reverse Lunges",   muscleGroup: "Quads",    sets: 4, reps: "10-12" },
    { id: "glute-bridge",    name: "Glute Bridge",     muscleGroup: "Glutes",   sets: 4, reps: "12-15" },
    { id: "sissy-squat",     name: "Sissy Squat",      muscleGroup: "Quads",    sets: 3, reps: "8-12" },
    { id: "mtn-climbers",    name: "Mountain Climbers",muscleGroup: "Core",     sets: 3, reps: "20-30" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",     sets: 3, reps: "45-60s" },
  ],
  Upper: [
    { id: "push-ups",        name: "Push-Ups",         muscleGroup: "Chest",    sets: 4, reps: "10-15" },
    { id: "pull-ups",        name: "Pull-Ups",         muscleGroup: "Back",     sets: 4, reps: "5-10" },
    { id: "tricep-dips",     name: "Tricep Dips",      muscleGroup: "Triceps",  sets: 3, reps: "8-12" },
    { id: "chin-ups",        name: "Chin-Ups",         muscleGroup: "Back",     sets: 3, reps: "5-10" },
    { id: "diamond-push",    name: "Diamond Push-Ups", muscleGroup: "Triceps",  sets: 3, reps: "8-12" },
  ],
  Lower: [
    { id: "reverse-lunges",  name: "Reverse Lunges",   muscleGroup: "Quads",    sets: 4, reps: "10-12" },
    { id: "glute-bridge",    name: "Glute Bridge",     muscleGroup: "Glutes",   sets: 4, reps: "12-15" },
    { id: "sissy-squat",     name: "Sissy Squat",      muscleGroup: "Quads",    sets: 3, reps: "8-12" },
    { id: "dead-bug",        name: "Dead Bug",         muscleGroup: "Core",     sets: 3, reps: "10-12" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",     sets: 3, reps: "45-60s" },
  ],
  "Full Body": [
    { id: "push-ups",        name: "Push-Ups",         muscleGroup: "Chest",    sets: 3, reps: "10-15" },
    { id: "pull-ups",        name: "Pull-Ups",         muscleGroup: "Back",     sets: 3, reps: "5-10" },
    { id: "reverse-lunges",  name: "Reverse Lunges",   muscleGroup: "Quads",    sets: 3, reps: "10-12" },
    { id: "glute-bridge",    name: "Glute Bridge",     muscleGroup: "Glutes",   sets: 3, reps: "12-15" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",     sets: 3, reps: "45-60s" },
  ],
  Chest: [
    { id: "push-ups",        name: "Push-Ups",         muscleGroup: "Chest",    sets: 4, reps: "10-15" },
    { id: "chest-dips",      name: "Chest Dips",       muscleGroup: "Chest",    sets: 4, reps: "8-12" },
    { id: "diamond-push",    name: "Diamond Push-Ups", muscleGroup: "Triceps",  sets: 3, reps: "8-12" },
    { id: "tricep-dips",     name: "Tricep Dips",      muscleGroup: "Triceps",  sets: 3, reps: "8-12" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",     sets: 3, reps: "45-60s" },
  ],
  Back: [
    { id: "pull-ups",        name: "Pull-Ups",         muscleGroup: "Back",     sets: 4, reps: "5-10" },
    { id: "chin-ups",        name: "Chin-Ups",         muscleGroup: "Back",     sets: 4, reps: "5-10" },
    { id: "hyperextension",  name: "Hyperextension",   muscleGroup: "Back",     sets: 3, reps: "12-15" },
    { id: "dead-bug",        name: "Dead Bug",         muscleGroup: "Core",     sets: 3, reps: "10-12" },
    { id: "mtn-climbers",    name: "Mountain Climbers",muscleGroup: "Core",     sets: 3, reps: "20-30" },
  ],
  Shoulders: [
    { id: "push-ups",        name: "Push-Ups",         muscleGroup: "Chest",    sets: 4, reps: "10-15" },
    { id: "chest-dips",      name: "Chest Dips",       muscleGroup: "Chest",    sets: 3, reps: "8-12" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",     sets: 4, reps: "45-60s" },
    { id: "dead-bug",        name: "Dead Bug",         muscleGroup: "Core",     sets: 3, reps: "10-12" },
    { id: "mtn-climbers",    name: "Mountain Climbers",muscleGroup: "Core",     sets: 3, reps: "20-30" },
  ],
  Arms: [
    { id: "chin-ups",        name: "Chin-Ups",         muscleGroup: "Back",     sets: 4, reps: "5-10" },
    { id: "tricep-dips",     name: "Tricep Dips",      muscleGroup: "Triceps",  sets: 4, reps: "8-12" },
    { id: "diamond-push",    name: "Diamond Push-Ups", muscleGroup: "Triceps",  sets: 3, reps: "8-12" },
    { id: "push-ups",        name: "Push-Ups",         muscleGroup: "Chest",    sets: 3, reps: "10-15" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",     sets: 3, reps: "45-60s" },
  ],
};

// home_minimal = pull-up bar + resistance bands → mix of bodyweight and dumbbell
const HOME_MINIMAL_EXERCISES: Record<string, Exercise[]> = {
  Push: [
    { id: "push-ups",        name: "Push-Ups",         muscleGroup: "Chest",      sets: 4, reps: "10-15" },
    { id: "chest-dips",      name: "Chest Dips",       muscleGroup: "Chest",      sets: 3, reps: "8-12" },
    { id: "lateral-raises",  name: "Dumbbell Lateral Raises",   muscleGroup: "Shoulders",  sets: 3, reps: "12-15" },
    { id: "diamond-push",    name: "Diamond Push-Ups", muscleGroup: "Triceps",    sets: 3, reps: "8-12" },
    { id: "tricep-dips",     name: "Tricep Dips",      muscleGroup: "Triceps",    sets: 3, reps: "8-12" },
  ],
  Pull: [
    { id: "pull-ups",        name: "Pull-Ups",         muscleGroup: "Back",       sets: 4, reps: "5-10" },
    { id: "chin-ups",        name: "Chin-Ups",         muscleGroup: "Back",       sets: 3, reps: "5-10" },
    { id: "rear-delt-fly",   name: "Rear Delt Fly",    muscleGroup: "Rear Delts", sets: 3, reps: "12-15" },
    { id: "hammer-curls",    name: "Hammer Curls",     muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
    { id: "dead-bug",        name: "Dead Bug",         muscleGroup: "Core",       sets: 3, reps: "10-12" },
  ],
  Legs: [
    { id: "reverse-lunges",  name: "Reverse Lunges",   muscleGroup: "Quads",      sets: 4, reps: "10-12" },
    { id: "glute-bridge",    name: "Glute Bridge",     muscleGroup: "Glutes",     sets: 4, reps: "12-15" },
    { id: "bulgarian-ss",    name: "Bulgarian Split Squat", muscleGroup: "Quads", sets: 3, reps: "10-12" },
    { id: "sissy-squat",     name: "Sissy Squat",      muscleGroup: "Quads",      sets: 3, reps: "8-12" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",       sets: 3, reps: "45-60s" },
  ],
  Upper: [
    { id: "push-ups",        name: "Push-Ups",         muscleGroup: "Chest",      sets: 4, reps: "10-15" },
    { id: "pull-ups",        name: "Pull-Ups",         muscleGroup: "Back",       sets: 4, reps: "5-10" },
    { id: "lateral-raises",  name: "Dumbbell Lateral Raises",   muscleGroup: "Shoulders",  sets: 3, reps: "12-15" },
    { id: "chin-ups",        name: "Chin-Ups",         muscleGroup: "Back",       sets: 3, reps: "5-10" },
    { id: "hammer-curls",    name: "Hammer Curls",     muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
  ],
  Lower: [
    { id: "reverse-lunges",  name: "Reverse Lunges",   muscleGroup: "Quads",      sets: 4, reps: "10-12" },
    { id: "glute-bridge",    name: "Glute Bridge",     muscleGroup: "Glutes",     sets: 4, reps: "12-15" },
    { id: "bulgarian-ss",    name: "Bulgarian Split Squat", muscleGroup: "Quads", sets: 3, reps: "10-12" },
    { id: "sissy-squat",     name: "Sissy Squat",      muscleGroup: "Quads",      sets: 3, reps: "8-12" },
    { id: "dead-bug",        name: "Dead Bug",         muscleGroup: "Core",       sets: 3, reps: "10-12" },
  ],
  "Full Body": [
    { id: "push-ups",        name: "Push-Ups",         muscleGroup: "Chest",      sets: 3, reps: "10-15" },
    { id: "pull-ups",        name: "Pull-Ups",         muscleGroup: "Back",       sets: 3, reps: "5-10" },
    { id: "reverse-lunges",  name: "Reverse Lunges",   muscleGroup: "Quads",      sets: 3, reps: "10-12" },
    { id: "glute-bridge",    name: "Glute Bridge",     muscleGroup: "Glutes",     sets: 3, reps: "12-15" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",       sets: 3, reps: "45-60s" },
  ],
  Chest: [
    { id: "push-ups",        name: "Push-Ups",         muscleGroup: "Chest",      sets: 4, reps: "10-15" },
    { id: "chest-dips",      name: "Chest Dips",       muscleGroup: "Chest",      sets: 4, reps: "8-12" },
    { id: "diamond-push",    name: "Diamond Push-Ups", muscleGroup: "Triceps",    sets: 3, reps: "8-12" },
    { id: "tricep-dips",     name: "Tricep Dips",      muscleGroup: "Triceps",    sets: 3, reps: "8-12" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",       sets: 3, reps: "45-60s" },
  ],
  Back: [
    { id: "pull-ups",        name: "Pull-Ups",         muscleGroup: "Back",       sets: 4, reps: "5-10" },
    { id: "chin-ups",        name: "Chin-Ups",         muscleGroup: "Back",       sets: 4, reps: "5-10" },
    { id: "rear-delt-fly",   name: "Rear Delt Fly",    muscleGroup: "Rear Delts", sets: 3, reps: "12-15" },
    { id: "hammer-curls",    name: "Hammer Curls",     muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
    { id: "dead-bug",        name: "Dead Bug",         muscleGroup: "Core",       sets: 3, reps: "10-12" },
  ],
  Shoulders: [
    { id: "push-ups",        name: "Push-Ups",         muscleGroup: "Chest",      sets: 4, reps: "10-15" },
    { id: "lateral-raises",  name: "Dumbbell Lateral Raises",   muscleGroup: "Shoulders",  sets: 4, reps: "12-15" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",       sets: 3, reps: "45-60s" },
    { id: "chin-ups",        name: "Chin-Ups",         muscleGroup: "Back",       sets: 3, reps: "5-10" },
    { id: "dead-bug",        name: "Dead Bug",         muscleGroup: "Core",       sets: 3, reps: "10-12" },
  ],
  Arms: [
    { id: "chin-ups",        name: "Chin-Ups",         muscleGroup: "Back",       sets: 4, reps: "5-10" },
    { id: "tricep-dips",     name: "Tricep Dips",      muscleGroup: "Triceps",    sets: 4, reps: "8-12" },
    { id: "hammer-curls",    name: "Hammer Curls",     muscleGroup: "Biceps",     sets: 3, reps: "10-12" },
    { id: "diamond-push",    name: "Diamond Push-Ups", muscleGroup: "Triceps",    sets: 3, reps: "8-12" },
    { id: "plank",           name: "Plank",            muscleGroup: "Core",       sets: 3, reps: "45-60s" },
  ],
};

const KETTLEBELL_EXERCISES: Record<string, Exercise[]> = {
  Push: [
    { id: "kb-floor-press",  name: "KB Floor Press",             muscleGroup: "Chest",     sets: 4, reps: "8-10" },
    { id: "kb-squeeze-press",name: "KB Squeeze Press",           muscleGroup: "Chest",     sets: 3, reps: "10-12" },
    { id: "kb-press",        name: "KB Press",                   muscleGroup: "Shoulders", sets: 3, reps: "8-10" },
    { id: "kb-lateral",      name: "KB Lateral Raise",           muscleGroup: "Shoulders", sets: 3, reps: "12-15" },
    { id: "kb-overhead-tri", name: "KB Overhead Tricep Extension",muscleGroup: "Triceps",  sets: 3, reps: "10-12" },
  ],
  Pull: [
    { id: "kb-row",          name: "KB Row",                     muscleGroup: "Back",      sets: 4, reps: "8-10" },
    { id: "kb-renegade",     name: "KB Renegade Row",            muscleGroup: "Back",      sets: 3, reps: "8-10" },
    { id: "kb-high-pull",    name: "KB High Pull",               muscleGroup: "Back",      sets: 3, reps: "10-12" },
    { id: "kb-curl",         name: "KB Curl",                    muscleGroup: "Biceps",    sets: 3, reps: "10-12" },
    { id: "kb-hammer-curl",  name: "KB Hammer Curl",             muscleGroup: "Biceps",    sets: 3, reps: "10-12" },
  ],
  Legs: [
    { id: "kb-goblet",       name: "KB Goblet Squat",            muscleGroup: "Quads",     sets: 4, reps: "8-10" },
    { id: "kb-swing",        name: "KB Swing",                   muscleGroup: "Hamstrings",sets: 4, reps: "12-15" },
    { id: "kb-rdl",          name: "KB Romanian Deadlift",       muscleGroup: "Hamstrings",sets: 3, reps: "8-10" },
    { id: "kb-lunges",       name: "KB Lunges",                  muscleGroup: "Quads",     sets: 3, reps: "10-12" },
    { id: "kb-calf-raise",   name: "KB Calf Raise",              muscleGroup: "Calves",    sets: 3, reps: "12-15" },
  ],
  Upper: [
    { id: "kb-floor-press",  name: "KB Floor Press",             muscleGroup: "Chest",     sets: 4, reps: "8-10" },
    { id: "kb-row",          name: "KB Row",                     muscleGroup: "Back",      sets: 4, reps: "8-10" },
    { id: "kb-press",        name: "KB Press",                   muscleGroup: "Shoulders", sets: 3, reps: "8-10" },
    { id: "kb-renegade",     name: "KB Renegade Row",            muscleGroup: "Back",      sets: 3, reps: "8-10" },
    { id: "kb-curl",         name: "KB Curl",                    muscleGroup: "Biceps",    sets: 3, reps: "10-12" },
  ],
  Lower: [
    { id: "kb-goblet",       name: "KB Goblet Squat",            muscleGroup: "Quads",     sets: 4, reps: "8-10" },
    { id: "kb-swing",        name: "KB Swing",                   muscleGroup: "Hamstrings",sets: 4, reps: "12-15" },
    { id: "kb-rdl",          name: "KB Romanian Deadlift",       muscleGroup: "Hamstrings",sets: 3, reps: "8-10" },
    { id: "kb-bss",          name: "KB Bulgarian Split Squat",   muscleGroup: "Quads",     sets: 3, reps: "10-12" },
    { id: "kb-calf-raise",   name: "KB Calf Raise",              muscleGroup: "Calves",    sets: 3, reps: "12-15" },
  ],
  "Full Body": [
    { id: "kb-goblet",       name: "KB Goblet Squat",            muscleGroup: "Quads",     sets: 3, reps: "8-10" },
    { id: "kb-swing",        name: "KB Swing",                   muscleGroup: "Hamstrings",sets: 3, reps: "12-15" },
    { id: "kb-floor-press",  name: "KB Floor Press",             muscleGroup: "Chest",     sets: 3, reps: "8-10" },
    { id: "kb-row",          name: "KB Row",                     muscleGroup: "Back",       sets: 3, reps: "8-10" },
    { id: "kb-tgu",          name: "KB Turkish Get-Up",          muscleGroup: "Core",       sets: 2, reps: "3-5" },
  ],
  "Full Body A": [
    { id: "kb-swing-a",      name: "KB Swing",                   muscleGroup: "Hamstrings",sets: 4, reps: "12-15" },
    { id: "kb-push-press-a", name: "KB Push Press",              muscleGroup: "Shoulders", sets: 3, reps: "6-8" },
    { id: "kb-rdl-a",        name: "KB Romanian Deadlift",       muscleGroup: "Hamstrings",sets: 3, reps: "8-10" },
    { id: "kb-press-a",      name: "KB Press",                   muscleGroup: "Shoulders", sets: 3, reps: "8-10" },
    { id: "kb-high-pull-a",  name: "KB High Pull",               muscleGroup: "Back",      sets: 3, reps: "10-12" },
  ],
  "Full Body B": [
    { id: "kb-goblet-b",     name: "KB Goblet Squat",            muscleGroup: "Quads",     sets: 4, reps: "8-10" },
    { id: "kb-row-b",        name: "KB Row",                     muscleGroup: "Back",      sets: 4, reps: "8-10" },
    { id: "kb-floor-press-b",name: "KB Floor Press",             muscleGroup: "Chest",     sets: 3, reps: "8-10" },
    { id: "kb-renegade-b",   name: "KB Renegade Row",            muscleGroup: "Back",      sets: 3, reps: "8-10" },
    { id: "kb-curl-b",       name: "KB Curl",                    muscleGroup: "Biceps",    sets: 3, reps: "10-12" },
  ],
  "Full Body C": [
    { id: "kb-bss-c",        name: "KB Bulgarian Split Squat",   muscleGroup: "Quads",     sets: 3, reps: "10-12" },
    { id: "kb-lunges-c",     name: "KB Lunges",                  muscleGroup: "Quads",     sets: 3, reps: "10-12" },
    { id: "kb-tgu-c",        name: "KB Turkish Get-Up",          muscleGroup: "Core",      sets: 3, reps: "3-5" },
    { id: "kb-halo-c",       name: "KB Halo",                    muscleGroup: "Shoulders", sets: 3, reps: "10-12" },
    { id: "kb-swing-c",      name: "KB Swing",                   muscleGroup: "Hamstrings",sets: 3, reps: "15-20" },
  ],
  Chest: [
    { id: "kb-floor-press",  name: "KB Floor Press",             muscleGroup: "Chest",     sets: 4, reps: "8-10" },
    { id: "kb-squeeze-press",name: "KB Squeeze Press",           muscleGroup: "Chest",     sets: 4, reps: "10-12" },
    { id: "kb-push-press",   name: "KB Push Press",              muscleGroup: "Shoulders", sets: 3, reps: "8-10" },
    { id: "kb-overhead-tri", name: "KB Overhead Tricep Extension",muscleGroup: "Triceps",  sets: 3, reps: "10-12" },
    { id: "kb-skull",        name: "KB Skull Crusher",           muscleGroup: "Triceps",   sets: 3, reps: "10-12" },
  ],
  Back: [
    { id: "kb-row",          name: "KB Row",                     muscleGroup: "Back",      sets: 4, reps: "8-10" },
    { id: "kb-renegade",     name: "KB Renegade Row",            muscleGroup: "Back",      sets: 4, reps: "8-10" },
    { id: "kb-high-pull",    name: "KB High Pull",               muscleGroup: "Back",      sets: 3, reps: "10-12" },
    { id: "kb-curl",         name: "KB Curl",                    muscleGroup: "Biceps",    sets: 3, reps: "10-12" },
    { id: "kb-hammer-curl",  name: "KB Hammer Curl",             muscleGroup: "Biceps",    sets: 3, reps: "10-12" },
  ],
  Shoulders: [
    { id: "kb-press",        name: "KB Press",                   muscleGroup: "Shoulders", sets: 4, reps: "8-10" },
    { id: "kb-push-press",   name: "KB Push Press",              muscleGroup: "Shoulders", sets: 3, reps: "8-10" },
    { id: "kb-lateral",      name: "KB Lateral Raise",           muscleGroup: "Shoulders", sets: 4, reps: "12-15" },
    { id: "kb-halo",         name: "KB Halo",                    muscleGroup: "Shoulders", sets: 3, reps: "10-12" },
    { id: "kb-high-pull",    name: "KB High Pull",               muscleGroup: "Back",      sets: 3, reps: "10-12" },
  ],
  Arms: [
    { id: "kb-curl",         name: "KB Curl",                    muscleGroup: "Biceps",    sets: 4, reps: "10-12" },
    { id: "kb-hammer-curl",  name: "KB Hammer Curl",             muscleGroup: "Biceps",    sets: 3, reps: "10-12" },
    { id: "kb-overhead-tri", name: "KB Overhead Tricep Extension",muscleGroup: "Triceps",  sets: 4, reps: "10-12" },
    { id: "kb-skull",        name: "KB Skull Crusher",           muscleGroup: "Triceps",   sets: 3, reps: "10-12" },
    { id: "kb-floor-press",  name: "KB Floor Press",             muscleGroup: "Chest",     sets: 3, reps: "8-10" },
  ],
};

/**
 * Returns the exercise list for a given equipment type, fitness level, and
 * split-day name. Guaranteed to return valid exercises — falls back gracefully.
 *
 * Level-aware routing for full_gym:
 *   beginner    → BEGINNER_GYM_EXERCISES  (machines + dumbbells, no barbells)
 *   intermediate/advanced → DEFAULT_EXERCISES (barbell compounds + cables)
 *
 * All other equipment types are level-agnostic because their pools already
 * exclude barbells by definition (dumbbells, bodyweight, kettlebell, minimal).
 */
function resolveFullBodyVariantDay(
  pool: Record<string, Exercise[]>,
  dayName: string,
  equipment: Equipment | null | undefined,
  fitnessLevel?: FitnessLevel | null,
): Exercise[] | null {
  const match = dayName.match(/^Full Body\s*([ABC])?\s*$/i);
  if (!match) return null;

  const letter = match[1]?.toUpperCase();
  const exactKey = letter ? `Full Body ${letter}` : "Full Body";
  if (pool[exactKey]) return pool[exactKey];

  const dayIndex = letter === "B" ? 1 : letter === "C" ? 2 : 0;

  if (equipment === "full_gym" || equipment == null) {
    const gymPool =
      fitnessLevel === "beginner" ? BEGINNER_GYM_EXERCISES : DEFAULT_EXERCISES;
    if (gymPool[exactKey]) return gymPool[exactKey];
    return buildFullBodyDay(dayIndex);
  }

  // Dumbbells / bodyweight / kettlebell / home_minimal: assemble a varied
  // full-body day from this equipment's own pool so Day A != Day B != Day C.
  return buildFullBodyDayFromPool(pool, dayIndex);
}

export function getEquipmentExercises(
  equipment: Equipment | null | undefined,
  dayName: string,
  fitnessLevel?: FitnessLevel | null,
): Exercise[] {
  let pool: Record<string, Exercise[]>;
  switch (equipment) {
    case "dumbbells_only":
      pool = DUMBBELL_EXERCISES;
      break;
    case "home_minimal":
      pool = HOME_MINIMAL_EXERCISES;
      break;
    case "bodyweight":
      pool = BODYWEIGHT_EXERCISES;
      break;
    case "kettlebell":
      pool = KETTLEBELL_EXERCISES;
      break;
    case "full_gym":
    default:
      pool = fitnessLevel === "beginner" ? BEGINNER_GYM_EXERCISES : DEFAULT_EXERCISES;
  }

  if (pool[dayName]) return pool[dayName];

  const fbVariant = resolveFullBodyVariantDay(pool, dayName, equipment, fitnessLevel);
  if (fbVariant) return fbVariant;

  return pool["Full Body"] ?? DEFAULT_EXERCISES["Full Body"];
}

export const SPLIT_RECOMMENDATIONS: Record<number, string[]> = {
  1: ["Full Body"],
  2: ["Upper", "Lower"],
  3: ["Push", "Pull", "Legs"],
  4: ["Upper", "Lower", "Upper", "Lower"],
  5: ["Push", "Pull", "Legs", "Upper", "Lower"],
  6: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"],
  7: ["Push", "Pull", "Legs", "Upper", "Lower", "Full Body", "Full Body"],
};

// ── Full Body variation pools ─────────────────────────────────────────────────
// Each entry is one "slot" (muscle-group position) in the Full Body template.
// When multiple Full Body days exist in the same plan, each day picks
//   variations[dayIndex % variations.length]
// so no exercise is repeated across days. Works for 1-day, 2-day, 3-day, etc.

interface FullBodySlot {
  muscleGroup: string;
  sets: number;
  reps: string;
  variations: Array<{ id: string; name: string }>;
}

const FULL_BODY_SLOT_POOLS: FullBodySlot[] = [
  {
    muscleGroup: "Legs",
    sets: 3,
    reps: "8-10",
    variations: [
      { id: "fb-squat",     name: "Barbell Back Squat" },
      { id: "fb-leg-press", name: "Machine Leg Press" },
      { id: "fb-rdl",       name: "Romanian Deadlift" },
      { id: "fb-bss",       name: "Bulgarian Split Squat" },
      { id: "fb-lunges",    name: "Dumbbell Lunges" },
    ],
  },
  {
    muscleGroup: "Chest",
    sets: 3,
    reps: "8-10",
    variations: [
      { id: "fb-bench",         name: "Barbell Bench Press" },
      { id: "fb-incline-db",    name: "Incline Dumbbell Press" },
      { id: "fb-cable-flyes",   name: "Cable Flyes" },
      { id: "fb-db-flyes",      name: "Dumbbell Flyes" },
      { id: "fb-machine-chest", name: "Machine Chest Press" },
    ],
  },
  {
    muscleGroup: "Back",
    sets: 3,
    reps: "8-10",
    variations: [
      { id: "fb-barbell-row",  name: "Barbell Bent-Over Row" },
      { id: "fb-lat-pull",     name: "Wide-Grip Lat Pulldown" },
      { id: "fb-seated-cable", name: "Seated Cable Row" },
      { id: "fb-pull-ups",     name: "Pull-Ups" },
      { id: "fb-db-row",       name: "Dumbbell Rows" },
    ],
  },
  {
    muscleGroup: "Shoulders",
    sets: 3,
    reps: "10-12",
    variations: [
      { id: "fb-ohp",        name: "Barbell Overhead Press" },
      { id: "fb-db-press",   name: "Dumbbell Shoulder Press" },
      { id: "fb-lat-raises", name: "Dumbbell Lateral Raises" },
      { id: "fb-arnold",     name: "Arnold Press" },
    ],
  },
  {
    muscleGroup: "Arms",
    sets: 3,
    reps: "10-12",
    variations: [
      { id: "fb-barbell-curl", name: "Barbell Bicep Curl" },
      { id: "fb-hammer-curl",  name: "Hammer Curl" },
      { id: "fb-tricep-push",  name: "Cable Tricep Pushdown" },
      { id: "fb-skull-crush",  name: "Skull Crushers" },
    ],
  },
];

/**
 * Build the exercise list for one Full Body day.
 * @param dayIndex  0-based ordinal of this Full Body day within the plan
 *                  (not the overall day index).  Modulo wrapping means it
 *                  works correctly for any number of Full Body days per week.
 */
function buildFullBodyDay(dayIndex: number): Exercise[] {
  return FULL_BODY_SLOT_POOLS.map((slot) => {
    const v = slot.variations[dayIndex % slot.variations.length];
    return {
      id: `${v.id}-d${dayIndex}`,
      name: v.name,
      muscleGroup: slot.muscleGroup,
      sets: slot.sets,
      reps: slot.reps,
    };
  });
}

// Ordered movement "slots" for a balanced full-body day. Each slot lists the
// muscle groups that can fill it. Used to assemble varied full-body days from
// ANY equipment pool (dumbbells, bodyweight, kettlebell, home_minimal) so that
// Day A / Day B / Day C never end up identical.
const FB_GENERIC_SLOTS: Array<{ label: string; muscles: string[] }> = [
  { label: "Legs", muscles: ["Quads", "Hamstrings", "Glutes"] },
  { label: "Chest", muscles: ["Chest"] },
  { label: "Back", muscles: ["Back"] },
  { label: "Shoulders", muscles: ["Shoulders", "Rear Delts", "Traps"] },
  { label: "Arms", muscles: ["Biceps", "Triceps"] },
  { label: "Core", muscles: ["Core"] },
];

/**
 * Builds one full-body day from an equipment pool, rotating the exercise picked
 * for each slot by `dayIndex` so consecutive full-body days differ. Falls back
 * to the pool's curated "Full Body" list only if the pool is too sparse.
 */
function buildFullBodyDayFromPool(
  pool: Record<string, Exercise[]>,
  dayIndex: number,
): Exercise[] {
  // Collect every unique exercise across all category lists in this pool.
  const byName = new Map<string, Exercise>();
  for (const key of Object.keys(pool)) {
    for (const ex of pool[key]) {
      if (!byName.has(ex.name)) byName.set(ex.name, ex);
    }
  }
  const all = [...byName.values()];

  const result: Exercise[] = [];
  const usedNames = new Set<string>();

  for (const slot of FB_GENERIC_SLOTS) {
    const candidates = all.filter(
      (e) => slot.muscles.includes(e.muscleGroup) && !usedNames.has(e.name),
    );
    if (candidates.length === 0) continue;
    // Rotate by day so Day A picks [0], Day B picks [1], etc.
    const pick = candidates[dayIndex % candidates.length];
    usedNames.add(pick.name);
    result.push({
      ...pick,
      id: `${pick.id}-fb${dayIndex}`,
      sets: 3,
    });
  }

  // Guard: if the pool was too thin to form a real day, use the curated list.
  if (result.length < 4) {
    return pool["Full Body"] ?? DEFAULT_EXERCISES["Full Body"];
  }
  return result;
}

export function generateDefaultPlan(
  daysPerWeek: number,
  name: string = "My Workout Plan"
): WorkoutPlan {
  const splitDays = SPLIT_RECOMMENDATIONS[daysPerWeek] ?? ["Full Body"];

  const totalFbDays = splitDays.filter((d) => d === "Full Body").length;
  const variants = ["A", "B", "C"] as const;
  let fullBodyCount = 0;

  const days: WorkoutDay[] = splitDays.map((dayName) => {
    if (dayName === "Full Body") {
      const variantKey =
        totalFbDays > 1
          ? (`Full Body ${variants[fullBodyCount % 3]}` as const)
          : "Full Body";
      const exercises =
        DEFAULT_EXERCISES[variantKey] ?? DEFAULT_EXERCISES["Full Body"];
      fullBodyCount += 1;
      return { dayName: variantKey, exercises };
    }
    return {
      dayName,
      exercises: DEFAULT_EXERCISES[dayName] ?? DEFAULT_EXERCISES["Full Body"],
    };
  });

  return {
    id: Date.now().toString(),
    name,
    daysPerWeek,
    days,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

/**
 * Like generateDefaultPlan, but respects the user's available equipment and
 * fitness level (so a "dumbbells only" user never gets barbell/machine moves)
 * and varies exercises across repeated Full Body days. Used by the manual
 * "Create Plan" flow so a second plan matches the onboarding equipment choice.
 */
export function generateEquipmentAwarePlan(
  daysPerWeek: number,
  name: string = "My Workout Plan",
  equipment: Equipment | null = null,
  fitnessLevel: FitnessLevel | null = null,
): WorkoutPlan {
  const splitDays = SPLIT_RECOMMENDATIONS[daysPerWeek] ?? ["Full Body"];

  const totalFbDays = splitDays.filter((d) => d === "Full Body").length;
  const variants = ["A", "B", "C"] as const;
  let fullBodyCount = 0;

  const days: WorkoutDay[] = splitDays.map((dayName) => {
    if (dayName === "Full Body") {
      const variantKey =
        totalFbDays > 1
          ? (`Full Body ${variants[fullBodyCount % 3]}` as const)
          : "Full Body";
      fullBodyCount += 1;
      return {
        dayName: variantKey,
        exercises: getEquipmentExercises(equipment, variantKey, fitnessLevel),
      };
    }
    return {
      dayName,
      exercises: getEquipmentExercises(equipment, dayName, fitnessLevel),
    };
  });

  return {
    id: Date.now().toString(),
    name,
    daysPerWeek,
    days,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}

export interface BodyMeasurement {
  id: string;
  date: string;
  weight?: number;
  bodyFat?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  biceps?: number;
  thighs?: number;
  notes?: string;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  uri: string;
  type: "front" | "side" | "back";
}

export async function getBodyMeasurements(): Promise<BodyMeasurement[]> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.BODY_MEASUREMENTS);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

export async function addBodyMeasurement(measurement: BodyMeasurement): Promise<void> {
  const measurements = await getBodyMeasurements();
  measurements.unshift(measurement);
  await AsyncStorage.setItem(STORAGE_KEYS.BODY_MEASUREMENTS, JSON.stringify(measurements));
}

export async function getProgressPhotos(): Promise<ProgressPhoto[]> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEYS.PROGRESS_PHOTOS);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

export async function addProgressPhoto(photo: ProgressPhoto): Promise<void> {
  const photos = await getProgressPhotos();
  photos.unshift(photo);
  await AsyncStorage.setItem(STORAGE_KEYS.PROGRESS_PHOTOS, JSON.stringify(photos));
}
