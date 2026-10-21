import { scheduleTrainingWeek, type WeeklyCommitment } from "@shared/weeklySchedule";
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
  let next: TodayOverview["next"] = null;
  const plan = primaryPlan(plans);
  if (plan) {
    const { slots } = scheduleTrainingWeek({
      commitments,
      sessionDayNames: plan.days.map((d) => d.dayName),
    });
    // Day names can repeat ("Tag" twice); hand out plan days in order so each
    // slot points at its own day.
    const used = new Set<number>();
    const indexByWeekday = new Map<number, number>();
    for (const slot of slots) {
      if (slot.kind !== "gym" || slot.dayName === undefined) continue;
      const idx = plan.days.findIndex((d, i) => d.dayName === slot.dayName && !used.has(i));
      if (idx < 0) continue;
      used.add(idx);
      indexByWeekday.set(slot.weekday, idx);
    }

    const todayIdx = indexByWeekday.get(weekday);
    if (todayIdx !== undefined && !strengthLogged) {
      strength = session(plan, todayIdx);
    } else {
      for (let k = 1; k <= 7; k++) {
        const d = (weekday + k) % 7;
        const idx = indexByWeekday.get(d);
        if (idx !== undefined) {
          next = { ...session(plan, idx), weekday: d };
          break;
        }
      }
    }
  }

  let mobility: TodaySession | null = null;
  const mobilityPlan = plans.find((p) => p.id === MOBILITY_PLAN_ID);
  if (mobilityPlan && mobilityPlan.days.length > 0 && mobilityWeekdays.includes(weekday) && !mobilityLogged) {
    mobility = session(mobilityPlan, 0);
  }

  return { strength, mobility, sport, doneToday: today.length > 0, next };
}
