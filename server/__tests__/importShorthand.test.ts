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
import {
  expandShorthand,
  qualifiersOk,
} from "../services/importExerciseMatchService";

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

describe("abbreviated laterality", () => {
  // "SL RDL" used to expand to "Romanian Deadlift" — the SL simply vanished,
  // and a single-leg RDL is not a bilateral one. The match was reported as
  // confident, so nothing ever told the user a choice had been made.
  it("expands SL to single-leg", () => {
    expect(expandShorthand("SL RDL")).toContain("Single-Leg");
  });

  it("expands SA to single-arm", () => {
    expect(expandShorthand("SA DB Row")).toContain("Single-Arm");
  });

  it("leaves lowercase sl and sa alone", () => {
    // Case-sensitive on purpose: these two-letter tokens occur inside ordinary
    // words, so folding them blind would corrupt unrelated names.
    expect(expandShorthand("Slider Lunge")).toBe("Slider Lunge");
    expect(expandShorthand("Sandbag Carry")).toBe("Sandbag Carry");
  });
});

describe("a dropped qualifier must not pass as a confident match", () => {
  // The fuzzy layers match on overall similarity, so a qualifier can fall out
  // of the result entirely. Handing back the wrong exercise while reporting
  // confidence is worse than asking, because the user never sees that a
  // decision was made on their behalf.
  it("rejects a match that lost the laterality", () => {
    expect(qualifiersOk("SL RDL", "Romanian Deadlift")).toBe(false);
    expect(qualifiersOk("SL RDL", "Single-Leg Romanian Deadlift")).toBe(true);
  });

  it("rejects a match that lost the bench angle", () => {
    expect(qualifiersOk("Incline Dumbbell Press", "Dumbbell Press")).toBe(false);
    expect(qualifiersOk("Incline Dumbbell Press", "Incline Dumbbell Press")).toBe(true);
  });

  it("rejects a match that lost the grip", () => {
    expect(qualifiersOk("Close-Grip Bench Press", "Bench Press")).toBe(false);
  });

  it("allows the match to be MORE specific than the request", () => {
    // Adding a qualifier is the equipment layer's business, not this guard's —
    // this one only fires when something the user asked for went missing.
    expect(qualifiersOk("Bench Press", "Incline Bench Press")).toBe(true);
  });

  it("ignores wording that does not change the movement", () => {
    // Guarding words like "seated" would bury the user in questions about
    // differences that do not matter.
    expect(qualifiersOk("Seated Cable Row", "Cable Row")).toBe(true);
  });
});
