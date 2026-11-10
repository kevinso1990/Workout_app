import type { WeeklyCommitment, Weekday } from "@shared/weeklySchedule";
import { isUsableSchedule, planTrainingWeek, scheduledDayIndex } from "@shared/planSchedule";
import { isMobilityDay } from "@/lib/mobilitySplit";
import type { WorkoutPlan, WorkoutSession } from "@/lib/storage";
import {
  MOBILITY_PLAN_ID,
  isMobilitySession,
  isSameLocalDay,
  mondayBasedWeekday,
} from "@/lib/mobilitySchedule";

export interface TodaySession {
  planId: string;
  planName: string;
  dayIndex: number;
  dayName: string;
  exerciseCount: number;
}

export interface TodayOverview {
  /** Strength day scheduled for today and not logged yet. */
  strength: TodaySession | null;
  /** Mobility day scheduled for today and not logged yet. */
  mobility: TodaySession | null;
  /** Today's fixed sport commitment, if any. */
  sport: WeeklyCommitment | null;
  /** Something was already logged today. */
  doneToday: boolean;
  /** Next scheduled strength day after today (only when none is due today). */
  next: (TodaySession & { weekday: number }) | null;
}

/**
 * The plan the week is built from. The Mobility-Session is its own plan but
 * never the training plan — it sits on its own fixed weekdays.
 */
export function primaryPlan(plans: WorkoutPlan[]): WorkoutPlan | null {
  return plans.find((p) => p.id !== MOBILITY_PLAN_ID && p.days.length > 0) ?? null;
}

function isCardio(s: WorkoutSession): boolean {
  return s.workoutType === "cardio" || !!s.cardio;
}

function session(plan: WorkoutPlan, dayIndex: number): TodaySession {
  const day = plan.days[dayIndex];
  return {
    planId: plan.id,
    planName: plan.name,
    dayIndex,
    dayName: day.dayName,
    exerciseCount: day.exercises.length,
  };
}

/**
 * What the home tab should offer to start right now. Uses the same weekly
 * layout as the week strip, so the card and the strip never disagree.
 */
export function todayOverview(input: {
  plans: WorkoutPlan[];
  commitments: WeeklyCommitment[];
  mobilityWeekdays: number[];
  history: WorkoutSession[];
  now: Date;
}): TodayOverview {
  const { plans, commitments, mobilityWeekdays, history, now } = input;
  const weekday = mondayBasedWeekday(now);
  const today = history.filter((s) => isSameLocalDay(new Date(s.completedAt), now));
  const strengthLogged = today.some((s) => !isCardio(s) && !isMobilitySession(s));
  const mobilityLogged = today.some((s) => isMobilitySession(s));

  const sport = commitments.find((c) => c.weekday === weekday) ?? null;

  let strength: TodaySession | null = null;
  let mobilityFromPlan: TodaySession | null = null;
  let next: TodayOverview["next"] = null;
  const plan = primaryPlan(plans);
  if (plan) {
    // Same lookup as the week strip: the plan's own weekdays/rotation when it
    // has them, else the sessions laid out around the sport days.
    const schedule = plan.schedule;
    const autoWeek = isUsableSchedule(schedule, plan.days)
      ? null
      : planTrainingWeek({ commitments, days: plan.days, now });
    const dayOn = (date: Date): number | undefined =>
      autoWeek
        ? autoWeek.dayIndexByWeekday.get(mondayBasedWeekday(date) as Weekday)
        : scheduledDayIndex(schedule!, plan.days, date);

    const todayIdx = dayOn(now);
    // A mobility day the plan puts on today is offered as mobility, not as
    // the day's strength session.
    if (todayIdx !== undefined && isMobilityDay(plan.days[todayIdx])) {
      if (!mobilityLogged) mobilityFromPlan = session(plan, todayIdx);
    } else if (todayIdx !== undefined && !strengthLogged) {
      strength = session(plan, todayIdx);
    }
    if (!strength) {
      for (let k = 1; k <= 7; k++) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
        const idx = dayOn(date);
        if (idx !== undefined && !isMobilityDay(plan.days[idx])) {
          next = { ...session(plan, idx), weekday: (weekday + k) % 7 };
          break;
        }
      }
    }
  }

  let mobility: TodaySession | null = mobilityFromPlan;
  const mobilityPlan = plans.find((p) => p.id === MOBILITY_PLAN_ID);
  if (mobilityPlan && mobilityPlan.days.length > 0 && mobilityWeekdays.includes(weekday) && !mobilityLogged) {
    mobility = session(mobilityPlan, 0);
  }

  return { strength, mobility, sport, doneToday: today.length > 0, next };
}
