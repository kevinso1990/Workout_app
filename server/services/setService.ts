import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { WorkoutSet, LogSetBody } from "../models";

/** Throws 404/403 if the session doesn't exist or doesn't belong to the user. */
function assertOwnsSession(sessionId: number, userId: number): void {
  const row = db
    .prepare("SELECT user_id FROM sessions WHERE id = ?")
    .get(sessionId) as { user_id: number | null } | undefined;
  if (!row) throw new AppError(404, "Session not found");
  if (row.user_id !== userId) throw new AppError(403, "Access denied");
}

/** Throws 404/403 if the set doesn't exist or its session doesn't belong to the user. */
function assertOwnsSet(setId: number, userId: number): void {
  const row = db
    .prepare(
      `SELECT s.user_id FROM sets st
       JOIN sessions s ON s.id = st.session_id
       WHERE st.id = ?`,
    )
    .get(setId) as { user_id: number | null } | undefined;
  if (!row) throw new AppError(404, "Set not found");
  if (row.user_id !== userId) throw new AppError(403, "Access denied");
}

export function logSet(body: LogSetBody, userId: number): WorkoutSet {
  const { session_id, exercise_id, set_number, weight, reps, is_drop_set, parent_set_id, rir } = body;

  if (
    session_id === undefined ||
    exercise_id === undefined ||
    set_number === undefined ||
    weight === undefined ||
    reps === undefined
  ) {
    throw new AppError(400, "session_id, exercise_id, set_number, weight, reps required");
  }

  assertOwnsSession(session_id, userId);

  const result = db
    .prepare(
      `INSERT INTO sets
         (session_id, exercise_id, set_number, weight, reps, is_drop_set, parent_set_id, rir, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      session_id,
      exercise_id,
      set_number,
      weight,
      reps,
      is_drop_set ? 1 : 0,
      parent_set_id ?? null,
      rir ?? null,
      userId,
    );

  return db.prepare("SELECT * FROM sets WHERE id = ?").get(result.lastInsertRowid) as WorkoutSet;
}

export function updateSetRir(id: number, rir: number, userId: number): void {
  assertOwnsSet(id, userId);
  db.prepare("UPDATE sets SET rir = ? WHERE id = ?").run(rir, id);
}

export function deleteSet(id: number, userId: number): void {
  assertOwnsSet(id, userId);
  db.prepare("DELETE FROM sets WHERE id = ?").run(id);
}
