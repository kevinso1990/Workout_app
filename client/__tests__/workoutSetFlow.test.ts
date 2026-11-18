import { describe, it, expect } from "vitest";

import {
  appendedSet,
  beatsTopSet,
  replicateSource,
  topSet,
  carryOverToNextSet,
  isExerciseDone,
  liveSets,
  nextOpenExercise,
  nextSupersetStep,
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

describe("nextSupersetStep", () => {
  // A1 = 0, A2 = 1, a finisher at 2 outside the superset.
  const members = [0, 1];

  it("alternates A1 → A2 without rest, then rests before the next round", () => {
    expect(nextSupersetStep(members, [[true, false], [false, false], [false]], 0)).toEqual({
      target: { exerciseIndex: 1, setIndex: 0 },
      rest: false,
    });
    expect(nextSupersetStep(members, [[true, false], [true, false], [false]], 1)).toEqual({
      target: { exerciseIndex: 0, setIndex: 1 },
      rest: true,
    });
  });

  it("keeps going on the member with sets left once the other is done", () => {
    expect(nextSupersetStep(members, [[true, false], [true, true], [false]], 0)).toEqual({
      target: { exerciseIndex: 0, setIndex: 1 },
      rest: true,
    });
  });

  it("reports the superset as finished", () => {
    expect(nextSupersetStep(members, [[true], [true], [false]], 1)).toEqual({ target: null, rest: false });
  });
});

describe("topSet", () => {
  it("picks the heaviest working set, then the most reps", () => {
    const sets = [
      set("60", "10", true, { setType: "warmup" }),
      set("90", "5", true),
      set("92.5", "3", true),
      set("92.5", "4", true),
      set("100", "", false),
    ];
    expect(topSet(sets, false)).toMatchObject({ weight: "92.5", reps: "4" });
  });

  it("uses reps for bodyweight moves and ignores open sets", () => {
    expect(topSet([set("", "12", true), set("", "15", true), set("", "20")], true)).toMatchObject({ reps: "15" });
    expect(topSet([set("80", "5")], false)).toBeNull();
  });

  it("beatsTopSet compares load first, reps on equal load", () => {
    expect(beatsTopSet(set("92,5", "3"), set("90", "5"), false)).toBe(true);
    expect(beatsTopSet(set("90", "6"), set("90", "5"), false)).toBe(true);
    expect(beatsTopSet(set("90", "5"), set("90", "5"), false)).toBe(false);
  });
});

describe("replicateSource", () => {
  it("copies the nearest done set of the same kind above", () => {
    const sets = [set("60", "10", true, { setType: "warmup" }), set("90", "5", true), set("", "")];
    expect(replicateSource(sets, 2)).toEqual({ weight: "90", reps: "5" });
  });

  it("falls back to last time's set at the same position", () => {
    const sets = [set("", ""), set("", "")];
    expect(replicateSource(sets, 1, [set("85", "6", true), set("85", "5", true)])).toEqual({ weight: "85", reps: "5" });
    expect(replicateSource(sets, 1)).toBeNull();
  });
});
