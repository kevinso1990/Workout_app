/**
 * When may a background AI refinement overwrite the plan the user already has?
 *
 * Template-first hands the user a usable plan instantly and lets the AI improve
 * it afterwards. That inverts the risk: instead of the user waiting for a plan,
 * the plan can change underneath them. Overwriting a plan someone has already
 * trained with — or edited by hand — would destroy their work to deliver an
 * "improvement" they never asked for, which is far worse than the slow
 * generation this replaces.
 *
 * So the refinement only lands unasked when the plan is demonstrably untouched.
 * The rules are here, separate from storage, so they can be tested directly.
 */

export type RefinementDecision =
  /** Safe: nobody has touched the plan, swap it in and say so. */
  | "apply"
  /** The user has invested in this plan — offer, never overwrite. */
  | "suggest"
  /** The plan is gone, or the refinement is not an improvement. Discard. */
  | "drop";

export type RefinementContext = {
  /** The plan as it exists now, or undefined if it was deleted meanwhile. */
  storedPlanExists: boolean;
  /** `lastModified` captured when the refinement was requested. */
  lastModifiedAtRequest: string;
  /** `lastModified` of the plan as stored right now. */
  lastModifiedNow: string;
  /** Completed sessions recorded against this plan. */
  sessionsLogged: number;
  /** Training days in the refined plan. */
  refinedDayCount: number;
};

export function decideRefinement(ctx: RefinementContext): RefinementDecision {
  // The user deleted the plan while the request was in flight. Applying it
  // would resurrect something they threw away.
  if (!ctx.storedPlanExists) return "drop";

  // An empty or dayless refinement is not an improvement at any price. This
  // guards the case where a model returns valid JSON with nothing in it.
  if (ctx.refinedDayCount <= 0) return "drop";

  // Edited by hand since the request went out.
  if (ctx.lastModifiedNow !== ctx.lastModifiedAtRequest) return "suggest";

  // Already trained with: the plan now has history attached to it.
  if (ctx.sessionsLogged > 0) return "suggest";

  return "apply";
}
