import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { BodyWeight, LogBodyWeightBody } from "../models";

export function listBodyWeight(userId: number): BodyWeight[] {
  return db
    .prepare(
      "SELECT * FROM body_weight WHERE user_id = ? ORDER BY logged_date DESC LIMIT 100",
    )
    .all(userId) as BodyWeight[];
}

export function logBodyWeight(body: LogBodyWeightBody, userId: number): BodyWeight {
  const { weight_kg, logged_date, notes } = body;

  if (!weight_kg) throw new AppError(400, "weight_kg required");

  const date = logged_date ?? new Date().toISOString().split("T")[0];
  const result = db
    .prepare(
      "INSERT INTO body_weight (weight_kg, logged_date, notes, user_id) VALUES (?, ?, ?, ?)",
    )
    .run(weight_kg, date, notes ?? null, userId);

  return db
    .prepare("SELECT * FROM body_weight WHERE id = ?")
    .get(result.lastInsertRowid) as BodyWeight;
}
