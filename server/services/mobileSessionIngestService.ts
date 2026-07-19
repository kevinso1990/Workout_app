import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { calculateAndStoreFatigue } from "./recoveryService";

type MobileSet = {
  weight?: string;
  reps?: string;
  completed?: boolean;
  rating?: string | null;
  setType?: string;
};

type MobileExerciseProgress = {
  exerciseId?: string;
  sets?: MobileSet[];
};

type MobileExercise = {
  id?: string;
  name?: string;
};

type MobileCardioMeta = {
  sport?: string;
  sportLabel?: string;
  durationMinutes?: number;
  distanceKm?: number | null;
  rpe?: number;
  notes?: string | null;
};

export type MobileWorkoutSessionPayload = {
  id?: string;
  planId?: string;
  planName?: string;
  dayName?: string;
  completedAt?: string;
  duration?: number;
  workoutType?: string;
  cardio?: MobileCardioMeta;
  exercises?: MobileExercise[];
  exerciseProgress?: MobileExerciseProgress[];
};

function resolveExerciseId(name: string): number | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const row = db
    .prepare(
      "SELECT id FROM exercises WHERE name = ? COLLATE NOCASE LIMIT 1",
    )
    .get(trimmed) as { id: number } | undefined;
  return row?.id ?? null;
}

function getOrCreateMobilePlan(
  userId: number,
  localPlanId: string,
  planName: string,
): number {
  const existing = db
    .prepare(
      "SELECT id FROM plans WHERE user_id = ? AND local_plan_id = ? LIMIT 1",
    )
    .get(userId, localPlanId) as { id: number } | undefined;
  if (existing) return existing.id;

  const result = db
    .prepare(
      "INSERT INTO plans (name, user_id, local_plan_id) VALUES (?, ?, ?)",
    )
    .run(planName.trim() || "My Workout Plan", userId, localPlanId);
  return Number(result.lastInsertRowid);
}

function mapSetRating(
  rating: string | null | undefined,
): "easy" | "right" | "hard" | null {
  if (rating === "green" || rating === "easy") return "easy";
  if (rating === "yellow" || rating === "right") return "right";
  if (rating === "red" || rating === "hard") return "hard";
  return null;
}

function countExpectedStrengthSets(session: MobileWorkoutSessionPayload): number {
  const nameById = new Map<string, string>();
  for (const ex of session.exercises ?? []) {
    if (ex.id && ex.name) nameById.set(ex.id, ex.name);
  }

  let total = 0;
  for (const progress of session.exerciseProgress ?? []) {
    const exerciseKey = progress.exerciseId ?? "";
    const exerciseName = nameById.get(exerciseKey) ?? exerciseKey;
    if (!resolveExerciseId(exerciseName)) continue;

    for (const set of progress.sets ?? []) {
      if (set.completed === false) continue;
      const weight = parseFloat(String(set.weight ?? ""));
      const reps = parseInt(String(set.reps ?? ""), 10);
      if (Number.isFinite(weight) && Number.isFinite(reps)) total += 1;
    }
  }
  return total;
}

function countStoredSets(sessionId: number): number {
  const row = db
    .prepare("SELECT COUNT(*) as c FROM sets WHERE session_id = ?")
    .get(sessionId) as { c: number };
  return row.c;
}

function clearSessionChildren(sessionId: number): void {
  db.prepare("DELETE FROM muscle_fatigue WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM exercise_feedback WHERE session_id = ?").run(sessionId);
  db.prepare("DELETE FROM sets WHERE session_id = ?").run(sessionId);
}

function insertStrengthSetsAndFeedback(
  userId: number,
  sessionId: number,
  session: MobileWorkoutSessionPayload,
): void {
  const nameById = new Map<string, string>();
  for (const ex of session.exercises ?? []) {
    if (ex.id && ex.name) nameById.set(ex.id, ex.name);
  }

  const insertSet = db.prepare(
    `INSERT INTO sets (
       session_id, exercise_id, set_number, weight, reps, user_id, is_drop_set
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertFeedback = db.prepare(
    `INSERT INTO exercise_feedback (session_id, exercise_id, rating, user_id)
     VALUES (?, ?, ?, ?)`,
  );

  for (const progress of session.exerciseProgress ?? []) {
    const exerciseKey = progress.exerciseId ?? "";
    const exerciseName = nameById.get(exerciseKey) ?? exerciseKey;
    const exerciseId = resolveExerciseId(exerciseName);
    if (!exerciseId) continue;

    let setNumber = 0;
    let exerciseRating: "easy" | "right" | "hard" | null = null;

    for (const set of progress.sets ?? []) {
      if (set.completed === false) continue;
      const weight = parseFloat(String(set.weight ?? ""));
      const reps = parseInt(String(set.reps ?? ""), 10);
      if (!Number.isFinite(weight) || !Number.isFinite(reps)) continue;

      setNumber += 1;
      const isDrop = set.setType === "dropset" ? 1 : 0;
      insertSet.run(
        sessionId,
        exerciseId,
        setNumber,
        weight,
        reps,
        userId,
        isDrop,
      );

      const mapped = mapSetRating(set.rating);
      if (mapped) exerciseRating = mapped;
    }

    if (exerciseRating) {
      insertFeedback.run(sessionId, exerciseId, exerciseRating, userId);
    }
  }
}

function ingestStrengthSession(
  userId: number,
  session: MobileWorkoutSessionPayload,
): number {
  const localSessionId = session.id?.trim();
  const localPlanId = session.planId?.trim();
  const completedAt = session.completedAt?.trim();
  if (!localSessionId || !localPlanId || !completedAt) {
    throw new AppError(422, "session id, planId, and completedAt required");
  }

  const expectedSets = countExpectedStrengthSets(session);

  const existing = db
    .prepare(
      "SELECT id FROM sessions WHERE local_session_id = ? LIMIT 1",
    )
    .get(localSessionId) as { id: number } | undefined;

  if (existing) {
    const storedSets = countStoredSets(existing.id);
    if (expectedSets === 0 || (storedSets >= expectedSets && expectedSets > 0)) {
      return existing.id;
    }
    clearSessionChildren(existing.id);
    insertStrengthSetsAndFeedback(userId, existing.id, session);
    calculateAndStoreFatigue(existing.id, userId);
    return existing.id;
  }

  const planId = getOrCreateMobilePlan(
    userId,
    localPlanId,
    session.planName ?? session.dayName ?? "Workout",
  );

  const durationMin = Math.max(0, Math.round(Number(session.duration) || 0));
  const finishedMs = new Date(completedAt).getTime();
  const startedAt = new Date(
    finishedMs - durationMin * 60_000,
  ).toISOString();

  const sessionResult = db
    .prepare(
      `INSERT INTO sessions (
         plan_id, user_id, started_at, finished_at, local_session_id, workout_type
       ) VALUES (?, ?, ?, ?, ?, 'strength')`,
    )
    .run(planId, userId, startedAt, completedAt, localSessionId);
  const sessionId = Number(sessionResult.lastInsertRowid);

  insertStrengthSetsAndFeedback(userId, sessionId, session);
  calculateAndStoreFatigue(sessionId, userId);
  return sessionId;
}

function ingestCardioSession(
  userId: number,
  session: MobileWorkoutSessionPayload,
): number {
  const localSessionId = session.id?.trim();
  const completedAt = session.completedAt?.trim();
  const cardio = session.cardio;
  if (!localSessionId || !completedAt || !cardio) {
    throw new AppError(422, "cardio session requires id, completedAt, and cardio meta");
  }

  const existing = db
    .prepare(
      "SELECT id FROM sessions WHERE local_session_id = ? LIMIT 1",
    )
    .get(localSessionId) as { id: number } | undefined;
  if (existing) return existing.id;

  const planId = getOrCreateMobilePlan(
    userId,
    session.planId?.trim() || "__cardio__",
    session.planName ?? "Cardio",
  );

  const durationMin = Math.max(
    1,
    Math.round(Number(cardio.durationMinutes ?? session.duration) || 1),
  );
  const rpe = Math.min(
    10,
    Math.max(1, Math.round(Number(cardio.rpe) || 5)),
  );
  const finishedMs = new Date(completedAt).getTime();
  const startedAt = new Date(
    finishedMs - durationMin * 60_000,
  ).toISOString();

  const notes = [
    cardio.sportLabel ?? cardio.sport ?? "cardio",
    cardio.distanceKm != null ? `${cardio.distanceKm} km` : null,
    cardio.notes ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  const result = db
    .prepare(
      `INSERT INTO sessions (
         plan_id, user_id, started_at, finished_at, rpe, notes,
         local_session_id, workout_type, sport_type, duration_minutes, distance_km
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'cardio', ?, ?, ?)`,
    )
    .run(
      planId,
      userId,
      startedAt,
      completedAt,
      rpe,
      notes || null,
      localSessionId,
      cardio.sport ?? "custom",
      durationMin,
      cardio.distanceKm ?? null,
    );

  return Number(result.lastInsertRowid);
}

/**
 * Maps a native AsyncStorage workout session into structured SQLite rows.
 * Runs atomically; throws on failure so the caller can return 5xx and retry.
 */
export function ingestMobileSession(
  userId: number,
  payload: unknown,
): number {
  const session = payload as MobileWorkoutSessionPayload;
  if (!session || typeof session !== "object") {
    throw new AppError(422, "Invalid session payload");
  }

  const run = db.transaction(() => {
    if (session.workoutType === "cardio" || session.cardio) {
      return ingestCardioSession(userId, session);
    }
    return ingestStrengthSession(userId, session);
  });

  try {
    const sessionId = run();
    if (!sessionId || sessionId <= 0) {
      throw new AppError(500, "Ingest produced no session id");
    }
    return sessionId;
  } catch (err) {
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("UNIQUE constraint failed") && msg.includes("local_session_id")) {
      // Concurrent duplicate — re-read and repair if needed.
      const localId = (session as MobileWorkoutSessionPayload).id?.trim();
      if (localId) {
        const row = db
          .prepare("SELECT id FROM sessions WHERE local_session_id = ? LIMIT 1")
          .get(localId) as { id: number } | undefined;
        if (row) return row.id;
      }
    }
    throw new AppError(500, `Session ingest failed: ${msg}`);
  }
}

/** @internal Test hook — simulates failure after session insert, before sets. */
export function __testSimulatePartialIngestFailure(
  userId: number,
  payload: MobileWorkoutSessionPayload,
): void {
  const run = db.transaction(() => {
    const localSessionId = payload.id?.trim();
    const localPlanId = payload.planId?.trim();
    const completedAt = payload.completedAt?.trim();
    if (!localSessionId || !localPlanId || !completedAt) {
      throw new AppError(422, "invalid");
    }
    const planId = getOrCreateMobilePlan(userId, localPlanId, payload.planName ?? "T");
    db.prepare(
      `INSERT INTO sessions (plan_id, user_id, started_at, finished_at, local_session_id, workout_type)
       VALUES (?, ?, datetime('now'), ?, ?, 'strength')`,
    ).run(planId, userId, completedAt, localSessionId);
    throw new Error("__TEST_ABORT_BEFORE_SETS");
  });
  run();
}
