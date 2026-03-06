import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { calculateAndStoreFatigue } from "./recoveryService";
import type {
  Session,
  SessionRow,
  SessionWithDetails,
  WorkoutSetRow,
  FeedbackRow,
  FinishSessionBody,
} from "../models";

function computeDuration(startedAt: string, finishedAt: string | null): number | null {
  if (!finishedAt) return null;
  return Math.round(
    (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60_000,
  );
}

export function listSessions(userId?: number): (SessionRow & {
  sets: WorkoutSetRow[];
  totalVolume: number;
  duration: number | null;
})[] {
  const sessions = userId
    ? (db
        .prepare(
          `SELECT s.*, p.name as plan_name
           FROM sessions s
           JOIN plans p ON p.id = s.plan_id
           WHERE s.user_id = ?
           ORDER BY s.started_at DESC`,
        )
        .all(userId) as SessionRow[])
    : (db
        .prepare(
          `SELECT s.*, p.name as plan_name
           FROM sessions s
           JOIN plans p ON p.id = s.plan_id
           ORDER BY s.started_at DESC`,
        )
        .all() as SessionRow[]);

  return sessions.map((s) => {
    const sets = db
      .prepare(
        `SELECT st.*, e.name as exercise_name, e.muscle_group
         FROM sets st
         JOIN exercises e ON e.id = st.exercise_id
         WHERE st.session_id = ?
         ORDER BY st.exercise_id, st.set_number`,
      )
      .all(s.id) as WorkoutSetRow[];

    const totalVolume = sets.reduce((sum, st) => sum + st.weight * st.reps, 0);
    return { ...s, sets, totalVolume, duration: computeDuration(s.started_at, s.finished_at) };
  });
}

export function getSession(id: number): SessionWithDetails {
  const session = db
    .prepare(
      `SELECT s.*, p.name as plan_name
       FROM sessions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.id = ?`,
    )
    .get(id) as SessionRow | undefined;

  if (!session) throw new AppError(404, "Session not found");

  const sets = db
    .prepare(
      `SELECT st.*, e.name as exercise_name, e.muscle_group
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       WHERE st.session_id = ?
       ORDER BY st.exercise_id, st.set_number, st.is_drop_set`,
    )
    .all(session.id) as WorkoutSetRow[];

  const feedback = db
    .prepare(
      `SELECT ef.*, e.name as exercise_name
       FROM exercise_feedback ef
       JOIN exercises e ON e.id = ef.exercise_id
       WHERE ef.session_id = ?`,
    )
    .all(session.id) as FeedbackRow[];

  const totalVolume = sets.reduce((sum, st) => sum + st.weight * st.reps, 0);

  return {
    ...session,
    sets,
    feedback,
    totalVolume,
    duration: computeDuration(session.started_at, session.finished_at),
  };
}

export function createSession(planId: number, userId?: number): Session {
  if (!planId) throw new AppError(400, "plan_id required");
  const result = db
    .prepare("INSERT INTO sessions (plan_id, user_id) VALUES (?, ?)")
    .run(planId, userId ?? null);
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(result.lastInsertRowid) as Session;
}

/** Returns the full workout history for a user — each session with its sets and volume. */
export function getWorkoutHistory(userId: number): (SessionRow & {
  sets: WorkoutSetRow[];
  totalVolume: number;
  duration: number | null;
})[] {
  return listSessions(userId);
}

export function finishSession(id: number, body: FinishSessionBody): Session {
  const { finished_at, rpe, notes } = body;

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (finished_at) { updates.push("finished_at = ?"); values.push(finished_at); }
  if (rpe !== undefined) { updates.push("rpe = ?"); values.push(rpe); }
  if (notes !== undefined) { updates.push("notes = ?"); values.push(notes); }

  if (updates.length > 0) {
    db.prepare(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
  }

  // Compute and store muscle fatigue only once per session
  if (finished_at) {
    const existing = db
      .prepare("SELECT id FROM muscle_fatigue WHERE session_id = ? LIMIT 1")
      .get(id);
    if (!existing) {
      calculateAndStoreFatigue(id);
    }
  }

  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Session;
}
