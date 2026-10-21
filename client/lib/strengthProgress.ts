import type { WorkoutSession } from "@/lib/storage";

/** Epley estimate, rounded to whole kg — same formula the exercise charts use. */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

/** Local midnight of the Monday that starts `date`'s week. */
export function mondayStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/**
 * One volume format everywhere on the progress tab. The old "0k" summary next
 * to a "0.5k" bar came from two different roundings of the same number.
 */
export function formatVolume(kg: number, language: string): string {
  const locale = language.startsWith("de") ? "de-DE" : "en-US";
  if (kg < 1000) return `${Math.round(kg)} kg`;
  const tonnes = kg / 1000;
  return `${tonnes.toLocaleString(locale, { maximumFractionDigits: tonnes < 10 ? 1 : 0 })} t`;
}

function isCardio(s: WorkoutSession): boolean {
  return s.workoutType === "cardio" || !!s.cardio;
}

function completedSets(session: WorkoutSession, idx: number) {
  return session.exerciseProgress?.[idx]?.sets.filter((s) => s.completed) ?? [];
}

export function sessionVolume(session: WorkoutSession): number {
  if (isCardio(session)) return 0;
  return session.exercises.reduce(
    (total, _ex, idx) =>
      total +
      completedSets(session, idx).reduce(
        (sum, s) => sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0),
        0,
      ),
    0,
  );
}

export function sessionSetCount(session: WorkoutSession): number {
  if (isCardio(session)) return 0;
  return session.exercises.reduce((n, _ex, idx) => n + completedSets(session, idx).length, 0);
}

export interface WeekSummary {
  workouts: number;
  sets: number;
  volume: number;
}

/** Monday-to-now numbers — the week a lifter actually thinks in. */
export function thisWeekSummary(history: WorkoutSession[], now: Date): WeekSummary {
  const start = mondayStart(now).getTime();
  const week = history.filter((s) => new Date(s.completedAt).getTime() >= start);
  return {
    workouts: week.length,
    sets: week.reduce((n, s) => n + sessionSetCount(s), 0),
    volume: week.reduce((n, s) => n + sessionVolume(s), 0),
  };
}

/**
 * Consecutive weeks with at least one workout, counting back from this week.
 * The current week doesn't break the streak while it is still underway.
 */
export function weekStreak(history: WorkoutSession[], now: Date): number {
  const weeks = new Set(history.map((s) => mondayStart(new Date(s.completedAt)).getTime()));
  const cursor = mondayStart(now);
  if (!weeks.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 7);
  let streak = 0;
  while (weeks.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

/** Weekly volume for the last `count` weeks (oldest first), keyed by Monday. */
export function weeklyVolumes(
  history: WorkoutSession[],
  now: Date,
  count = 4,
): { weekStart: Date; volume: number }[] {
  const thisMonday = mondayStart(now);
  return Array.from({ length: count }, (_, i) => {
    const weekStart = new Date(thisMonday);
    weekStart.setDate(thisMonday.getDate() - (count - 1 - i) * 7);
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 7);
    const volume = history
      .filter((s) => {
        const t = new Date(s.completedAt).getTime();
        return t >= weekStart.getTime() && t < end.getTime();
      })
      .reduce((n, s) => n + sessionVolume(s), 0);
    return { weekStart, volume };
  });
}

/** Completed sets per muscle group since Monday. */
export function weeklySetsByMuscle(
  history: WorkoutSession[],
  now: Date,
): Record<string, number> {
  const start = mondayStart(now).getTime();
  const out: Record<string, number> = {};
  for (const s of history) {
    if (isCardio(s) || new Date(s.completedAt).getTime() < start) continue;
    s.exercises.forEach((ex, idx) => {
      const n = completedSets(s, idx).length;
      if (n > 0) out[ex.muscleGroup] = (out[ex.muscleGroup] ?? 0) + n;
    });
  }
  return out;
}

export interface PersonalRecord {
  exerciseName: string;
  date: string;
  weight: number;
  reps: number;
  estimated1RM: number;
  previous1RM: number;
}

/**
 * Sessions in the last `days` that beat the exercise's earlier best estimated
 * 1RM. A first-ever session isn't a record — there is nothing it beat.
 * Newest first, one entry per exercise.
 */
export function recentRecords(
  history: WorkoutSession[],
  now: Date,
  days = 30,
  limit = 5,
): PersonalRecord[] {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  const best = new Map<string, number>();
  const latest = new Map<string, PersonalRecord>();
  const sorted = [...history]
    .filter((s) => !isCardio(s))
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

  for (const s of sorted) {
    s.exercises.forEach((ex, idx) => {
      let top = { e1rm: 0, weight: 0, reps: 0 };
      for (const set of completedSets(s, idx)) {
        const w = parseFloat(set.weight) || 0;
        const r = parseInt(set.reps) || 0;
        const e = estimate1RM(w, r);
        if (e > top.e1rm) top = { e1rm: e, weight: w, reps: r };
      }
      if (top.e1rm === 0) return;
      const prev = best.get(ex.name);
      if (prev !== undefined && top.e1rm > prev && new Date(s.completedAt).getTime() >= since) {
        latest.set(ex.name, {
          exerciseName: ex.name,
          date: s.completedAt,
          weight: top.weight,
          reps: top.reps,
          estimated1RM: top.e1rm,
          previous1RM: prev,
        });
      }
      if (prev === undefined || top.e1rm > prev) best.set(ex.name, top.e1rm);
    });
  }

  return [...latest.values()]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}
