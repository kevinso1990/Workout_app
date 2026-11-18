import type { WorkoutSession } from "@/lib/storage";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day as a sortable number of days. */
export function dayNumber(date: Date): number {
  return Math.round(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / DAY_MS,
  );
}

/**
 * How many rest days in a row a training rhythm earns: three sessions a week
 * leave three days between some of them (Fri → Mon), two a week four.
 */
export function maxRestDays(sessionsPerWeek: number): number {
  const perWeek = Math.min(7, Math.max(1, Math.round(sessionsPerWeek) || 3));
  return Math.ceil(7 / perWeek);
}

export interface RestDayStreak {
  /** Days from the first session of the streak through today; 0 when broken. */
  days: number;
  /** Rest days still allowed before the streak breaks. */
  restLeft: number;
  maxRest: number;
  /** Day numbers with a logged session. */
  trained: Set<number>;
  /** First day of the running streak, or null. */
  startDay: number | null;
}

/**
 * A day streak that planned rest doesn't break: it holds as long as no gap
 * between sessions — or since the last one — runs past the rest days the
 * weekly rhythm earns. Any logged session counts, mobility and cardio too.
 */
export function restDayStreak(
  history: WorkoutSession[],
  now: Date,
  sessionsPerWeek: number,
): RestDayStreak {
  const maxRest = maxRestDays(sessionsPerWeek);
  const trained = new Set(history.map((s) => dayNumber(new Date(s.completedAt))));
  const today = dayNumber(now);
  const days = [...trained].filter((d) => d <= today).sort((a, b) => b - a);
  const empty = { days: 0, restLeft: 0, maxRest, trained, startDay: null };
  if (days.length === 0) return empty;

  // Rest days since the last session; today itself is still open.
  const restSince = today - days[0] - 1;
  if (days[0] !== today && restSince > maxRest) return empty;

  let start = days[0];
  for (let i = 1; i < days.length; i++) {
    if (start - days[i] - 1 > maxRest) break;
    start = days[i];
  }
  return {
    days: today - start + 1,
    restLeft: days[0] === today ? maxRest : Math.max(0, maxRest - restSince),
    maxRest,
    trained,
    startDay: start,
  };
}
