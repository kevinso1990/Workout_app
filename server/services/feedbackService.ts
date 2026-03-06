import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { SubmitFeedbackBody } from "../models";

export function upsertFeedback(body: SubmitFeedbackBody): void {
  const { session_id, exercise_id, rating } = body;

  if (!session_id || !exercise_id || !rating) {
    throw new AppError(400, "session_id, exercise_id, rating required");
  }

  const existing = db
    .prepare(
      "SELECT id FROM exercise_feedback WHERE session_id = ? AND exercise_id = ?",
    )
    .get(session_id, exercise_id) as { id: number } | undefined;

  if (existing) {
    db.prepare("UPDATE exercise_feedback SET rating = ? WHERE id = ?").run(rating, existing.id);
  } else {
    db.prepare(
      "INSERT INTO exercise_feedback (session_id, exercise_id, rating) VALUES (?, ?, ?)",
    ).run(session_id, exercise_id, rating);
  }
}
