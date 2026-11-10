/**
 * A plan that says itself which session happens on which weekday — and may
 * rotate over several weeks ("Woche 1: Di GK B kurz, Do GK C kurz, Sa GK A
 * lang; Woche 2: …"). Imported plans carry this; plans without it are laid
 * out automatically around the athlete's sport days (scheduleTrainingWeek).
 *
 * Entries point at days by a stable id, not by index or name: deleting,
 * reordering or renaming a day in the editor must not shift every later
 * session onto the wrong day. An entry whose day is gone is simply ignored.
 */

import {
  WEEKDAYS,
  scheduleTrainingWeek,
  type ScheduledSlot,
  type WeekSchedule,
  type WeeklyCommitment,
  type Weekday,
} from "./weeklySchedule";

export interface PlanScheduleEntry {
  weekday: Weekday;
  dayId: string;
}

export interface PlanSchedule {
  /** Local date (YYYY-MM-DD) of the Monday that starts cycle week 1. */
  cycleStart: string;
  /** One list per week of the cycle; a single week is a plain fixed week. */
  weeks: PlanScheduleEntry[][];
}

/** The parts of a plan day the schedule needs. */
export interface ScheduleDayRef {
  id?: string;
  dayName: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function weekdayOf(date: Date): Weekday {
  return ((date.getDay() + 6) % 7) as Weekday;
}

/** Local midnight of the Monday of `date`'s week. */
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - weekdayOf(d));
  return d;
}

export function localDateKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function parseLocalDateKey(key: string): Date | null {
  const m = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Week of the cycle (0-based) that `date` falls into. */
export function cycleWeekIndex(schedule: PlanSchedule, date: Date): number {
  const n = schedule.weeks.length;
  if (n <= 1) return 0;
  const start = parseLocalDateKey(schedule.cycleStart);
  if (!start) return 0;
  // Round, not floor: a DST switch makes one week 1h shorter or longer.
  const weeks = Math.round((mondayOf(date).getTime() - mondayOf(start).getTime()) / (7 * DAY_MS));
  return ((weeks % n) + n) % n;
}

/** True when the schedule still points at at least one day of the plan. */
export function isUsableSchedule(
  schedule: PlanSchedule | null | undefined,
  days: ScheduleDayRef[],
): schedule is PlanSchedule {
  if (!schedule || !Array.isArray(schedule.weeks) || schedule.weeks.length === 0) return false;
  const ids = new Set(days.map((d) => d.id).filter(Boolean));
  return schedule.weeks.some((w) => w.some((e) => ids.has(e.dayId)));
}

/** Plan day index the schedule puts on this calendar date, if any. */
export function scheduledDayIndex(
  schedule: PlanSchedule,
  days: ScheduleDayRef[],
  date: Date,
): number | undefined {
  const week = schedule.weeks[cycleWeekIndex(schedule, date)] ?? [];
  const entry = week.find((e) => e.weekday === weekdayOf(date));
  if (!entry) return undefined;
  const idx = days.findIndex((d) => d.id === entry.dayId);
  return idx >= 0 ? idx : undefined;
}

export interface PlanWeek extends WeekSchedule {
  /** Plan day index per weekday of this week (gym slots only). */
  dayIndexByWeekday: Map<Weekday, number>;
  /** Set for a rotating plan: which week of how many this is. */
  cycle: { week: number; of: number } | null;
}

/**
 * The week containing `now`, laid out the same way for the week strip and the
 * home tab's "today" card so the two never disagree.
 */
export function planTrainingWeek(input: {
  commitments: WeeklyCommitment[];
  days: ScheduleDayRef[];
  schedule?: PlanSchedule | null;
  now: Date;
}): PlanWeek {
  const { commitments, days, schedule, now } = input;

  if (isUsableSchedule(schedule, days)) {
    const monday = mondayOf(now);
    const dayIndexByWeekday = new Map<Weekday, number>();
    for (const weekday of WEEKDAYS) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + weekday);
      const idx = scheduledDayIndex(schedule, days, date);
      if (idx !== undefined) dayIndexByWeekday.set(weekday, idx);
    }
    const slots: ScheduledSlot[] = WEEKDAYS.map((weekday) => {
      const idx = dayIndexByWeekday.get(weekday);
      // The plan's own day wins: the athlete wrote it down for that weekday.
      if (idx !== undefined) return { weekday, kind: "gym" as const, dayName: days[idx].dayName };
      const commitment = commitments.find((c) => c.weekday === weekday);
      if (commitment) return { weekday, kind: "sport" as const, commitment };
      return { weekday, kind: "rest" as const };
    });
    const of = schedule.weeks.length;
    return {
      slots,
      unplacedDayNames: [],
      dayIndexByWeekday,
      cycle: of > 1 ? { week: cycleWeekIndex(schedule, now) + 1, of } : null,
    };
  }

  const auto = scheduleTrainingWeek({ commitments, sessionDayNames: days.map((d) => d.dayName) });
  // Day names can repeat ("Tag" twice); hand out plan days in order so each
  // slot points at its own day.
  const used = new Set<number>();
  const dayIndexByWeekday = new Map<Weekday, number>();
  for (const slot of auto.slots) {
    if (slot.kind !== "gym" || slot.dayName === undefined) continue;
    const idx = days.findIndex((d, i) => d.dayName === slot.dayName && !used.has(i));
    if (idx < 0) continue;
    used.add(idx);
    dayIndexByWeekday.set(slot.weekday, idx);
  }
  return { ...auto, dayIndexByWeekday, cycle: null };
}

/**
 * Plan day index on an arbitrary date. Fixed schedules look the date up in
 * its own cycle week; auto-placed plans repeat the same week forever.
 */
export function planDayOnDate(input: {
  commitments: WeeklyCommitment[];
  days: ScheduleDayRef[];
  schedule?: PlanSchedule | null;
  date: Date;
}): number | undefined {
  const { schedule, days, date } = input;
  if (isUsableSchedule(schedule, days)) return scheduledDayIndex(schedule, days, date);
  return planTrainingWeek({ ...input, now: date }).dayIndexByWeekday.get(weekdayOf(date));
}

/** Weekdays a day is scheduled on in any cycle week (e.g. to prefill the Mobility-Session's days). */
export function weekdaysOfDay(schedule: PlanSchedule | null | undefined, dayId: string | undefined): Weekday[] {
  if (!schedule || !dayId) return [];
  const out = new Set<Weekday>();
  for (const week of schedule.weeks) for (const e of week) if (e.dayId === dayId) out.add(e.weekday);
  return [...out].sort((a, b) => a - b);
}
