/**
 * Imported plan (server JSON, after review) → the plan the app stores, plus
 * what doesn't belong in a lifting plan: cardio sessions become fixed weekly
 * appointments rather than "exercises" to log sets for.
 */

import type { ImportedWorkoutPlan } from "@/hooks/useWorkoutImport";
import { repsToPlanString } from "@/lib/importReps";
import type { Exercise, PlanSchedule, PlanScheduleEntry, WeeklyCommitment, Weekday, WorkoutDay, WorkoutPlan } from "@/lib/storage";
import { isMobilityDay } from "@/lib/mobilitySplit";
import { localDateKey, mondayOf } from "@shared/planSchedule";

export interface ImportedCardioDay {
  label: string;
  weekdays: Weekday[];
  durationMinutes?: number;
}

function isWeekday(n: unknown): n is Weekday {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6;
}

export function importedPlanToStorage(
  plan: ImportedWorkoutPlan,
  planId: string,
  now: Date,
): { plan: WorkoutPlan; cardioDays: ImportedCardioDay[] } {
  const iso = now.toISOString();
  const idByImportIndex = new Map<number, string>();
  const cardioIndexes = new Set<number>();
  const days: WorkoutDay[] = [];

  plan.days.forEach((day, dIdx) => {
    if (day.kind === "cardio") {
      cardioIndexes.add(dIdx);
      return;
    }
    const id = `${planId}-d${dIdx}`;
    idByImportIndex.set(dIdx, id);
    const out: WorkoutDay = {
      id,
      dayName: day.dayName,
      exercises: day.exercises.map((ex, idx): Exercise => {
        const row: Exercise = {
          id: `imported-${planId}-${dIdx}-${idx}`,
          name: ex.name,
          muscleGroup: (ex.muscleGroup ?? "").trim(),
          sets: ex.sets,
          reps: repsToPlanString(ex.reps),
        };
        if (ex.weight != null && Number.isFinite(ex.weight)) {
          row.targetWeight = Math.round(ex.weight * 10) / 10;
        }
        if (typeof ex.reps === "number" && Number.isFinite(ex.reps)) {
          row.targetReps = Math.min(120, Math.max(0, Math.floor(ex.reps)));
        } else if (typeof ex.reps === "string") {
          const first = ex.reps.match(/(\d+)/);
          if (first) {
            row.targetReps = Math.min(120, Math.max(0, parseInt(first[1], 10)));
          }
        }
        if (ex.perSide) row.perSide = true;
        if (ex.notes?.trim()) row.notes = ex.notes.trim();
        if (ex.alternative?.trim()) row.alternative = ex.alternative.trim();
        if (ex.superset?.trim()) row.superset = ex.superset.trim();
        if (ex.restSeconds != null && Number.isFinite(ex.restSeconds) && ex.restSeconds > 0) {
          row.restSeconds = Math.round(ex.restSeconds);
        }
        return row;
      }),
    };
    if (day.warmup?.trim()) out.warmup = day.warmup.trim();
    if (day.kind === "mobility") out.kind = "mobility";
    days.push(out);
  });

  // Schedule: imported day indexes → stable day ids. Cardio days leave the
  // plan, so their weekdays are collected for the appointments instead.
  const cardioWeekdays = new Map<number, Set<Weekday>>();
  const weeks: PlanScheduleEntry[][] = [];
  for (const week of plan.schedule?.weeks ?? []) {
    const entries: PlanScheduleEntry[] = [];
    for (const e of week) {
      if (!isWeekday(e.weekday)) continue;
      if (cardioIndexes.has(e.dayIndex)) {
        if (!cardioWeekdays.has(e.dayIndex)) cardioWeekdays.set(e.dayIndex, new Set());
        cardioWeekdays.get(e.dayIndex)!.add(e.weekday);
        continue;
      }
      const dayId = idByImportIndex.get(e.dayIndex);
      if (dayId && !entries.some((x) => x.weekday === e.weekday)) entries.push({ weekday: e.weekday, dayId });
    }
    weeks.push(entries);
  }
  const usableWeeks = weeks.some((w) => w.length > 0) ? weeks : [];
  // The plan's own week 1 starts this week.
  const schedule: PlanSchedule | undefined =
    usableWeeks.length > 0 ? { cycleStart: localDateKey(mondayOf(now)), weeks: usableWeeks } : undefined;

  // Sessions per week = strength days in a scheduled week; mobility days
  // don't count as training days.
  const strengthIds = new Set(days.filter((d) => !isMobilityDay(d)).map((d) => d.id));
  const daysPerWeek = schedule
    ? Math.max(1, Math.max(...schedule.weeks.map((w) => w.filter((e) => strengthIds.has(e.dayId)).length)))
    : days.length;

  const cardioDays: ImportedCardioDay[] = [...cardioIndexes].map((dIdx) => {
    const day = plan.days[dIdx];
    return {
      label: day.dayName,
      weekdays: [...(cardioWeekdays.get(dIdx) ?? [])].sort((a, b) => a - b),
      ...(day.durationMinutes ? { durationMinutes: day.durationMinutes } : {}),
    };
  });

  return {
    plan: {
      id: planId,
      name: plan.planName?.trim() || "Imported Plan",
      daysPerWeek,
      days,
      ...(schedule ? { schedule } : {}),
      createdAt: iso,
      lastModified: iso,
    },
    cardioDays,
  };
}

/**
 * Adds the plan's cardio sessions as weekly appointments on their weekdays.
 * A weekday that already has an appointment keeps it. Returns the same array
 * when nothing was added.
 */
export function withCardioCommitments(
  existing: WeeklyCommitment[],
  cardioDays: ImportedCardioDay[],
  idPrefix: string,
): WeeklyCommitment[] {
  const taken = new Set(existing.map((c) => c.weekday));
  const added: WeeklyCommitment[] = [];
  for (const day of cardioDays) {
    for (const weekday of day.weekdays) {
      if (taken.has(weekday)) continue;
      taken.add(weekday);
      added.push({
        id: `${idPrefix}-cardio-${weekday}`,
        weekday,
        sport: "custom",
        label: day.label.slice(0, 40),
        ...(day.durationMinutes ? { durationMinutes: day.durationMinutes } : {}),
      });
    }
  }
  return added.length > 0 ? [...existing, ...added] : existing;
}
