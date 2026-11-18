/**
 * Set bookkeeping for the active workout that doesn't need React: which sets
 * still count once an exercise is closed early, where to go next, and what
 * the following set should be prefilled with.
 */

import type { ExerciseProgress, SetData } from "@/lib/storage";

/**
 * Sets that still count toward the workout. Closing an exercise early (swipe
 * → "Fertig") drops its unfinished sets out of every total, so "2 of 3 done"
 * stops reading as a workout left half-finished.
 */
export function liveSets(ep: ExerciseProgress): SetData[] {
  return ep.closed ? ep.sets.filter((s) => s.completed) : ep.sets;
}

/** True once there's nothing left to do on this exercise. */
export function isExerciseDone(ep: ExerciseProgress): boolean {
  const sets = liveSets(ep);
  return ep.closed === true || (sets.length > 0 && sets.every((s) => s.completed));
}

/**
 * First exercise after `fromIndex` that still has an open set, with that
 * set's index. Closed exercises are skipped — their hidden sets aren't a
 * place to land.
 */
export function nextOpenExercise(
  progress: ExerciseProgress[],
  fromIndex: number,
): { exerciseIndex: number; setIndex: number } | null {
  for (let i = fromIndex + 1; i < progress.length; i++) {
    const ep = progress[i];
    if (ep.closed) continue;
    const setIndex = ep.sets.findIndex((s) => !s.completed);
    if (setIndex >= 0) return { exerciseIndex: i, setIndex };
  }
  return null;
}

/**
 * What the set after a just-finished one should start with. Lifters keep the
 * weight between working sets far more often than they change it, so the
 * kilos carry over; reps keep whatever the next set already has, else the
 * finished set's. Returns null when nothing should change: a warm-up (its
 * weight says nothing about the working weight), no weight logged, or the
 * next set already done.
 */
export function carryOverToNextSet(
  finished: SetData,
  next: SetData | undefined,
  isBodyweight: boolean,
): Partial<SetData> | null {
  if (!next || next.completed || isBodyweight) return null;
  if (finished.setType === "warmup" || next.setType === "warmup") return null;
  const weight = finished.weight.trim();
  if (!weight || !(parseFloat(weight.replace(",", ".")) > 0)) return null;
  if (next.weight === weight && next.reps !== "") return null;
  return { weight, reps: next.reps || finished.reps };
}

/** A fresh set appended with "+ Satz": same load as the last one, not done. */
export function appendedSet(sets: SetData[]): SetData {
  const last = [...sets].reverse().find((s) => s.setType !== "warmup") ?? sets[sets.length - 1];
  return {
    weight: last?.weight ?? "",
    reps: last?.reps ?? "",
    rating: null,
    completed: false,
  };
}

/**
 * Superset flow ("A1 → A2 → Pause → A1 …"): after a set of one member, the
 * next member in plan order that still has an open set. `rest` is true when
 * that step wraps back past the end of the round — that's where the plan's
 * pause goes, not between A1 and A2. A null target means the superset is
 * finished. `completed[i][j]`: set j of exercise i is done (closed exercises
 * count as all done).
 */
export function nextSupersetStep(
  members: number[],
  completed: boolean[][],
  fromIndex: number,
): { target: { exerciseIndex: number; setIndex: number } | null; rest: boolean } {
  const pos = members.indexOf(fromIndex);
  const n = members.length;
  if (pos < 0 || n === 0) return { target: null, rest: false };
  for (let step = 1; step <= n; step++) {
    const idx = members[(pos + step) % n];
    const setIndex = (completed[idx] ?? []).findIndex((done) => !done);
    if (setIndex !== -1) {
      return { target: { exerciseIndex: idx, setIndex }, rest: pos + step >= n };
    }
  }
  return { target: null, rest: false };
}

const num = (v: string) => parseFloat(String(v).replace(",", ".")) || 0;

/**
 * The best working set of an exercise — heaviest, then most reps; most reps
 * for bodyweight moves. Feeds the "last time → today" line on each exercise.
 */
export function topSet(sets: SetData[], isBodyweight: boolean): SetData | null {
  let best: SetData | null = null;
  for (const s of sets) {
    if (!s.completed || s.setType === "warmup" || !(num(s.reps) > 0)) continue;
    if (!isBodyweight && !(num(s.weight) > 0)) continue;
    if (!best) {
      best = s;
      continue;
    }
    const heavier = num(s.weight) - num(best.weight);
    if (isBodyweight ? num(s.reps) > num(best.reps) : heavier > 0 || (heavier === 0 && num(s.reps) > num(best.reps))) {
      best = s;
    }
  }
  return best;
}

/** True when `today` beats `last`: more weight, or same weight and more reps. */
export function beatsTopSet(today: SetData, last: SetData, isBodyweight: boolean): boolean {
  if (isBodyweight) return num(today.reps) > num(last.reps);
  const diff = num(today.weight) - num(last.weight);
  return diff > 0 || (diff === 0 && num(today.reps) > num(last.reps));
}

/**
 * Swipe → "wie vorher": the values to log an open set with. The nearest done
 * set above it of the same kind (warm-up or working), else the same set from
 * last time. Null when there's nothing to copy.
 */
export function replicateSource(
  sets: SetData[],
  setIndex: number,
  lastSets: SetData[] = [],
): { weight: string; reps: string } | null {
  const warmup = sets[setIndex]?.setType === "warmup";
  for (let i = setIndex - 1; i >= 0; i--) {
    const s = sets[i];
    if (s.completed && (s.setType === "warmup") === warmup && s.reps.trim()) {
      return { weight: s.weight, reps: s.reps };
    }
  }
  const last = lastSets[setIndex];
  return last?.reps?.trim() ? { weight: last.weight, reps: last.reps } : null;
}
