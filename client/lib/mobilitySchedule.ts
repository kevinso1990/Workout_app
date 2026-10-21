import { isMobilityExercise } from "@/lib/exerciseTaxonomy";

/** The one Mobility-Session plan the "+" menu creates and reopens. */
export const MOBILITY_PLAN_ID = "mobility-session";

export const MOBILITY_REMINDER_HOUR = 19;
export const MOBILITY_REMINDER_MINUTE = 30;

/** How far ahead reminders are scheduled; re-synced every time the app opens. */
export const MOBILITY_REMINDER_DAYS_AHEAD = 14;

/** Monday-based weekday (0 = Mo … 6 = So), same convention as the week strip. */
export function mondayBasedWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * A logged session counts as mobility if it came from the Mobility-Session
 * plan, or if most of its exercises are stretches/mobility moves (a mobility
 * day built into some other plan).
 */
export function isMobilitySession(session: {
  planId: string;
  exercises: { name: string }[];
}): boolean {
  if (session.planId === MOBILITY_PLAN_ID) return true;
  const n = session.exercises.length;
  if (n === 0) return false;
  const mobility = session.exercises.filter((e) => isMobilityExercise(e.name)).length;
  return mobility * 2 > n;
}

/**
 * When to remind: every chosen weekday in the next `daysAhead` days at the
 * reminder time — except times already past, and today if the user has
 * already done their mobility session. A notification can't check this itself
 * when it fires, so "already logged today" is applied when scheduling, and
 * scheduling is redone after every logged workout.
 */
export function mobilityReminderDates(
  weekdays: number[],
  now: Date,
  loggedToday: boolean,
  daysAhead = MOBILITY_REMINDER_DAYS_AHEAD,
): Date[] {
  if (weekdays.length === 0) return [];
  const wanted = new Set(weekdays);
  const dates: Date[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + i,
      MOBILITY_REMINDER_HOUR,
      MOBILITY_REMINDER_MINUTE,
    );
    if (!wanted.has(mondayBasedWeekday(d))) continue;
    if (d.getTime() <= now.getTime()) continue;
    if (i === 0 && loggedToday) continue;
    dates.push(d);
  }
  return dates;
}
