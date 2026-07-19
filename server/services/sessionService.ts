import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { calculateAndStoreFatigue } from "./recoveryService";
import { ingestMobileSession } from "./mobileSessionIngestService";
import type {
  Session,
  SessionRow,
  SessionWithDetails,
  WorkoutSetRow,
  FeedbackRow,
  FinishSessionBody,
  LogCardioBody,
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
    return {
      ...s,
      sets,
      totalVolume,
      duration: computeDuration(s.started_at, s.finished_at),
    };
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
       ORDER BY st.exercise_id, st.set_number`,
    )
    .all(id) as WorkoutSetRow[];

  const feedback = db
    .prepare(
      `SELECT ef.*, e.name as exercise_name
       FROM exercise_feedback ef
       JOIN exercises e ON e.id = ef.exercise_id
       WHERE ef.session_id = ?`,
    )
    .all(id) as FeedbackRow[];

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
  const plan = db
    .prepare("SELECT id FROM plans WHERE id = ? AND user_id = ?")
    .get(planId, userId);
  if (!plan) throw new AppError(404, "Plan not found");

  const result = db
    .prepare("INSERT INTO sessions (plan_id, user_id) VALUES (?, ?)")
    .run(planId, userId);
  return db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(result.lastInsertRowid) as Session;
}

export function getWorkoutHistory(userId: number) {
  return listSessions(userId);
}

export type SyncLocalResult = {
  ok: true;
  localSessionId: string;
  ingestComplete: boolean;
  serverSessionId?: number;
};

/**
 * Idempotent store for native offline-first completed sessions.
 * Structured ingest is atomic — 201 only when the full transaction commits.
 */
export function syncLocalWorkoutSession(
  userId: number | null,
  localSessionId: string,
  payload: unknown,
): SyncLocalResult {
  if (!localSessionId?.trim()) {
    throw new AppError(400, "session.id required");
  }

  const trimmedId = localSessionId.trim();
  const json = JSON.stringify(payload);

  if (userId == null) {
    db.prepare(
      `INSERT INTO mobile_workout_sync (user_id, local_session_id, payload, synced_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(local_session_id) DO UPDATE SET
         user_id = excluded.user_id,
         payload = excluded.payload,
         synced_at = datetime('now')`,
    ).run(null, trimmedId, json);
    return { ok: true, localSessionId: trimmedId, ingestComplete: false };
  }

  const run = db.transaction(() => {
    db.prepare(
      `INSERT INTO mobile_workout_sync (user_id, local_session_id, payload, synced_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(local_session_id) DO UPDATE SET
         user_id = excluded.user_id,
         payload = excluded.payload,
         synced_at = datetime('now')`,
    ).run(userId, trimmedId, json);

    const serverSessionId = ingestMobileSession(userId, payload);
    return serverSessionId;
  });

  const serverSessionId = run();
  return {
    ok: true,
    localSessionId: trimmedId,
    ingestComplete: true,
    serverSessionId,
  };
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

const CARDIO_SYSTEM_PLAN_NAME = "__cardio_system__";

function getOrCreateCardioPlanId(): number {
  const row = db
    .prepare("SELECT id FROM plans WHERE name = ? LIMIT 1")
    .get(CARDIO_SYSTEM_PLAN_NAME) as { id: number } | undefined;
  if (row) return row.id;
  const result = db.prepare("INSERT INTO plans (name) VALUES (?)").run(CARDIO_SYSTEM_PLAN_NAME);
  return Number(result.lastInsertRowid);
}

/** Log a completed cardio / sport session (no sets). */
export function logCardioSession(userId: number, body: LogCardioBody): Session {
  const sport = String(body.sport_type ?? "").trim();
  if (!sport) throw new AppError(400, "sport_type required");

  const duration = Math.round(Number(body.duration_minutes));
  if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60) {
    throw new AppError(400, "duration_minutes must be between 1 and 1440");
  }

  const rpe = Math.round(Number(body.rpe));
  if (!Number.isFinite(rpe) || rpe < 1 || rpe > 10) {
    throw new AppError(400, "rpe must be between 1 and 10");
  }

  let distanceKm: number | null = null;
  if (body.distance_km !== undefined && body.distance_km !== null && body.distance_km !== "") {
    const d = Number(body.distance_km);
    if (!Number.isFinite(d) || d < 0 || d > 500) {
      throw new AppError(400, "distance_km out of range");
    }
    distanceKm = Math.round(d * 100) / 100;
  }

  const completedAt = body.completed_at?.trim() || new Date().toISOString();
  const planId = getOrCreateCardioPlanId();
  const notes =
    body.notes?.trim() ||
    (body.sport_label?.trim() && sport === "custom" ? body.sport_label.trim() : null);

  const result = db
    .prepare(
      `INSERT INTO sessions (
         plan_id, user_id, started_at, finished_at, rpe, notes,
         workout_type, sport_type, duration_minutes, distance_km
       ) VALUES (?, ?, datetime('now', '-' || ? || ' minutes'), ?, ?, ?, 'cardio', ?, ?, ?)`,
    )
    .run(
      planId,
      userId,
      duration,
      completedAt,
      rpe,
      notes,
      sport,
      duration,
      distanceKm,
    );

  return db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(result.lastInsertRowid) as Session;
}
