/**
 * "Zirkel" / circuit mode: instead of finishing every set of exercise A
 * before moving to B (the app's default), the user does one set of each
 * exercise in turn, then loops back for the next round.
 *
 * Pure and state-shape-agnostic on purpose — ActiveWorkoutScreen owns the
 * actual ExerciseProgress[]; this only needs to know, per exercise, which
 * sets are already done.
 */

export type CircuitExerciseState = {
  /** `completedSets[i]` is whether set i of this exercise is done. */
  completedSets: boolean[];
};

export type CircuitTarget = { exerciseIndex: number; setIndex: number } | null;

/**
 * Starting just after `fromExerciseIndex`, walks forward through the other
 * exercises (wrapping around), and returns the earliest incomplete set of
 * the first one that still has one. An exercise with fewer sets than the
 * others simply falls out of rotation once its sets run out — later laps
 * skip straight past it — so a circuit of exercises with different set
 * counts still converges correctly instead of stalling.
 *
 * Returns null once every exercise is fully complete.
 */
export function findNextCircuitTarget(
  exercises: CircuitExerciseState[],
  fromExerciseIndex: number,
): CircuitTarget {
  const n = exercises.length;
  if (n === 0) return null;

  for (let step = 1; step <= n; step++) {
    const idx = (fromExerciseIndex + step) % n;
    const nextSet = exercises[idx].completedSets.findIndex((done) => !done);
    if (nextSet !== -1) {
      return { exerciseIndex: idx, setIndex: nextSet };
    }
  }
  return null;
}
