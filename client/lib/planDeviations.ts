/**
 * Spots habits that the plan doesn't reflect yet — an exercise skipped every
 * time, a set always dropped or added, an exercise always added — so the app
 * can offer to write them into the plan instead of the athlete fixing the
 * same thing by hand every session.
 *
 * Pure: the caller hands in the stored plan and the history (newest first or
 * not, it's sorted here) plus what was already answered.
 */

import type { Exercise, WorkoutPlan, WorkoutSession } from "@/lib/storage";

/** Sessions in a row the habit has to show up in before we ask. */
export const DEVIATION_STREAK = 3;

export type PlanDeviation =
  | { kind: "sets"; key: string; exerciseName: string; from: number; to: number }
  | { kind: "skip"; key: string; exerciseName: string }
  | { kind: "add"; key: string; exercise: Exercise }
  | { kind: "replace"; key: string; exerciseName: string; exercise: Exercise };

const norm = (name: string) => name.trim().toLowerCase();

/** Completed working sets per exercise name in one session. */
function doneSetsByName(session: WorkoutSession): Map<string, { count: number; exercise: Exercise }> {
  const out = new Map<string, { count: number; exercise: Exercise }>();
  session.exercises.forEach((exercise, i) => {
    const ep =
      session.exerciseProgress?.find((p) => p.exerciseId === exercise.id) ??
      session.exerciseProgress?.[i];
    const count =
      ep?.sets.filter((s) => s.completed && s.setType !== "warmup").length ?? 0;
    const key = norm(exercise.name);
    const prev = out.get(key);
    out.set(key, { count: (prev?.count ?? 0) + count, exercise });
  });
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function deviationKey(plan: WorkoutPlan, dayName: string, rest: string): string {
  return `${plan.id}|${dayName}|${rest}`;
}

/**
 * Habits from the last DEVIATION_STREAK sessions of this plan day. Only
 * sessions logged after the plan's last edit count — otherwise an exercise
 * added to the plan yesterday would look "skipped" in every older session.
 */
export function detectPlanDeviations(
  plan: WorkoutPlan,
  dayIndex: number,
  history: WorkoutSession[],
  answered: ReadonlySet<string>,
): PlanDeviation[] {
  const day = plan.days[dayIndex];
  if (!day) return [];
  const editedAt = Date.parse(plan.lastModified) || 0;
  const recent = history
    .filter(
      (s) =>
        s.planId === plan.id &&
        s.dayName === day.dayName &&
        s.workoutType !== "cardio" &&
        (Date.parse(s.completedAt) || 0) > editedAt,
    )
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .slice(0, DEVIATION_STREAK);
  if (recent.length < DEVIATION_STREAK) return [];

  const perSession = recent.map(doneSetsByName);
  // A session where nothing at all was logged is an abandoned workout, not a
  // habit — it would otherwise read as "skipped everything".
  if (perSession.some((m) => [...m.values()].every((v) => v.count === 0))) return [];

  const planNames = new Set(day.exercises.map((e) => norm(e.name)));
  const skipped: Exercise[] = [];
  const out: PlanDeviation[] = [];

  for (const ex of day.exercises) {
    const counts = perSession.map((m) => m.get(norm(ex.name))?.count ?? 0);
    if (counts.every((c) => c === 0)) {
      skipped.push(ex);
      continue;
    }
    const allFewer = counts.every((c) => c > 0 && c < ex.sets);
    const allMore = counts.every((c) => c > ex.sets);
    if (allFewer || allMore) {
      const to = median(counts);
      out.push({
        kind: "sets",
        key: deviationKey(plan, day.dayName, `sets|${norm(ex.name)}|${to}`),
        exerciseName: ex.name,
        from: ex.sets,
        to,
      });
    }
  }

  // Extras done every time, in the newest session's version (latest reps).
  const added: Exercise[] = [];
  for (const [name, { exercise }] of perSession[0]) {
    if (planNames.has(name)) continue;
    const counts = perSession.map((m) => m.get(name)?.count ?? 0);
    if (counts.some((c) => c === 0)) continue;
    added.push({ ...exercise, sets: median(counts) });
  }

  // Skipped A + added B for the same muscle every time is a swap, and reads
  // better as one question than as two.
  for (const ex of skipped) {
    const swapIdx = added.findIndex((a) => norm(a.muscleGroup) === norm(ex.muscleGroup));
    if (swapIdx >= 0) {
      const [replacement] = added.splice(swapIdx, 1);
      out.push({
        kind: "replace",
        key: deviationKey(plan, day.dayName, `replace|${norm(ex.name)}|${norm(replacement.name)}`),
        exerciseName: ex.name,
        exercise: replacement,
      });
    } else {
      out.push({
        kind: "skip",
        key: deviationKey(plan, day.dayName, `skip|${norm(ex.name)}`),
        exerciseName: ex.name,
      });
    }
  }
  for (const exercise of added) {
    out.push({
      kind: "add",
      key: deviationKey(plan, day.dayName, `add|${norm(exercise.name)}`),
      exercise,
    });
  }

  return out.filter((d) => !answered.has(d.key));
}

/** The plan with one accepted habit written into the given day. */
export function applyPlanDeviation(
  plan: WorkoutPlan,
  dayIndex: number,
  deviation: PlanDeviation,
  now = new Date().toISOString(),
): WorkoutPlan {
  const day = plan.days[dayIndex];
  const isTarget = (e: Exercise) =>
    "exerciseName" in deviation && norm(e.name) === norm(deviation.exerciseName);
  let exercises: Exercise[];
  switch (deviation.kind) {
    case "sets":
      exercises = day.exercises.map((e) => (isTarget(e) ? { ...e, sets: deviation.to } : e));
      break;
    case "skip":
      exercises = day.exercises.filter((e) => !isTarget(e));
      break;
    case "replace":
      exercises = day.exercises.map((e) =>
        isTarget(e) ? { ...deviation.exercise, id: `${e.id}-r${Date.parse(now) || 0}` } : e,
      );
      break;
    case "add":
      exercises = [
        ...day.exercises,
        { ...deviation.exercise, id: `${deviation.exercise.id}-p${Date.parse(now) || 0}` },
      ];
      break;
  }
  const days = plan.days.map((d, i) => (i === dayIndex ? { ...d, exercises } : d));
  return { ...plan, days, lastModified: now };
}
