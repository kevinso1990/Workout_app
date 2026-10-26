import type { WorkoutDay, WorkoutPlan } from "@/lib/storage";
import { isMobilityExercise } from "@/lib/exerciseTaxonomy";
import { MOBILITY_PLAN_ID } from "@/lib/mobilitySchedule";

const MOBILITY_DAY_NAME = /mobil|dehn|stretch|beweglich|yoga|flexib/i;

/**
 * A plan day that is really a stretching session: named like one, or made
 * mostly of mobility moves. Imported and AI plans often put one at the end of
 * a strength week ("Tag 4 – Mobility").
 */
export function isMobilityDay(day: WorkoutDay): boolean {
  if (MOBILITY_DAY_NAME.test(day.dayName)) return true;
  const n = day.exercises.length;
  if (n === 0) return false;
  const mobility = day.exercises.filter((e) => isMobilityExercise(e.name)).length;
  return mobility * 2 > n;
}

export interface MobilityDayCandidate {
  plan: WorkoutPlan;
  dayIndex: number;
  /** Stable key for "don't ask again" — survives renames of other days. */
  key: string;
}

export function mobilityDayKey(plan: WorkoutPlan, day: WorkoutDay): string {
  return `${plan.id}:${day.dayName}`;
}

/**
 * First mobility day sitting inside a training plan that the user hasn't
 * answered yet. A plan that is *only* mobility isn't offered — splitting it
 * would leave an empty training plan behind.
 */
export function findMobilityDayToSplit(
  plans: WorkoutPlan[],
  answered: ReadonlySet<string>,
): MobilityDayCandidate | null {
  for (const plan of plans) {
    if (plan.id === MOBILITY_PLAN_ID) continue;
    const strengthDays = plan.days.filter((d) => !isMobilityDay(d)).length;
    if (strengthDays === 0) continue;
    const dayIndex = plan.days.findIndex(
      (d) => isMobilityDay(d) && d.exercises.length > 0 && !answered.has(mobilityDayKey(plan, d)),
    );
    if (dayIndex >= 0) {
      return { plan, dayIndex, key: mobilityDayKey(plan, plan.days[dayIndex]) };
    }
  }
  return null;
}

/**
 * Moves the day out of the training plan into the standalone Mobility-Session
 * (replacing an existing one). The training week then only schedules the
 * strength days, and mobility gets its own weekdays and reminder.
 */
export function splitMobilityDay(
  plan: WorkoutPlan,
  dayIndex: number,
  sessionName: string,
  now = new Date().toISOString(),
): { trainingPlan: WorkoutPlan; mobilityPlan: WorkoutPlan } {
  const day = plan.days[dayIndex];
  const remaining = plan.days.filter((_, i) => i !== dayIndex);
  return {
    trainingPlan: {
      ...plan,
      days: remaining,
      daysPerWeek: remaining.length,
      lastModified: now,
    },
    mobilityPlan: {
      id: MOBILITY_PLAN_ID,
      name: sessionName,
      daysPerWeek: 1,
      days: [{ dayName: sessionName, exercises: day.exercises }],
      createdAt: now,
      lastModified: now,
    },
  };
}
