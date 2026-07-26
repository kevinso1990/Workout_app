/**
 * Regression guards for the exercise-display + set-logging helpers.
 *
 * Each block here maps to a real bug that shipped and was caught only by manual
 * testing — these tests exist so it can't happen silently again:
 *  - German exercise names stopped switching (name_de dropped from the API).
 *  - The weight slider jumped in 2.5 kg steps instead of 1 kg.
 *  - Exact/half-kg entry got snapped away.
 *  - The Mobility filter classifier.
 */

import { describe, it, expect } from "vitest";

import { getExerciseDisplayName } from "@/lib/exerciseDisplayName";
import { isMobilityExercise } from "@/lib/exerciseTaxonomy";
import {
  WEIGHT_SLIDER_STEP_KG,
  clampAndFormatWeight,
  clampAndFormatWeightExact,
  clampAndFormatReps,
} from "@/lib/activeWorkoutSetFormat";

describe("getExerciseDisplayName (German name regression)", () => {
  const ex = { name: "Barbell Deadlift", nameDe: "Kreuzheben" };

  it("shows the German label when the language is German", () => {
    expect(getExerciseDisplayName(ex, "de")).toBe("Kreuzheben");
    expect(getExerciseDisplayName(ex, "de-DE")).toBe("Kreuzheben");
  });

  it("shows the canonical English name for English", () => {
    expect(getExerciseDisplayName(ex, "en")).toBe("Barbell Deadlift");
    expect(getExerciseDisplayName(ex, "en-US")).toBe("Barbell Deadlift");
  });

  it("falls back to the English name when no German translation exists", () => {
    expect(
      getExerciseDisplayName({ name: "Atlas Stones", nameDe: null }, "de"),
    ).toBe("Atlas Stones");
    expect(
      getExerciseDisplayName({ name: "Atlas Stones" }, "de"),
    ).toBe("Atlas Stones");
  });
});

describe("isMobilityExercise", () => {
  it("classifies stretch/mobility moves", () => {
    expect(isMobilityExercise("Hamstring Stretch")).toBe(true);
    expect(isMobilityExercise("World's Greatest Stretch")).toBe(true);
    expect(isMobilityExercise("Cat Stretch")).toBe(true);
  });

  it("does not classify strength moves as mobility", () => {
    expect(isMobilityExercise("Barbell Bench Press")).toBe(false);
    expect(isMobilityExercise("Deadlift")).toBe(false);
    expect(isMobilityExercise("Kettlebell Swing")).toBe(false);
  });
});

describe("weight formatting", () => {
  it("the slider step is 1 kg (was 2.5 and landed on odd values)", () => {
    expect(WEIGHT_SLIDER_STEP_KG).toBe(1);
  });

  it("clampAndFormatWeight snaps to whole kilos", () => {
    expect(clampAndFormatWeight("22.4")).toBe("22");
    expect(clampAndFormatWeight("22.6")).toBe("23");
    expect(clampAndFormatWeight("100")).toBe("100");
  });

  it("clampAndFormatWeightExact keeps half-kg values (fixed dumbbells)", () => {
    expect(clampAndFormatWeightExact("22.5")).toBe("22.5");
    expect(clampAndFormatWeightExact("22")).toBe("22");
    expect(clampAndFormatWeightExact("7,5")).toBe("7.5"); // comma decimal
  });

  it("both clamp to the 0–500 range and reject junk", () => {
    expect(clampAndFormatWeight("-5")).toBe("");
    expect(clampAndFormatWeight("999")).toBe("500");
    expect(clampAndFormatWeightExact("abc")).toBe("");
  });
});

describe("clampAndFormatReps", () => {
  it("keeps positive integers, caps at 100, rejects junk", () => {
    expect(clampAndFormatReps("8")).toBe("8");
    expect(clampAndFormatReps("250")).toBe("100");
    expect(clampAndFormatReps("0")).toBe("");
    expect(clampAndFormatReps("abc")).toBe("");
  });
});
