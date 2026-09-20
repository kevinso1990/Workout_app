/**
 * Gym shorthand in hand-written plans.
 *
 * Imported plans arrive full of abbreviations the catalog never stores, so
 * "Single Leg KB RDL" and "Alternate DB High Pulls" came back as "needs
 * mapping" and the athlete had to assign them by hand — the single most
 * tedious part of importing a plan. These are the real strings from a user's
 * plan that failed.
 */

import { describe, it, expect } from "vitest";
import { expandShorthand } from "../services/importExerciseMatchService";

describe("expandShorthand", () => {
  it("expands the abbreviations that actually blocked an import", () => {
    expect(expandShorthand("Single Leg KB RDL")).toBe(
      "Single Leg Kettlebell Romanian Deadlift",
    );
    expect(expandShorthand("Alternate DB High Pulls")).toBe(
      "alternating Dumbbell High Pulls",
    );
    expect(expandShorthand("DB Bench Press")).toBe("Dumbbell Bench Press");
    expect(expandShorthand("BB Row")).toBe("Barbell Row");
    expect(expandShorthand("OHP")).toBe("Overhead Press");
  });

  it("handles plural forms", () => {
    expect(expandShorthand("RDLs")).toBe("Romanian Deadlift");
    expect(expandShorthand("KBs")).toBe("Kettlebell");
  });

  it("only rewrites whole words", () => {
    // The equipment abbreviations are case-sensitive on purpose: rewriting a
    // lowercase "db"/"kb" inside ordinary words would corrupt real names.
    expect(expandShorthand("Dumbbell Press")).toBe("Dumbbell Press");
    expect(expandShorthand("Kettlebell Swing")).toBe("Kettlebell Swing");
    expect(expandShorthand("Barbell Row")).toBe("Barbell Row");
  });

  it("leaves names without shorthand untouched", () => {
    for (const n of ["Hip Airplane", "Dead Stop Row", "Cossack Squat", "Plank"]) {
      expect(expandShorthand(n), n).toBe(n);
    }
  });
});
