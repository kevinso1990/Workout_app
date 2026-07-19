import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  isStrengthSession,
  type WorkoutPlan,
  type WorkoutSession,
} from "@/lib/storage";
import {
  detectPerformanceSignals,
  formatSignalsForPrompt,
  type PerformanceSignal,
} from "../../shared/signalDetection";

export type { PerformanceSignal } from "../../shared/signalDetection";
export { detectPerformanceSignals, formatSignalsForPrompt };

const SNOOZE_UNTIL_KEY = "plan_adaptation_snooze_until_v1";
const MIN_STRENGTH_SESSIONS = 6;
const MIN_SESSIONS_ON_PLAN = 4;
const MIN_PLAN_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type PlanAdaptationOffer = {
  offer: boolean;
  plan: WorkoutPlan | null;
  signals: PerformanceSignal[];
};

export async function snoozePlanAdaptation(days = 14): Promise<void> {
  const until = new Date();
  until.setDate(until.getDate() + days);
  await AsyncStorage.setItem(SNOOZE_UNTIL_KEY, until.toISOString());
}

async function isSnoozed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(SNOOZE_UNTIL_KEY);
  if (!raw) return false;
  return new Date(raw) > new Date();
}

function primaryPlanFromHistory(
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
 * True when the athlete has enough history on a stable plan to benefit from
 * an AI adaptation pass (closed feedback loop entry point).
 */
export async function evaluatePlanAdaptationOffer(
  plans: WorkoutPlan[],
  history: WorkoutSession[],
): Promise<PlanAdaptationOffer> {
  const empty = { offer: false, plan: null, signals: [] as PerformanceSignal[] };
  if (plans.length === 0) return empty;
  if (await isSnoozed()) return empty;

  const strength = history.filter(isStrengthSession);
  if (strength.length < MIN_STRENGTH_SESSIONS) {
    return empty;
  }

  const plan = primaryPlanFromHistory(plans, history);
  if (!plan) return empty;

  const sessionsOnPlan = strength.filter((s) => s.planId === plan.id);
  if (sessionsOnPlan.length < MIN_SESSIONS_ON_PLAN) {
    return empty;
  }

  const planAge = Date.now() - new Date(plan.createdAt).getTime();
  if (planAge < MIN_PLAN_AGE_MS) {
    return empty;
  }

  const signals = detectPerformanceSignals(plan, sessionsOnPlan);
  if (signals.length === 0) {
    return empty;
  }

  return { offer: true, plan, signals };
}

/** Performance digest sent to the adapt-plan coach endpoint. */
export function buildPlanAdaptationSummary(
  plan: WorkoutPlan,
  history: WorkoutSession[],
): string {
  const planSessions = history
    .filter(isStrengthSession)
    .filter((s) => s.planId === plan.id)
    .sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
    )
    .slice(0, 12);

  const lines: string[] = [
    `Plan: ${plan.name} (${plan.daysPerWeek} days/week, ${plan.days.length} training days)`,
    `Sessions logged on this plan: ${planSessions.length}`,
    "",
    "Recent sessions:",
  ];

  for (const s of planSessions) {
    const setLines: string[] = [];
    for (const ep of s.exerciseProgress ?? []) {
      const ex = s.exercises.find((e) => e.id === ep.exerciseId);
      const name = ex?.name ?? ep.exerciseId;
      const done = ep.sets.filter((st) => st.completed !== false);
      if (done.length === 0) continue;
      const best = done.reduce((a, st) => {
        const w = parseFloat(st.weight) || 0;
        const r = parseInt(st.reps, 10) || 0;
        return w > a.w ? { w, r } : a;
      }, { w: 0, r: 0 });
      const rating = done.find((st) => st.rating)?.rating ?? "none";
      setLines.push(`  ${name}: best ${best.w}kg×${best.r} (feedback: ${rating})`);
    }
    lines.push(
      `${(s.completedAt || "").slice(0, 10)} — ${s.dayName}`,
      ...setLines,
      "",
    );
  }

  return lines.join("\n").slice(0, 7500);
}
