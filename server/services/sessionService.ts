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

/** Throws 404 if the session doesn't exist, 403 if it belongs to a different user. */
function assertOwnsSession(id: number, userId: number): SessionRow {
  const row = db
    .prepare(
      `SELECT s.*, p.name as plan_name
       FROM sessions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.id = ?`,
    )
    .get(id) as SessionRow | undefined;
  if (!row) throw new AppError(404, "Session not found");
  if (row.user_id !== userId) throw new AppError(403, "Access denied");
  return row;
}

export function listSessions(userId: number): (SessionRow & {
  sets: WorkoutSetRow[];
  totalVolume: number;
  duration: number | null;
})[] {
  const sessions = db
    .prepare(
      `SELECT s.*, p.name as plan_name
       FROM sessions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = ?
       ORDER BY s.started_at DESC`,
    )
    .all(userId) as SessionRow[];

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

export function getSession(id: number, userId: number): SessionWithDetails {
  const session = assertOwnsSession(id, userId);

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

export function createSession(planId: number, userId: number): Session {
  if (!planId) throw new AppError(400, "plan_id required");

  // Verify the plan belongs to this user before letting them start a session against it
  const plan = db
    .prepare("SELECT user_id FROM plans WHERE id = ?")
    .get(planId) as { user_id: number | null } | undefined;
  if (!plan) throw new AppError(404, "Plan not found");
  if (plan.user_id !== null && plan.user_id !== userId) {
    throw new AppError(403, "Access denied");
  }

  const result = db
    .prepare("INSERT INTO sessions (plan_id, user_id) VALUES (?, ?)")
    .run(planId, userId);
  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(result.lastInsertRowid) as Session;
}

export function getWorkoutHistory(userId: number) {
  return listSessions(userId);
}

/** Idempotent store for native offline-first completed sessions (JSON payload). */
export function syncLocalWorkoutSession(
  userId: number | null,
  localSessionId: string,
  payload: unknown,
): { ok: true; localSessionId: string } {
  if (!localSessionId?.trim()) {
    throw new AppError(400, "session.id required");
  }
  const json = JSON.stringify(payload);
  db.prepare(
    `INSERT INTO mobile_workout_sync (user_id, local_session_id, payload, synced_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(local_session_id) DO UPDATE SET
       user_id = excluded.user_id,
       payload = excluded.payload,
       synced_at = datetime('now')`,
  ).run(userId, localSessionId.trim(), json);
  return { ok: true, localSessionId: localSessionId.trim() };
}

export function finishSession(id: number, body: FinishSessionBody, userId: number): Session {
  assertOwnsSession(id, userId);

  const { finished_at, rpe, notes } = body;

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (finished_at) { updates.push("finished_at = ?"); values.push(finished_at); }
  if (rpe !== undefined) { updates.push("rpe = ?"); values.push(rpe); }
  if (notes !== undefined) { updates.push("notes = ?"); values.push(notes); }

  if (updates.length > 0) {
    db.prepare(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
  }

  // Compute and store muscle fatigue only once per session.
  // Non-fatal: a fatigue-tracking failure must never prevent a session from finishing.
  if (finished_at) {
    const existing = db
      .prepare("SELECT id FROM muscle_fatigue WHERE session_id = ? LIMIT 1")
      .get(id);
    if (!existing) {
      try {
        calculateAndStoreFatigue(id, userId);
      } catch (err) {
        console.error(`[warn] fatigue calculation failed for session ${id}:`, err);
      }
    }
  }

  return db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Session;
}
