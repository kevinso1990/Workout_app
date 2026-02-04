import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: "onboarding_complete",
  USER_PREFERENCES: "user_preferences",
  WORKOUT_PLANS: "workout_plans",
  WORKOUT_HISTORY: "workout_history",
};

export interface UserPreferences {
  workoutDaysPerWeek: number;
  splitPreference: "choose" | "recommended";
  exercisePreference: "choose" | "default";
  cardioDays?: string[];
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
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

export function calculateProgressionWeight(
  lastWeight: number,
  lastRating: "green" | "yellow" | "red" | null
): { suggestedWeight: number; message: string } {
  if (!lastRating || lastWeight === 0) {
    return { suggestedWeight: lastWeight, message: "Same as last time" };
  }

  switch (lastRating) {
    case "green":
      const increase = lastWeight < 20 ? 2.5 : lastWeight < 50 ? 2.5 : 5;
      return {
        suggestedWeight: lastWeight + increase,
        message: `+${increase}kg - Last set felt easy!`,
      };
    case "yellow":
      return {
        suggestedWeight: lastWeight,
        message: "Maintain weight - Good effort",
      };
    case "red":
      const decrease = lastWeight < 20 ? 2.5 : 5;
      return {
        suggestedWeight: Math.max(0, lastWeight - decrease),
        message: `${decrease > 0 ? "-" + decrease + "kg" : "Same"} - Take it easier`,
      };
    default:
      return { suggestedWeight: lastWeight, message: "Same as last time" };
  }
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
      name: "Bench Press",
      muscleGroup: "Chest",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "overhead-press",
      name: "Overhead Press",
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
      name: "Lateral Raises",
      muscleGroup: "Shoulders",
      sets: 3,
      reps: "12-15",
    },
    {
      id: "tricep-pushdowns",
      name: "Tricep Pushdowns",
      muscleGroup: "Triceps",
      sets: 3,
      reps: "10-12",
    },
  ],
  Pull: [
    {
      id: "deadlift",
      name: "Deadlift",
      muscleGroup: "Back",
      sets: 4,
      reps: "5-6",
    },
    {
      id: "barbell-rows",
      name: "Barbell Rows",
      muscleGroup: "Back",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "lat-pulldowns",
      name: "Lat Pulldowns",
      muscleGroup: "Back",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "face-pulls",
      name: "Face Pulls",
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
      name: "Squats",
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
      name: "Leg Press",
      muscleGroup: "Quads",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "leg-curls",
      name: "Leg Curls",
      muscleGroup: "Hamstrings",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "calf-raises",
      name: "Calf Raises",
      muscleGroup: "Calves",
      sets: 4,
      reps: "12-15",
    },
  ],
  Upper: [
    {
      id: "bench-press",
      name: "Bench Press",
      muscleGroup: "Chest",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "barbell-rows",
      name: "Barbell Rows",
      muscleGroup: "Back",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "overhead-press",
      name: "Overhead Press",
      muscleGroup: "Shoulders",
      sets: 3,
      reps: "8-10",
    },
    {
      id: "lat-pulldowns",
      name: "Lat Pulldowns",
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
      name: "Squats",
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
      name: "Leg Press",
      muscleGroup: "Quads",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "leg-curls",
      name: "Leg Curls",
      muscleGroup: "Hamstrings",
      sets: 3,
      reps: "10-12",
    },
    {
      id: "calf-raises",
      name: "Calf Raises",
      muscleGroup: "Calves",
      sets: 4,
      reps: "12-15",
    },
  ],
  "Full Body": [
    {
      id: "squats",
      name: "Squats",
      muscleGroup: "Quads",
      sets: 3,
      reps: "8-10",
    },
    {
      id: "bench-press",
      name: "Bench Press",
      muscleGroup: "Chest",
      sets: 3,
      reps: "8-10",
    },
    {
      id: "barbell-rows",
      name: "Barbell Rows",
      muscleGroup: "Back",
      sets: 3,
      reps: "8-10",
    },
    {
      id: "overhead-press",
      name: "Overhead Press",
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
      name: "Bench Press",
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
      name: "Deadlift",
      muscleGroup: "Back",
      sets: 4,
      reps: "5-6",
    },
    {
      id: "barbell-rows",
      name: "Barbell Rows",
      muscleGroup: "Back",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "lat-pulldowns",
      name: "Lat Pulldowns",
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
      name: "Overhead Press",
      muscleGroup: "Shoulders",
      sets: 4,
      reps: "8-10",
    },
    {
      id: "lateral-raises",
      name: "Lateral Raises",
      muscleGroup: "Shoulders",
      sets: 4,
      reps: "12-15",
    },
    {
      id: "face-pulls",
      name: "Face Pulls",
      muscleGroup: "Rear Delts",
      sets: 3,
      reps: "12-15",
    },
    {
      id: "front-raises",
      name: "Front Raises",
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
      name: "Tricep Pushdowns",
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

export const SPLIT_RECOMMENDATIONS: Record<number, string[]> = {
  1: ["Full Body"],
  2: ["Upper", "Lower"],
  3: ["Push", "Pull", "Legs"],
  4: ["Upper", "Lower", "Upper", "Lower"],
  5: ["Push", "Pull", "Legs", "Upper", "Lower"],
  6: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"],
  7: ["Push", "Pull", "Legs", "Upper", "Lower", "Full Body", "Full Body"],
};

export function generateDefaultPlan(
  daysPerWeek: number,
  name: string = "My Workout Plan"
): WorkoutPlan {
  const splitDays = SPLIT_RECOMMENDATIONS[daysPerWeek] || ["Full Body"];

  const days: WorkoutDay[] = splitDays.map((dayName) => ({
    dayName,
    exercises: DEFAULT_EXERCISES[dayName] || DEFAULT_EXERCISES["Full Body"],
  }));

  return {
    id: Date.now().toString(),
    name,
    daysPerWeek,
    days,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  };
}
