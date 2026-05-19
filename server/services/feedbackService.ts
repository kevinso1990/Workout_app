import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { SubmitFeedbackBody } from "../models";

export function upsertFeedback(body: SubmitFeedbackBody, userId: number): void {
  const { session_id, exercise_id, rating } = body;

  if (!session_id || !exercise_id || !rating) {
    throw new AppError(400, "session_id, exercise_id, rating required");
  }

  // Ownership guard — feedback can only be left on the user's own session
  const session = db
    .prepare("SELECT user_id FROM sessions WHERE id = ?")
    .get(session_id) as { user_id: number | null } | undefined;
  if (!session) throw new AppError(404, "Session not found");
  if (session.user_id !== userId) throw new AppError(403, "Access denied");

  const existing = db
    .prepare(
      "SELECT id FROM exercise_feedback WHERE session_id = ? AND exercise_id = ?",
    )
    .get(session_id, exercise_id) as { id: number } | undefined;

  if (existing) {
    db.prepare("UPDATE exercise_feedback SET rating = ? WHERE id = ?").run(rating, existing.id);
  } else {
    db.prepare(
      "INSERT INTO exercise_feedback (session_id, exercise_id, rating, user_id) VALUES (?, ?, ?, ?)",
    ).run(session_id, exercise_id, rating, userId);
  }
}
