import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { Exercise, CreateExerciseBody } from "../models";

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

export function createExercise(body: CreateExerciseBody): Exercise {
  const { name, muscle_group } = body;
  if (!name || !muscle_group) {
    throw new AppError(400, "name and muscle_group required");
  }
  const result = db
    .prepare("INSERT INTO exercises (name, muscle_group, is_custom) VALUES (?, ?, 1)")
    .run(name, muscle_group);
  return { id: result.lastInsertRowid as number, name, muscle_group, equipment: "barbell", is_custom: 1 };
}
