import { describe, it, expect } from "vitest";

import { findNextCircuitTarget } from "@/lib/circuitMode";

function exerciseWith(totalSets: number, completedCount: number) {
  return {
    completedSets: Array.from({ length: totalSets }, (_, i) => i < completedCount),
  };
}

describe("findNextCircuitTarget", () => {
  it("rotates to the next exercise's first set, not the same exercise's next set", () => {
    const exercises = [exerciseWith(3, 1), exerciseWith(3, 0), exerciseWith(3, 0)];
    expect(findNextCircuitTarget(exercises, 0)).toEqual({ exerciseIndex: 1, setIndex: 0 });
  });

  it("wraps around to the first exercise for its second set once every exercise has had a turn", () => {
    const exercises = [exerciseWith(3, 1), exerciseWith(3, 1), exerciseWith(3, 1)];
    // Just finished exercise 2's set 0 (first lap complete) — next is exercise 0, set 1.
    expect(findNextCircuitTarget(exercises, 2)).toEqual({ exerciseIndex: 0, setIndex: 1 });
  });

  it("skips an exercise that has run out of sets, without stalling the rotation", () => {
    // Exercise 1 only has 2 sets and both are already done.
    const exercises = [exerciseWith(3, 1), exerciseWith(2, 2), exerciseWith(3, 1)];
    expect(findNextCircuitTarget(exercises, 0)).toEqual({ exerciseIndex: 2, setIndex: 1 });
  });

  it("returns null once every exercise is fully complete", () => {
    const exercises = [exerciseWith(2, 2), exerciseWith(3, 3)];
    expect(findNextCircuitTarget(exercises, 0)).toBeNull();
  });

  it("wraps a single-exercise circuit back onto itself", () => {
    const exercises = [exerciseWith(4, 1)];
    expect(findNextCircuitTarget(exercises, 0)).toEqual({ exerciseIndex: 0, setIndex: 1 });
  });

  it("returns null for an empty exercise list", () => {
    expect(findNextCircuitTarget([], 0)).toBeNull();
  });
});
