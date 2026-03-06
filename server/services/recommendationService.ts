import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { PlanExercise, Recommendation, AcceptRecommendationsBody } from "../models";

export function getRecommendations(planId: number): Recommendation[] {
  const planExercises = db
    .prepare(
      `SELECT pe.*, e.name, e.muscle_group
       FROM plan_exercises pe
       JOIN exercises e ON e.id = pe.exercise_id
       WHERE pe.plan_id = ?
       ORDER BY pe.sort_order`,
    )
    .all(planId) as PlanExercise[];

  const lastSession = db
    .prepare(
      `SELECT id, rpe FROM sessions
       WHERE plan_id = ? AND finished_at IS NOT NULL
       ORDER BY finished_at DESC LIMIT 1`,
    )
    .get(planId) as { id: number; rpe: number | null } | undefined;

  return planExercises.map((pe) => {
    let suggestedWeight = pe.default_weight;
    let suggestedReps = pe.default_reps;
    const suggestedSets = pe.default_sets;
    let reason = "No previous data";

    if (lastSession) {
      const lastSets = db
        .prepare(
          `SELECT weight, reps FROM sets
           WHERE session_id = ? AND exercise_id = ? AND is_drop_set = 0
           ORDER BY set_number`,
        )
        .all(lastSession.id, pe.exercise_id) as { weight: number; reps: number }[];

      const feedback = db
        .prepare(
          "SELECT rating FROM exercise_feedback WHERE session_id = ? AND exercise_id = ?",
        )
        .get(lastSession.id, pe.exercise_id) as { rating: string } | undefined;

      if (lastSets.length > 0) {
        const lastWeight = lastSets[0].weight;
        const allRepsHit = lastSets.every((s) => s.reps >= pe.default_reps);
        const rating = feedback?.rating;
        const rpe = lastSession.rpe ?? 5;

        if (rating === "easy" || (allRepsHit && !rating)) {
          suggestedWeight = lastWeight + 2.5;
          suggestedReps = pe.default_reps;
          reason = "Previous session felt easy — increase weight";
        } else if (rating === "right" && allRepsHit) {
          suggestedWeight = lastWeight;
          suggestedReps = Math.min(lastSets[0].reps + 1, pe.default_reps + 5);
          reason = "All reps completed — add 1 rep (double progression)";
        } else if (rating === "right" && !allRepsHit) {
          suggestedWeight = lastWeight;
          suggestedReps = lastSets[0].reps;
          reason = "Keep current weight — target same reps";
        } else if (rating === "hard" || rpe >= 9) {
          suggestedWeight = Math.max(0, lastWeight - 2.5);
          suggestedReps = pe.default_reps;
          reason = "Previous session was tough — reduce weight";
        } else {
          suggestedWeight = lastWeight;
          suggestedReps = lastSets[0].reps;
          reason = "Maintain current performance";
        }
      }
    }

    return {
      exercise_id: pe.exercise_id,
      name: pe.name,
      muscle_group: pe.muscle_group,
      suggested_sets: suggestedSets,
      suggested_reps: suggestedReps,
      suggested_weight: suggestedWeight,
      reason,
    };
  });
}

export function acceptRecommendations(
  planId: number,
  recommendations: AcceptRecommendationsBody["recommendations"],
): void {
  if (!Array.isArray(recommendations)) {
    throw new AppError(400, "recommendations array required");
  }

  const update = db.prepare(
    `UPDATE plan_exercises
     SET default_weight = ?, default_reps = ?, default_sets = ?
     WHERE plan_id = ? AND exercise_id = ?`,
  );

  db.transaction(() => {
    for (const rec of recommendations) {
      update.run(rec.suggested_weight, rec.suggested_reps, rec.suggested_sets, planId, rec.exercise_id);
    }
  })();
}
