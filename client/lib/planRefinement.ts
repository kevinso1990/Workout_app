/**
 * Template-first plan creation.
 *
 * The old flow made the user wait for the AI: up to 75s, after which a failed
 * or slow generation handed them a generic template anyway, announced as a
 * failure. That is the worst of both — a long wait AND a worse plan.
 *
 * This inverts it. The deterministic generator already produces a sound plan
 * from the same inputs, instantly and offline, so that is what the user gets.
 * The AI then runs in the background and improves the plan in place if it can.
 * An AI outage stops being a degraded experience and becomes invisible: the
 * user already has a plan they can train with, so there is nothing to apologise
 * for and no notice worth showing.
 *
 * What it must never do is overwrite work. See shared/planRefinementPolicy.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getWorkoutHistory,
  getWorkoutPlans,
  saveWorkoutPlan,
  type WorkoutPlan,
} from "@/lib/storage";
import { decideRefinement } from "@shared/planRefinementPolicy";

import {
  buildLocalPlan,
  fetchAiGeneratedPlan,
  type GenerateWorkoutPlanInput,
} from "@/lib/planGeneration";

const PENDING_KEY = "plan_refinement_pending_v1";

export type PendingRefinement = {
  planId: string;
  planName: string;
  /** The refined plan, held until the user accepts or dismisses it. */
  plan: WorkoutPlan;
  createdAt: string;
};

export async function peekPendingRefinement(): Promise<PendingRefinement | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingRefinement) : null;
  } catch {
    return null;
  }
}

export async function clearPendingRefinement(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_KEY);
}

/** Accept a refinement the user was offered; returns false if it went stale. */
export async function acceptPendingRefinement(): Promise<boolean> {
  const pending = await peekPendingRefinement();
  if (!pending) return false;
  const plans = await getWorkoutPlans();
  const current = plans.find((p) => p.id === pending.planId);
  await clearPendingRefinement();
  if (!current) return false;
  await saveWorkoutPlan({
    ...pending.plan,
    id: current.id,
    createdAt: current.createdAt,
    lastModified: new Date().toISOString(),
  });
  return true;
}

/**
 * Build a plan the user can start with right now — no network, no waiting.
 */
export function createPlanInstantly(input: GenerateWorkoutPlanInput): WorkoutPlan {
  return buildLocalPlan(input);
}

type RefinementResult = "applied" | "offered" | "dropped" | "failed";

/**
 * Ask the AI to improve an already-saved plan, and apply the result only if the
 * plan is still untouched. Deliberately does not throw: this runs detached from
 * any screen, and a failure here must stay silent — the user already has their
 * plan, and an error toast about an improvement they never requested would be
 * noise about a problem they do not have.
 */
export async function refinePlanInBackground(
  planId: string,
  input: GenerateWorkoutPlanInput,
  lastModifiedAtRequest: string,
  onApplied?: (plan: WorkoutPlan) => void,
): Promise<RefinementResult> {
  let refined: WorkoutPlan | null = null;
  try {
    refined = await fetchAiGeneratedPlan(input);
  } catch (err) {
    console.info(
      "[planRefinement] AI refinement unavailable, keeping the template plan:",
      err instanceof Error ? err.message : err,
    );
    return "failed";
  }
  if (!refined) return "failed";

  const [plans, history] = await Promise.all([
    getWorkoutPlans(),
    getWorkoutHistory(),
  ]);
  const stored = plans.find((p) => p.id === planId);

  const decision = decideRefinement({
    storedPlanExists: !!stored,
    lastModifiedAtRequest,
    lastModifiedNow: stored?.lastModified ?? "",
    sessionsLogged: history.filter((s) => s.planId === planId).length,
    refinedDayCount: refined.days?.length ?? 0,
  });

  if (decision === "drop") return "dropped";

  if (decision === "suggest") {
    const pending: PendingRefinement = {
      planId,
      planName: stored?.name ?? refined.name,
      plan: refined,
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    return "offered";
  }

  const merged: WorkoutPlan = {
    ...refined,
    // Keep the identity the user (and any navigation already in flight) holds.
    id: stored!.id,
    createdAt: stored!.createdAt,
    lastModified: new Date().toISOString(),
  };
  await saveWorkoutPlan(merged);
  onApplied?.(merged);
  return "applied";
}
