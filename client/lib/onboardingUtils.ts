import {
  getEquipmentExercises,
  type WorkoutDay,
  type WorkoutPlan,
} from "./storage";

export type FitnessLevel = "beginner" | "intermediate" | "advanced";
export type FitnessGoal = "build_muscle" | "lose_fat" | "get_stronger";
export type Equipment = "full_gym" | "dumbbells_only" | "home_minimal" | "bodyweight" | "kettlebell";
export type MuscleGroup = "chest" | "back" | "shoulders" | "arms" | "legs" | "core";

/**
 * All available workout split options. Shared between SplitSelectionScreen and
 * buildOnboardingPlan so there is a single source of truth.
 */
export const SPLIT_OPTIONS = [
  {
    id: "push-pull-legs",
    name: "Push / Pull / Legs",
    description: "Classic 3-day split focusing on movement patterns",
    days: ["Push", "Pull", "Legs"],
    minDays: 3,
    icon: "layers",
  },
  {
    id: "upper-lower",
    name: "Upper / Lower",
    description: "Efficient 2-day split for balanced development",
    days: ["Upper", "Lower"],
    minDays: 2,
    icon: "maximize-2",
  },
  {
    id: "full-body",
    name: "Full Body",
    description: "Hit every muscle group each session",
    days: ["Full Body"],
    minDays: 1,
    icon: "user",
  },
  {
    id: "bro-split",
    name: "Body Part Split",
    description: "Dedicate each day to specific muscle groups",
    days: ["Chest", "Back", "Shoulders", "Arms", "Legs"],
    minDays: 5,
    icon: "target",
  },
] as const;

export type SplitOption = (typeof SPLIT_OPTIONS)[number];

/**
 * Returns the split id that best matches the user's experience, goals and
 * training frequency. Used in SplitSelectionScreen both to pre-select a plan
 * and to show the "Recommended" badge.
 *
 * Priority rules (most important first):
 *  - Beginners always start on Full Body (≤3 days) or Upper/Lower (4 days)
 *  - "Get Stronger" prioritises compound-heavy splits (Full Body / PPL)
 *  - Intermediate: PPL at 3+ days, Upper/Lower at 4 days
 *  - Advanced: Bro Split at 5+ days, PPL otherwise
 */
export function getRecommendedSplit(
  fitnessLevel: FitnessLevel | null,
  days: number,
  goals: string[],
): string {
  const level = fitnessLevel ?? "beginner";

  if (level === "beginner") {
    if (days <= 3) return "full-body";
    if (days === 4) return "upper-lower";
    return "push-pull-legs";
  }

  if (goals.includes("get_stronger")) {
    if (days <= 3) return "full-body";
    if (days === 4) return "upper-lower";
    return "push-pull-legs";
  }

  if (level === "intermediate") {
    if (days <= 2) return "full-body";
    if (days === 3) return "push-pull-legs";
    if (days === 4) return "upper-lower";
    return "push-pull-legs";
  }

  if (days <= 2) return "full-body";
  if (days <= 4) return "push-pull-legs";
  return "bro-split";
}

/**
 * Returns the indices of progress dots that are filled/active for a given
 * onboarding screen. The ProgressBar renders `total` dots and highlights
 * the first `step` of them (indices 0 to step-1).
 */
export function getActiveProgressDotIndices(step: number, total: number): number[] {
  return Array.from({ length: total }, (_, i) => i).filter((i) => i < step);
}

/**
 * Returns true when the user has made enough selections on the Equipment
 * screen to advance to the next step.
 */
export function canAdvanceFromEquipment(equipment: Equipment | null): boolean {
  return equipment !== null;
}

/**
 * Returns true when the user has made enough selections on the Goals screen
 * to advance to the next step. At least one goal is required.
 */
export function canAdvanceFromGoals(goals: FitnessGoal[]): boolean {
  return goals.length > 0;
}

/**
 * Returns true when the user has made enough selections on the Fitness Level
 * screen to advance to the next step.
 */
export function canAdvanceFromFitnessLevel(level: FitnessLevel | null): boolean {
  return level !== null;
}

/**
 * Focus Muscles is optional — the user can always advance (via Continue or
 * Skip for now), regardless of whether any muscles are selected.
 */
export function canAdvanceFromFocusMuscles(_muscles: MuscleGroup[]): boolean {
  return true;
}

/**
 * Builds a WorkoutPlan from the user's onboarding selections.
 * This is the production plan-building logic used by SplitSelectionScreen
 * when the user taps "Create My Plan".
 */
export function buildOnboardingPlan(
  splitId: string,
  daysPerWeek: number,
  equipment: Equipment | null,
  fitnessLevel: FitnessLevel | null,
  planId: string = Date.now().toString(),
): WorkoutPlan {
  const selectedSplitOption = SPLIT_OPTIONS.find((s) => s.id === splitId);
  if (!selectedSplitOption) {
    throw new Error(`Unknown split id: ${splitId}`);
  }

  const splitDays: string[] = [];
  for (let i = 0; i < daysPerWeek; i++) {
    splitDays.push(selectedSplitOption.days[i % selectedSplitOption.days.length]);
  }

  const totalFbDays = splitDays.filter((d) => d === "Full Body").length;
  const FB_VARIANTS = ["A", "B", "C"] as const;
  let fbCount = 0;

  const days: WorkoutDay[] = splitDays.map((dayName) => {
    if (dayName === "Full Body") {
      const variantLabel =
        totalFbDays > 1
          ? `Full Body ${FB_VARIANTS[fbCount % 3]}`
          : "Full Body";
      fbCount++;
      return {
        dayName: variantLabel,
        exercises: getEquipmentExercises(equipment, variantLabel, fitnessLevel),
      };
    }
    return {
      dayName,
      exercises: getEquipmentExercises(equipment, dayName, fitnessLevel),
    };
  });

  const now = new Date().toISOString();
  return {
    id: planId,
    name: "My Workout Plan",
    daysPerWeek,
    days,
    createdAt: now,
    lastModified: now,
  };
}
