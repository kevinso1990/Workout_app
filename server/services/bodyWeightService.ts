import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { BodyWeight, LogBodyWeightBody } from "../models";

export function listBodyWeight(): BodyWeight[] {
  return db
    .prepare("SELECT * FROM body_weight ORDER BY logged_date DESC LIMIT 100")
    .all() as BodyWeight[];
}

export function logBodyWeight(body: LogBodyWeightBody): BodyWeight {
  const { weight_kg, logged_date, notes } = body;

  if (!weight_kg) throw new AppError(400, "weight_kg required");

  const date = logged_date ?? new Date().toISOString().split("T")[0];
  const result = db
    .prepare("INSERT INTO body_weight (weight_kg, logged_date, notes) VALUES (?, ?, ?)")
    .run(weight_kg, date, notes ?? null);

  return db
    .prepare("SELECT * FROM body_weight WHERE id = ?")
    .get(result.lastInsertRowid) as BodyWeight;
}
