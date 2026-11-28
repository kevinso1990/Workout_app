import { isCardioSession, type WorkoutSession } from "@/lib/storage";
import { isMobilitySession } from "@/lib/mobilitySchedule";
import { mondayStart } from "@/lib/strengthProgress";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day as a sortable number of days. */
export function dayNumber(date: Date): number {
  return Math.round(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / DAY_MS,
  );
}

export interface StreakWeek {
  /** Monday of the week. */
  start: Date;
  /** Days with a strength session that week. */
  count: number;
  met: boolean;
}

export interface WeekStreak {
  /** Weeks in a row that reached the goal; this week counts once it has. */
  weeks: number;
  /** Training days a week the plan asks for. */
  goal: number;
  /** Training days so far this week. */
  thisWeek: number;
  /** The longest run ever, the running one included. */
  longest: number;
  /** The last weeks, oldest first, this week last. */
  recent: StreakWeek[];
  /** Day numbers with a strength session. */
  trained: Set<number>;
}

/** Sessions that count toward the weekly goal: lifting, not cardio or mobility. */
function counts(session: WorkoutSession): boolean {
  return !isCardioSession(session) && !isMobilitySession(session);
}

function weekKey(date: Date): number {
  return dayNumber(mondayStart(date));
}

/**
 * A streak of weeks that reached the plan's weekly goal. Our athletes train
 * two to four times a week, so a day streak either breaks on a normal rest
 * stretch or needs a rest allowance nobody can keep in their head. The week
 * in progress never breaks the run: it only adds to it once the goal is met.
 */
export function weekStreak(
  history: WorkoutSession[],
  now: Date,
  sessionsPerWeek: number,
  weeksShown = 5,
): WeekStreak {
  const goal = Math.min(7, Math.max(1, Math.round(sessionsPerWeek) || 3));
  // Days, not sessions: two workouts logged on one day are one training
  // day, the same way the week strip on the home tab counts them.
  const perWeek = new Map<number, number>();
  const trained = new Set<number>();
  const today = dayNumber(now);
  for (const s of history) {
    if (!counts(s)) continue;
    const at = new Date(s.completedAt);
    const day = dayNumber(at);
    if (day > today || trained.has(day)) continue;
    trained.add(day);
    const key = weekKey(at);
    perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
  }

  const thisKey = weekKey(now);
  const met = (key: number) => (perWeek.get(key) ?? 0) >= goal;
  const thisWeek = perWeek.get(thisKey) ?? 0;

  let weeks = met(thisKey) ? 1 : 0;
  for (let key = thisKey - 7; met(key); key -= 7) weeks++;

  // Longest run, walking every week since the first session.
  const firstKey = Math.min(thisKey, ...perWeek.keys());
  let longest = 0;
  let run = 0;
  for (let key = firstKey; key <= thisKey; key += 7) {
    if (met(key)) {
      run++;
      longest = Math.max(longest, run);
    } else if (key !== thisKey) {
      run = 0;
    }
  }

  const recent: StreakWeek[] = [];
  const monday = mondayStart(now);
  for (let i = weeksShown - 1; i >= 0; i--) {
    const start = new Date(monday);
    start.setDate(monday.getDate() - i * 7);
    const key = dayNumber(start);
    recent.push({ start, count: perWeek.get(key) ?? 0, met: met(key) });
  }

  return { weeks, goal, thisWeek, longest, recent, trained };
}
