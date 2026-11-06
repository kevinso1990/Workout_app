import { nativeRequest } from "@/lib/nativeApi";
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
  /** Language of the summary/changes shown to the athlete (the editor defaults to English). */
  language?: string,
): Promise<PlanModifyResponse> {
  // /api/plans/* sits behind requireAuth. A plain fetch without the guest JWT
  // got 401 for every guest — the adapt/split-refresh banners and coach chat
  // proposals could never apply. nativeRequest attaches (and refreshes) it.
  const body = {
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
    instruction: language?.startsWith("de")
      ? `${instruction}\n\nWrite "summary" and "changes" in German (du-form). Keep exercise names as they are.`
      : instruction,
  };
  try {
    return await nativeRequest<PlanModifyResponse>(
      "/api/plans/modify",
      { method: "POST", headers: { ...IMPORT_JSON_HEADERS }, body: JSON.stringify(body) },
      60_000,
    );
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    let message = raw;
    try {
      message = (JSON.parse(raw) as { error?: string }).error ?? raw;
    } catch {
      // not JSON — keep the text
    }
    throw new Error(message || "AI Coach failed");
  }
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
