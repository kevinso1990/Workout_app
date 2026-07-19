import { nativeRequest } from "@/lib/nativeApi";
import type { WorkoutPlan } from "@/lib/storage";
import type { PlanModifyResponse } from "@/lib/planModifyApi";
import type { PerformanceSignal } from "../../shared/signalDetection";

function planToApiPayload(plan: WorkoutPlan) {
  return {
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
  };
}

export async function requestPlanAdaptation(
  plan: WorkoutPlan,
  performanceSummary: string,
  performanceSignals: PerformanceSignal[],
  locale: "de" | "en",
): Promise<PlanModifyResponse> {
  return nativeRequest<PlanModifyResponse>("/api/coach/adapt-plan", {
    method: "POST",
    body: JSON.stringify({
      plan: planToApiPayload(plan),
      performanceSummary,
      performanceSignals,
      locale,
    }),
  });
}
