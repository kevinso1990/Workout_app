import { describe, it, expect } from "vitest";
import { isAvoidedExercise, filterAvoidedExercises, mergeAvoidLists } from "../avoidExercises";

describe("isAvoidedExercise", () => {
  it("matches case-insensitively", () => {
    expect(isAvoidedExercise("Good Mornings", ["good mornings"])).toBe(true);
  });

  it("matches umlauts regardless of how either side spells them", () => {
    expect(isAvoidedExercise("Überkopfdrücken", ["Ueberkopfdruecken"])).toBe(false); // not folded both ways — see below
    expect(isAvoidedExercise("Überkopfdrücken", ["überkopfdrücken"])).toBe(true);
  });

  it("matches when the catalog name is a superset of the avoid phrase", () => {
    // Avoid-list entry "Good Mornings" should catch a more specific catalog
    // variant like "Barbell Good Mornings".
    expect(isAvoidedExercise("Barbell Good Mornings", ["Good Mornings"])).toBe(true);
  });

  it("does not exclude a generic exercise just because a longer avoid phrase contains it", () => {
    // Avoiding the specific "Reverse Lunge Knee Drive" must not also take out
    // plain "Lunge" from the pool — that is a different, broader movement the
    // user never said to avoid. Matching both directions would do exactly that.
    expect(isAvoidedExercise("Lunge", ["Reverse Lunge Knee Drive"])).toBe(false);
  });

  it("excludes a more specific catalog name when the avoid phrase is its prefix", () => {
    expect(isAvoidedExercise("Reverse Lunge Knee Drive", ["Reverse Lunge"])).toBe(true);
  });

  it("does not match unrelated exercises", () => {
    expect(isAvoidedExercise("Bench Press", ["Good Mornings", "Toes-to-Bar"])).toBe(false);
  });

  it("is false with an empty avoid list", () => {
    expect(isAvoidedExercise("Good Mornings", [])).toBe(false);
  });
});

describe("filterAvoidedExercises", () => {
  const exercises = [
    { name: "Bench Press" },
    { name: "Good Mornings" },
    { name: "Squat" },
  ];

  it("removes only the avoided entries", () => {
    const out = filterAvoidedExercises(exercises, ["Good Mornings"]);
    expect(out.map((e) => e.name)).toEqual(["Bench Press", "Squat"]);
  });

  it("is a no-op with no avoid list", () => {
    expect(filterAvoidedExercises(exercises, undefined)).toBe(exercises);
    expect(filterAvoidedExercises(exercises, [])).toBe(exercises);
  });
});

describe("mergeAvoidLists", () => {
  it("de-duplicates case- and accent-insensitively", () => {
    const out = mergeAvoidLists(["Good Mornings"], ["good mornings", "Toes-to-Bar"]);
    expect(out).toEqual(["Good Mornings", "Toes-to-Bar"]);
  });

  it("drops blank entries", () => {
    expect(mergeAvoidLists([], ["", "  ", "Real Exercise"])).toEqual(["Real Exercise"]);
  });

  it("caps the list length", () => {
    const many = Array.from({ length: 60 }, (_, i) => `Exercise ${i}`);
    expect(mergeAvoidLists([], many).length).toBe(50);
  });
});
