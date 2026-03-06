import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { WorkoutSet, LogSetBody } from "../models";

export function logSet(body: LogSetBody): WorkoutSet {
  const { session_id, exercise_id, set_number, weight, reps, is_drop_set, parent_set_id } = body;

  if (
    session_id === undefined ||
    exercise_id === undefined ||
    set_number === undefined ||
    weight === undefined ||
    reps === undefined
  ) {
    throw new AppError(400, "session_id, exercise_id, set_number, weight, reps required");
  }

  const result = db
    .prepare(
      `INSERT INTO sets
         (session_id, exercise_id, set_number, weight, reps, is_drop_set, parent_set_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      session_id,
      exercise_id,
      set_number,
      weight,
      reps,
      is_drop_set ? 1 : 0,
      parent_set_id ?? null,
    );

  return db.prepare("SELECT * FROM sets WHERE id = ?").get(result.lastInsertRowid) as WorkoutSet;
}

export function deleteSet(id: number): void {
  db.prepare("DELETE FROM sets WHERE id = ?").run(id);
}
