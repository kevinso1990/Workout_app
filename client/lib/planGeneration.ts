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
import { setPlanGenerationFallbackNotice } from "@/lib/planGenerationFallback";

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
};

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

function classifyGenerationError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429") || msg.toLowerCase().includes("rate")) return "rate_limit";
  if (msg.includes("AbortError") || msg.toLowerCase().includes("timeout")) {
    return "timeout";
  }
  if (msg.includes("Failed to fetch") || msg.toLowerCase().includes("network")) {
    return "network";
  }
  return "server";
}

async function fetchAiGeneratedPlan(
  input: GenerateWorkoutPlanInput,
): Promise<WorkoutPlan | null> {
  const body = {
    frequency: input.frequency,
    experience: input.experience,
    goal: input.goal,
    equipment: mapNativeEquipmentToApi(input.equipment),
    focusMuscles: input.focusMuscles ?? [],
    splitPreference: input.splitId,
    ...(input.goalText ? { goalText: input.goalText } : {}),
  };

  if (__DEV__) {
    console.info("[planGeneration] POST /api/plans/auto-generate", body);
  }

  const { planIds } = await nativeRequest<{ planIds: number[] }>(
    "/api/plans/auto-generate",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  if (!Array.isArray(planIds) || planIds.length === 0) return null;

  const apiPlans = await Promise.all(
    planIds.map((id) =>
      nativeRequest<ApiPlanWithExercises>(`/api/plans/${id}`),
    ),
  );

  if (apiPlans.some((p) => !p?.exercises?.length)) return null;

  return mergeApiPlansIntoWorkoutPlan(apiPlans, {
    planName: input.planName ?? "My Workout Plan",
    daysPerWeek: input.frequency,
  });
}

function buildLocalFallbackPlan(input: GenerateWorkoutPlanInput): WorkoutPlan {
  if (input.splitId) {
    return buildOnboardingPlan(
      input.splitId,
      input.frequency,
      input.equipment,
      input.experience,
    );
  }

  return generateEquipmentAwarePlan(
    input.frequency,
    input.planName ?? "My Workout Plan",
    input.equipment,
    input.experience,
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
    await setPlanGenerationFallbackNotice("empty_response");
  } catch (err) {
    const reason = classifyGenerationError(err);
    console.warn(
      "[planGeneration] API generation failed, using local template:",
      err instanceof Error ? err.message : err,
    );
    await setPlanGenerationFallbackNotice(reason);
  }

  return {
    plan: buildLocalFallbackPlan(input),
    source: "template",
  };
}
