import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { Exercise, CreateExerciseBody } from "../models";
import { prefetchSingleExercise } from "./gifPrefetchService";

export function listExercises(equipment?: string): Exercise[] {
  if (equipment) {
    return db
      .prepare("SELECT * FROM exercises WHERE equipment = ? ORDER BY muscle_group, name")
      .all(equipment) as Exercise[];
  }
  return db
    .prepare("SELECT * FROM exercises ORDER BY muscle_group, name")
    .all() as Exercise[];
}

/** Public catalog (same rows as list, for native clients without extra auth wiring). */
export function listCatalogExercises(): Exercise[] {
  return listExercises();
}

/** Same muscle group alternatives (DB names), excluding the current exercise. */
export function listAlternativesByName(exerciseName: string, limit = 48): Exercise[] {
  const row = db
    .prepare("SELECT muscle_group FROM exercises WHERE name = ? COLLATE NOCASE LIMIT 1")
    .get(exerciseName.trim()) as { muscle_group: string } | undefined;
  if (!row) return [];
  return db
    .prepare(
      `SELECT * FROM exercises
       WHERE muscle_group = ? COLLATE NOCASE
         AND name != ? COLLATE NOCASE
         AND is_custom = 0
       ORDER BY name
       LIMIT ?`,
    )
    .all(row.muscle_group, exerciseName.trim(), limit) as Exercise[];
}

export function createExercise(body: CreateExerciseBody): Exercise {
  const { name, muscle_group } = body;
  if (!name || !muscle_group) {
    throw new AppError(400, "name and muscle_group required");
  }
  const result = db
    .prepare("INSERT INTO exercises (name, muscle_group, is_custom) VALUES (?, ?, 1)")
    .run(name, muscle_group);
  const newId = result.lastInsertRowid as number;

  prefetchSingleExercise(newId, name);

  return { id: newId, name, muscle_group, equipment: "barbell", is_custom: 1 };
}
