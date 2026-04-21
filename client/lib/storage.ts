import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
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

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  targetRIR?: number;
}

export interface WorkoutDay {
  dayName: string;
  exercises: Exercise[];
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
  reason: string;
  confidence: "increase" | "hold" | "decrease";
}

const LARGE_COMPOUND_KEYWORDS = ["squat", "deadlift", "bench", "press", "row", "pull"];

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Calculates the recommended weight for the next session of an exercise.
 * Analyses ALL logged sets — the worst-performing set (lowest Epley e1RM) acts
 * as the bottleneck so a single bad set prevents a premature weight increase.
 */
export function calculateProgressionWeight(
  lastSets: Array<{ weight: string; reps: string; rating?: SetType | "green" | "yellow" | "red" | null }>,
  targetReps: string,
  exerciseName: string
): WeightRecommendation | null {
  const validSets = lastSets
    .map((s) => ({ weight: parseFloat(s.weight) || 0, reps: parseInt(s.reps) || 0 }))
    .filter((s) => s.weight > 0 && s.reps > 0);

  if (validSets.length === 0) return null;

  // Parse target reps — take the lower bound of ranges like "8-10"
  const targetRepsNum = parseInt(targetReps.split("-")[0]) || 8;

  // Step 1: Epley e1RM per set — used to rank performance
  const setsWithE1RM = validSets.map((s) => ({ ...s, e1RM: s.weight * (1 + s.reps / 30) }));

  // Step 2: Worst set = lowest e1RM (the bottleneck set)
  const worstSet = setsWithE1RM.reduce((min, s) => (s.e1RM < min.e1RM ? s : min));

  // Average weight across all valid sets
  const averageWeight = validSets.reduce((sum, s) => sum + s.weight, 0) / validSets.length;

  const isCompound = LARGE_COMPOUND_KEYWORDS.some((kw) =>
    exerciseName.toLowerCase().includes(kw)
  );
  const increment = isCompound ? 2.5 : 1.25;

  // Minimum sensible weight: barbell exercises start at 20 kg (empty bar)
  const minWeight = exerciseName.toLowerCase().includes("barbell") ? 20 : 0;

  let recommendedWeight: number;
  let reason: string;
  let confidence: WeightRecommendation["confidence"];

  const worstReps = worstSet.reps;

  if (worstReps >= targetRepsNum + 2) {
    recommendedWeight = roundToStep(averageWeight + increment, 1.25);
    reason = `All sets hit ${worstReps}+ reps — add ${increment} kg`;
    confidence = "increase";
  } else if (worstReps >= targetRepsNum) {
    recommendedWeight = roundToStep(averageWeight, 1.25);
    reason = `Worst set hit ${worstReps} reps — keep weight stable`;
    confidence = "hold";
  } else if (worstReps >= targetRepsNum - 2) {
    recommendedWeight = roundToStep(averageWeight - increment * 0.5, 1.25);
    reason = `Worst set dropped to ${worstReps} reps — slight deload`;
    confidence = "decrease";
  } else {
    recommendedWeight = roundToStep(averageWeight * 0.95, 1.25);
    reason = `Worst set hit only ${worstReps} reps — reduce weight`;
    confidence = "decrease";
  }

  recommendedWeight = Math.max(recommendedWeight, minWeight);

  return { recommendedWeight, reason, confidence };
}

export interface ExerciseProgress {
  exerciseId: string;
  sets: SetData[];
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
      id: "barbell-rows",
      name: "Barbell Bent-Over Row",
      muscleGroup: "Back",
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
      id: "lat-pulldowns",
      name: "Wide-Grip Lat Pulldown",
      muscleGroup: "Back",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "bicep-curls",
      name: "Bicep Curls",
      muscleGroup: "Biceps",
      sets: 3,
      reps: "10-12",
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
  "Full Body": [
    {
      id: "squats",
      name: "Barbell Back Squat",
      muscleGroup: "Quads",
      sets: 3,
      reps: "8-10",
    },
    {
      id: "bench-press",
      name: "Barbell Bench Press",
      muscleGroup: "Chest",
      sets: 3,
      reps: "8-10",
    },
    {
      id: "barbell-rows",
      name: "Barbell Bent-Over Row",
      muscleGroup: "Back",
      sets: 3,
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
      id: "romanian-deadlift",
      name: "Romanian Deadlift",
      muscleGroup: "Hamstrings",
      sets: 3,
      reps: "8-10",
    },
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
 * Returns the exercise list for a given equipment type and split-day name.
 * Guaranteed to return valid exercises — falls back gracefully.
 * This is the single authoritative source of truth for equipment filtering
 * in the native onboarding flow.
 */
export function getEquipmentExercises(
  equipment: Equipment | null | undefined,
  dayName: string
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
      pool = DEFAULT_EXERCISES;
  }
  return pool[dayName] ?? pool["Full Body"] ?? DEFAULT_EXERCISES["Full Body"];
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

export function generateDefaultPlan(
  daysPerWeek: number,
  name: string = "My Workout Plan"
): WorkoutPlan {
  const splitDays = SPLIT_RECOMMENDATIONS[daysPerWeek] ?? ["Full Body"];

  // Track how many Full Body days we have assigned so far.
  // Each Full Body day gets a unique dayIndex so it draws from a different
  // variation slot — no exercise repeats across Full Body days in the week.
  let fullBodyCount = 0;

  const days: WorkoutDay[] = splitDays.map((dayName) => {
    if (dayName === "Full Body") {
      const exercises = buildFullBodyDay(fullBodyCount);
      fullBodyCount += 1;
      return { dayName, exercises };
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
