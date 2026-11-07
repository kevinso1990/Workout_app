import { describe, it, expect } from "vitest";

import {
  appendedSet,
  carryOverToNextSet,
  isExerciseDone,
  liveSets,
  nextOpenExercise,
} from "@/lib/workoutSetFlow";
import type { ExerciseProgress, SetData } from "@/lib/storage";

const set = (weight: string, reps: string, completed = false, extra: Partial<SetData> = {}): SetData => ({
  weight,
  reps,
  rating: null,
  completed,
  ...extra,
});

describe("closing an exercise early", () => {
  const ep: ExerciseProgress = {
    exerciseId: "a",
    sets: [set("80", "8", true), set("", ""), set("", "")],
  };

  it("drops the unfinished sets out of the totals once closed", () => {
    expect(liveSets(ep)).toHaveLength(3);
    expect(isExerciseDone(ep)).toBe(false);
    const closed = { ...ep, closed: true };
    expect(liveSets(closed)).toHaveLength(1);
    expect(isExerciseDone(closed)).toBe(true);
  });

  it("skips closed exercises when looking for the next set", () => {
    const progress: ExerciseProgress[] = [
      { exerciseId: "a", sets: [set("80", "8", true)] },
      { ...ep, closed: true },
      { exerciseId: "c", sets: [set("20", "10", true), set("", "")] },
    ];
    expect(nextOpenExercise(progress, 0)).toEqual({ exerciseIndex: 2, setIndex: 1 });
    expect(nextOpenExercise(progress, 2)).toBeNull();
  });
});

describe("carryOverToNextSet", () => {
  it("carries the weight just lifted into the next set", () => {
    expect(carryOverToNextSet(set("80", "8", true), set("", ""), false)).toEqual({ weight: "80", reps: "8" });
    // A prefilled weight from last week is replaced; planned reps stay.
    expect(carryOverToNextSet(set("80", "8", true), set("75", "10"), false)).toEqual({ weight: "80", reps: "10" });
  });

  it("leaves warm-ups, bodyweight, finished and unchanged sets alone", () => {
    expect(carryOverToNextSet(set("40", "10", true, { setType: "warmup" }), set("", ""), false)).toBeNull();
    expect(carryOverToNextSet(set("80", "8", true), set("", "", false, { setType: "warmup" }), false)).toBeNull();
    expect(carryOverToNextSet(set("", "12", true), set("", ""), true)).toBeNull();
    expect(carryOverToNextSet(set("80", "8", true), set("80", "8", true), false)).toBeNull();
    expect(carryOverToNextSet(set("80", "8", true), set("80", "8"), false)).toBeNull();
    expect(carryOverToNextSet(set("80", "8", true), undefined, false)).toBeNull();
  });
});

describe("appendedSet", () => {
  it("copies the last working set's load, not done", () => {
    expect(appendedSet([set("80", "8", true), set("82", "6", true)])).toEqual(set("82", "6"));
    expect(appendedSet([set("80", "8", true), set("40", "10", false, { setType: "warmup" })])).toEqual(
      set("80", "8"),
    );
    expect(appendedSet([])).toEqual(set("", ""));
  });
});
