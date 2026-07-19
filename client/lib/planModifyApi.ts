import { getApiUrl } from "@/lib/query-client";
import { IMPORT_JSON_HEADERS } from "@/lib/importApiHeaders";
import type { WorkoutPlan } from "@/lib/storage";

export type PlanModifyResponse = {
  planName: string;
  days: Array<{
    dayName: string;
    exercises: Array<{
      name: string;
      sets: number;
      reps: string;
      muscleGroup: string;
      notes: string | null;
      catalogExerciseId: number | null;
    }>;
  }>;
  summary: string;
  changes: string[];
};

export async function requestPlanModify(
  plan: WorkoutPlan,
  instruction: string,
): Promise<PlanModifyResponse> {
  const url = new URL("/api/plans/modify", getApiUrl()).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { ...IMPORT_JSON_HEADERS },
    body: JSON.stringify({
      plan: {
        name: plan.name,
        days: plan.days.map((d) => ({
          dayName: d.dayName,
          exercises: d.exercises.map((e) => ({
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            muscleGroup: e.muscleGroup,
          })),
        })),
      },
      instruction,
    }),
  });

  const text = await res.text();
  let data: PlanModifyResponse & { error?: string };
  try {
    data = JSON.parse(text) as PlanModifyResponse & { error?: string };
  } catch {
    throw new Error(`AI Coach failed (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(data.error ?? `AI Coach failed (${res.status})`);
  }

  return data;
}

export function applyModifyResultToPlan(
  existing: WorkoutPlan,
  result: PlanModifyResponse,
): WorkoutPlan {
  return {
    ...existing,
    name: result.planName?.trim() || existing.name,
    daysPerWeek: result.days.length,
    days: result.days.map((day, dIdx) => ({
      dayName: day.dayName,
      exercises: day.exercises.map((ex, idx) => ({
        id: `${existing.id}-coach-${dIdx}-${idx}-${Date.now()}`,
        name: ex.name,
        muscleGroup: ex.muscleGroup || "Full Body",
        sets: ex.sets,
        reps: ex.reps,
        targetReps: parseInt(String(ex.reps).match(/\d+/)?.[0] ?? "10", 10),
      })),
    })),
    lastModified: new Date().toISOString(),
  };
}
