/**
 * The avoid-list half of import normalization.
 *
 * Verified live against a real physio plan PDF that this needs a safety net:
 * the source table groups several exercise names into one row ("V-Ups,
 * Jackknives, Sit-Ups mit fixierten Füßen"), and a model that returns that as
 * one joined string would produce an avoid-list entry that can never match a
 * single exercise and renders as one ugly chip. An exercise name never
 * legitimately contains a comma, so splitting on one is safe regardless of
 * whether the extraction prompt's own split instruction was followed.
 */
import { describe, it, expect } from "vitest";
import { normalizeImportedPlan } from "../routes/importWorkout";

function run(avoidExercises: unknown) {
  return normalizeImportedPlan({ planName: "P", days: [], avoidExercises }) as {
    avoidExercises: string[];
  };
}

describe("normalizeImportedPlan — avoidExercises", () => {
  it("splits a comma-joined row the model failed to separate", () => {
    const out = run(["V-Ups, Jackknives, Sit-Ups mit fixierten Füßen"]);
    expect(out.avoidExercises).toEqual(["V-Ups", "Jackknives", "Sit-Ups mit fixierten Füßen"]);
  });

  it("leaves already-separate entries alone", () => {
    const out = run(["Superman", "Good Mornings"]);
    expect(out.avoidExercises).toEqual(["Superman", "Good Mornings"]);
  });

  it("de-duplicates case-insensitively across entries, including after splitting", () => {
    const out = run(["Good Mornings, Superman", "superman"]);
    expect(out.avoidExercises).toEqual(["Good Mornings", "Superman"]);
  });

  it("defaults to an empty array when the field is absent or malformed", () => {
    expect(run(undefined).avoidExercises).toEqual([]);
    expect(run("not an array").avoidExercises).toEqual([]);
    expect(run([1, 2, 3]).avoidExercises).toEqual([]);
  });

  it("drops blank fragments produced by a trailing comma", () => {
    const out = run(["Superman, "]);
    expect(out.avoidExercises).toEqual(["Superman"]);
  });
});
