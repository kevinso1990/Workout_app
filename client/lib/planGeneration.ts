import type {
  Equipment,
  FitnessGoal,
  FitnessLevel,
  WorkoutDay,
  WorkoutPlan,
} from "@/lib/storage";
import { generateEquipmentAwarePlan } from "@/lib/storage";
import {
  buildOnboardingPlan,
  type MuscleGroup,
} from "@/lib/onboardingUtils";
import { mapNativeEquipmentToApi } from "@/lib/equipmentApiMap";
import { nativeRequest } from "@/lib/nativeApi";
import {
  describeCommitmentsForPrompt,
  type WeeklyCommitment,
} from "@shared/weeklySchedule";

type ApiPlanExercise = {
  exercise_id: number;
  sort_order: number;
  name: string;
  muscle_group: string;
  default_sets: number;
  default_reps: number;
  default_weight: number;
  equipment?: string;
};

type ApiPlanWithExercises = {
  id: number;
  name: string;
  created_at: string;
  exercises: ApiPlanExercise[];
};

export type GenerateWorkoutPlanInput = {
  frequency: number;
  experience: FitnessLevel;
  goal: FitnessGoal;
  equipment: Equipment | null;
  focusMuscles?: MuscleGroup[];
  planName?: string;
  /** Native onboarding split id — sent to API as splitPreference. */
  splitId?: string;
  /** Free-text goal ("improve hip mobility") from the AI-goal feature. */
  goalText?: string;
  /**
   * Fixed weekly sport commitments. Two effects: the requested frequency can
   * never exceed the days actually left free, and the model is told what the
   * strength plan has to coexist with (a week with two court-sport days should
   * not also carry maximal lower-body volume).
   */
  commitments?: WeeklyCommitment[];
  /** Exercise names to exclude — see shared/avoidExercises.ts. */
  avoidExercises?: string[];
};

/**
 * Gym sessions can only go on days no sport already occupies. Asking for six
 * sessions with three sport days would generate a plan that cannot be placed,
 * so the request is capped instead of failing later at scheduling time.
 */
export function maxGymSessionsPerWeek(commitments?: WeeklyCommitment[]): number {
  const takenDays = new Set((commitments ?? []).map((c) => c.weekday));
  return Math.max(1, 7 - takenDays.size);
}

export type GenerateWorkoutPlanResult = {
  plan: WorkoutPlan;
  source: "ai" | "template";
};

function apiPlanToWorkoutDay(apiPlan: ApiPlanWithExercises): WorkoutDay {
  const exercises = [...(apiPlan.exercises ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return {
    dayName: apiPlan.name,
    exercises: exercises.map((pe) => ({
      id: String(pe.exercise_id),
      name: pe.name,
      muscleGroup: pe.muscle_group,
      sets: pe.default_sets,
      reps: String(pe.default_reps),
      targetReps: pe.default_reps,
      targetWeight:
        pe.default_weight > 0 ? pe.default_weight : undefined,
      equipment: pe.equipment ?? null,
    })),
  };
}

function mergeApiPlansIntoWorkoutPlan(
  apiPlans: ApiPlanWithExercises[],
  opts: { planName: string; daysPerWeek: number },
): WorkoutPlan {
  const now = new Date().toISOString();
  return {
    id: Date.now().toString(),
    name: opts.planName,
    daysPerWeek: opts.daysPerWeek,
    days: apiPlans.map(apiPlanToWorkoutDay),
    createdAt: now,
    lastModified: now,
  };
}

export async function fetchAiGeneratedPlan(
  input: GenerateWorkoutPlanInput,
): Promise<WorkoutPlan | null> {
  const commitmentsText = describeCommitmentsForPrompt(input.commitments ?? []);
  const body = {
    frequency: Math.min(input.frequency, maxGymSessionsPerWeek(input.commitments)),
    experience: input.experience,
    goal: input.goal,
    equipment: mapNativeEquipmentToApi(input.equipment),
    focusMuscles: input.focusMuscles ?? [],
    splitPreference: input.splitId,
    ...(input.goalText ? { goalText: input.goalText } : {}),
    ...(commitmentsText ? { commitmentsText } : {}),
    ...(input.avoidExercises?.length ? { avoidExercises: input.avoidExercises } : {}),
  };

  if (__DEV__) {
    console.info("[planGeneration] POST /api/plans/auto-generate", body);
  }

  // AI plan generation (Claude, multi-day) legitimately runs 20-40s — well past
  // the default 20s request timeout. Give it 75s so the client waits for the
  // real plan instead of aborting and falling back to a generic template.
  const { planIds, planName: aiPlanName } = await nativeRequest<{
    planIds: number[];
    planName?: string;
  }>(
    "/api/plans/auto-generate",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    75_000,
  );

  if (!Array.isArray(planIds) || planIds.length === 0) return null;

  const apiPlans = await Promise.all(
    planIds.map((id) =>
      nativeRequest<ApiPlanWithExercises>(`/api/plans/${id}`),
    ),
  );

  if (apiPlans.some((p) => !p?.exercises?.length)) return null;

  // For a free-text goal, prefer the AI's clean plan title (a noun phrase in the
  // goal's language) over the raw goal sentence the user typed. Cap the length
  // so a runaway title can't break the UI; fall back to the caller's name.
  const cleanAiName = aiPlanName?.trim();
  const resolvedName =
    input.goalText && cleanAiName && cleanAiName.length <= 60
      ? cleanAiName
      : input.planName ?? "My Workout Plan";

  return mergeApiPlansIntoWorkoutPlan(apiPlans, {
    planName: resolvedName,
    daysPerWeek: input.frequency,
  });
}

/**
 * The deterministic plan, built from the same answers the AI would get. Named
 * "local" rather than "fallback" because template-first makes this the plan the
 * user actually starts with, not a consolation prize for a failed request.
 */
export function buildLocalPlan(input: GenerateWorkoutPlanInput): WorkoutPlan {
  if (input.splitId) {
    return buildOnboardingPlan(
      input.splitId,
      input.frequency,
      input.equipment,
      input.experience,
      undefined,
      input.avoidExercises,
    );
  }

  return generateEquipmentAwarePlan(
    input.frequency,
    input.planName ?? "My Workout Plan",
    input.equipment,
    input.experience,
    input.avoidExercises,
  );
}

/**
 * Generates a workout plan via Gemini-backed API (template fallback on server),
 * then saves-ready native shape. Falls back to local templates when offline.
 */
export async function generateWorkoutPlan(
  input: GenerateWorkoutPlanInput,
): Promise<GenerateWorkoutPlanResult> {
  try {
    const fromApi = await fetchAiGeneratedPlan(input);
    if (fromApi) {
      return { plan: fromApi, source: "ai" };
    }
  } catch (err) {
    console.warn(
      "[planGeneration] API generation failed, using local template:",
      err instanceof Error ? err.message : err,
    );
  }

  return {
    plan: buildLocalPlan(input),
    source: "template",
  };
}
