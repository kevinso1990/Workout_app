import db from "../db";
import type {
  WeeklyVolumeRow,
  PRRow,
  ExerciseHistoryRow,
  WorkoutSet,
  WeeklyHistoryRow,
  ConsistencyRow,
  ExerciseProgressRow,
  ExercisePRRow,
  MuscleVolumeRow,
  LoggedExerciseRow,
  StatsTotals,
  WeekRow,
} from "../models";

export function getWeeklyVolume(): WeeklyVolumeRow[] {
  return db
    .prepare(
      `SELECT e.muscle_group, SUM(st.weight * st.reps) as volume
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       JOIN sessions s ON s.id = st.session_id
       WHERE s.started_at >= datetime('now', '-7 days')
       GROUP BY e.muscle_group
       ORDER BY volume DESC`,
    )
    .all() as WeeklyVolumeRow[];
}

export function getPRs(): PRRow[] {
  return db
    .prepare(
      `SELECT e.id as exercise_id, e.name, e.muscle_group, MAX(st.weight) as max_weight, st.reps
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       WHERE st.weight = (SELECT MAX(st2.weight) FROM sets st2 WHERE st2.exercise_id = st.exercise_id)
       GROUP BY e.id
       ORDER BY e.name`,
    )
    .all() as PRRow[];
}

export function getExerciseHistory(exerciseId: number): ExerciseHistoryRow[] {
  return db
    .prepare(
      `SELECT s.id as session_id, s.started_at,
              SUM(st.weight * st.reps) as volume, COUNT(st.id) as total_sets
       FROM sets st
       JOIN sessions s ON s.id = st.session_id
       WHERE st.exercise_id = ?
       GROUP BY s.id
       ORDER BY s.started_at DESC
       LIMIT 10`,
    )
    .all(exerciseId) as ExerciseHistoryRow[];
}

export function getLastSets(exerciseId: number): WorkoutSet[] {
  const lastSession = db
    .prepare(
      `SELECT s.id FROM sessions s
       JOIN sets st ON st.session_id = s.id
       WHERE st.exercise_id = ? AND s.finished_at IS NOT NULL
       ORDER BY s.started_at DESC LIMIT 1`,
    )
    .get(exerciseId) as { id: number } | undefined;

  if (!lastSession) return [];

  return db
    .prepare(
      "SELECT * FROM sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_number",
    )
    .all(lastSession.id, exerciseId) as WorkoutSet[];
}

export function getRestAverage(exerciseId: number): { average: number } {
  const rows = db
    .prepare(
      `SELECT logged_at FROM sets
       WHERE exercise_id = ?
       ORDER BY session_id DESC, set_number
       LIMIT 20`,
    )
    .all(exerciseId) as { logged_at: string }[];

  if (rows.length < 2) return { average: 90 };

  let totalRest = 0;
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const diff =
      (new Date(rows[i - 1].logged_at).getTime() - new Date(rows[i].logged_at).getTime()) / 1000;
    if (diff > 0 && diff < 600) {
      totalRest += diff;
      count++;
    }
  }

  return { average: count > 0 ? Math.round(totalRest / count) : 90 };
}

export function getTotals(): StatsTotals {
  const totalWorkouts = (
    db.prepare("SELECT COUNT(*) as c FROM sessions WHERE finished_at IS NOT NULL").get() as {
      c: number;
    }
  ).c;

  const totalVolume = (
    db
      .prepare(
        `SELECT COALESCE(SUM(st.weight * st.reps), 0) as v
         FROM sets st
         JOIN sessions s ON s.id = st.session_id
         WHERE s.finished_at IS NOT NULL`,
      )
      .get() as { v: number }
  ).v;

  const weeks = db
    .prepare(
      `SELECT strftime('%Y-%W', s.started_at) as wk, COUNT(DISTINCT s.id) as cnt
       FROM sessions s WHERE s.finished_at IS NOT NULL
       GROUP BY wk ORDER BY wk DESC`,
    )
    .all() as WeekRow[];

  let streak = 0;
  let longestStreak = 0;

  for (let i = 0; i < weeks.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const [py, pw] = weeks[i - 1].wk.split("-").map(Number);
      const [cy, cw] = weeks[i].wk.split("-").map(Number);
      const consecutive =
        (py === cy && pw - cw === 1) || (py - cy === 1 && cw >= 50 && pw <= 2);
      if (consecutive) {
        streak++;
      } else {
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, streak);

  return {
    totalWorkouts,
    totalVolume: Math.round(totalVolume),
    currentStreak: streak,
    longestStreak,
  };
}

export function getWeeklyHistory(): WeeklyHistoryRow[] {
  return db
    .prepare(
      `SELECT
         strftime('%Y-%W', s.started_at) as week,
         MIN(date(s.started_at)) as week_start,
         COALESCE(SUM(st.weight * st.reps), 0) as volume
       FROM sessions s
       LEFT JOIN sets st ON st.session_id = s.id
       WHERE s.finished_at IS NOT NULL AND s.started_at >= datetime('now', '-56 days')
       GROUP BY week
       ORDER BY week ASC`,
    )
    .all() as WeeklyHistoryRow[];
}

export function getConsistency(): ConsistencyRow[] {
  return db
    .prepare(
      `SELECT date(s.started_at) as workout_date,
              COUNT(*) as sessions,
              CASE WHEN EXISTS(
                SELECT 1 FROM sets st
                JOIN sessions s2 ON s2.id = st.session_id
                WHERE date(s2.started_at) = date(s.started_at)
                AND st.weight = (SELECT MAX(st2.weight) FROM sets st2 WHERE st2.exercise_id = st.exercise_id)
                AND NOT EXISTS(SELECT 1 FROM sets st3
                  JOIN sessions s3 ON s3.id = st3.session_id
                  WHERE st3.exercise_id = st.exercise_id AND st3.weight >= st.weight AND s3.started_at < s.started_at)
              ) THEN 1 ELSE 0 END as has_pr
       FROM sessions s
       WHERE s.finished_at IS NOT NULL AND s.started_at >= datetime('now', '-180 days')
       GROUP BY workout_date
       ORDER BY workout_date ASC`,
    )
    .all() as ConsistencyRow[];
}

export function getExerciseProgress(
  exerciseId: number,
): { sessions: ExerciseProgressRow[]; prs: ExercisePRRow | undefined } {
  const sessions = db
    .prepare(
      `SELECT s.id, s.started_at,
              MAX(st.weight) as best_weight,
              MAX(st.weight * (1 + st.reps / 30.0)) as estimated_1rm,
              SUM(st.weight * st.reps) as volume,
              MAX(st.reps) as best_reps
       FROM sets st
       JOIN sessions s ON s.id = st.session_id
       WHERE st.exercise_id = ? AND s.finished_at IS NOT NULL
       GROUP BY s.id
       ORDER BY s.started_at ASC`,
    )
    .all(exerciseId) as ExerciseProgressRow[];

  const prs = db
    .prepare(
      `SELECT MAX(st.weight) as max_weight,
              MAX(st.reps) as max_reps,
              MAX(st.weight * st.reps) as max_volume_set
       FROM sets st
       JOIN sessions s ON s.id = st.session_id
       WHERE st.exercise_id = ? AND s.finished_at IS NOT NULL`,
    )
    .get(exerciseId) as ExercisePRRow | undefined;

  return { sessions, prs };
}

export function getMuscleVolume7d(): MuscleVolumeRow[] {
  return db
    .prepare(
      `SELECT e.muscle_group, COUNT(DISTINCT st.id) as set_count, SUM(st.weight * st.reps) as volume
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       JOIN sessions s ON s.id = st.session_id
       WHERE s.finished_at IS NOT NULL AND s.started_at >= datetime('now', '-7 days')
       GROUP BY e.muscle_group`,
    )
    .all() as MuscleVolumeRow[];
}

export function getLoggedExercises(): LoggedExerciseRow[] {
  return db
    .prepare(
      `SELECT DISTINCT e.id, e.name, e.muscle_group,
              COUNT(st.id) as total_sets, MAX(s.started_at) as last_used
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       JOIN sessions s ON s.id = st.session_id
       WHERE s.finished_at IS NOT NULL
       GROUP BY e.id
       ORDER BY last_used DESC`,
    )
    .all() as LoggedExerciseRow[];
}
