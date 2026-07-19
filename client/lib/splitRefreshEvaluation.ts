import {
  isStrengthSession,
  type WorkoutPlan,
  type WorkoutSession,
} from "@/lib/storage";
import { fetchSplitAge } from "@/lib/splitRefreshApi";
import { isSplitRefreshSnoozed } from "@/lib/splitRefreshSnooze";
import {
  detectSplitPatternMismatch,
  SPLIT_REFRESH_MIN_SESSIONS,
  SPLIT_REFRESH_WEEKS_THRESHOLD,
} from "../../shared/splitRefreshPattern";

export { SPLIT_REFRESH_MIN_SESSIONS, SPLIT_REFRESH_WEEKS_THRESHOLD };

export type SplitRefreshOffer = {
  plan: WorkoutPlan;
  planName: string;
  weeksOnPlan: number;
  patternSummary: string;
  hasPatternMismatch: boolean;
};

function primaryPlan(
  plans: WorkoutPlan[],
  history: WorkoutSession[],
): WorkoutPlan | null {
  const strength = history.filter(isStrengthSession);
  const counts = new Map<string, number>();
  for (const s of strength) {
    counts.set(s.planId, (counts.get(s.planId) ?? 0) + 1);
  }
  let topId = "";
  let top = 0;
  for (const [id, n] of counts) {
    if (n > top) {
      top = n;
      topId = id;
    }
  }
  return plans.find((p) => p.id === topId) ?? plans[0] ?? null;
}

/**
 * Returns a split-refresh offer when the athlete has enough history and either
 * the server age threshold fires or local session patterns diverge from the plan.
 */
export async function evaluateSplitRefreshOffer(
  plans: WorkoutPlan[],
  history: WorkoutSession[],
  adaptationBannerActive: boolean,
): Promise<SplitRefreshOffer | null> {
  if (adaptationBannerActive) return null;
  if (plans.length === 0) return null;
  if (await isSplitRefreshSnoozed()) return null;

  const plan = primaryPlan(plans, history);
  if (!plan) return null;

  const sessionsOnPlan = history.filter(
    (s) => isStrengthSession(s) && s.planId === plan.id,
  );
  if (sessionsOnPlan.length < SPLIT_REFRESH_MIN_SESSIONS) return null;

  const { mismatch, summary } = detectSplitPatternMismatch(
    plan,
    sessionsOnPlan.map((s) => ({
      planId: s.planId,
      dayName: s.dayName,
      completedAt: s.completedAt,
      exercises: s.exercises.map((e) => ({
        id: e.id,
        muscleGroup: e.muscleGroup,
        sets: e.sets,
      })),
      exerciseProgress: s.exerciseProgress,
    })),
  );

  let weeksOnPlan = 0;
  let serverPrompt = false;
  let planName = plan.name;

  try {
    const splitAge = await fetchSplitAge(SPLIT_REFRESH_WEEKS_THRESHOLD);
    if (splitAge) {
      weeksOnPlan = splitAge.weeksOnPlan;
      serverPrompt = splitAge.shouldPrompt;
      planName = splitAge.planName || plan.name;
    }
  } catch {
    const first = sessionsOnPlan
      .map((s) => new Date(s.completedAt).getTime())
      .sort((a, b) => a - b)[0];
    const last = sessionsOnPlan
      .map((s) => new Date(s.completedAt).getTime())
      .sort((a, b) => b - a)[0];
    if (first && last) {
      weeksOnPlan = Math.floor((last - first) / (7 * 24 * 60 * 60 * 1000));
      serverPrompt = weeksOnPlan >= SPLIT_REFRESH_WEEKS_THRESHOLD;
    }
  }

  if (!serverPrompt && !mismatch) return null;

  return {
    plan,
    planName,
    weeksOnPlan,
    patternSummary: summary || `training ${planName} for ${weeksOnPlan} weeks`,
    hasPatternMismatch: mismatch,
  };
}
