/**
 * Pins the German-name rules against the real defects found in the catalog.
 * Every "bad" case below is a name that was actually shipped.
 */

import { describe, it, expect } from "vitest";
import { auditGermanExerciseName } from "../services/translationAudit";

describe("auditGermanExerciseName — wrong equipment", () => {
  it("flags a barbell exercise whose German says Kurzhantel", () => {
    // All three shipped: they told the athlete to pick up dumbbells for a
    // barbell lift.
    for (const de of [
      "Kurzhantelrudern aufrecht",
      "Kurzhantel Pullover",
      "Enges Kurzhantel-Bizepscurl",
    ]) {
      expect(auditGermanExerciseName(de, "barbell"), de).toEqual({
        kind: "wrong-equipment",
        says: "kurzhantel",
      });
    }
  });

  it("flags a dumbbell exercise whose German says Langhantel", () => {
    expect(auditGermanExerciseName("Langhantel-Rudern", "dumbbell")).toEqual({
      kind: "wrong-equipment",
      says: "langhantel",
    });
  });

  it("flags free weights named on cable and bodyweight movements", () => {
    expect(auditGermanExerciseName("Kurzhantel-Rudern", "cable")).toEqual({
      kind: "wrong-equipment",
      says: "kurzhantel",
    });
    expect(auditGermanExerciseName("Langhantel-Curl", "body only")).toEqual({
      kind: "wrong-equipment",
      says: "langhantel",
    });
  });
});

describe("auditGermanExerciseName — ambiguous Hantel", () => {
  it("flags bare Hantel on dumbbell exercises", () => {
    for (const de of [
      "Hanteldrücken",
      "Hantelrudern",
      "Hantelfliegen",
      "Hantelschulterpresse",
      "Wadenheben mit Hantel",
    ]) {
      expect(auditGermanExerciseName(de, "dumbbell"), de).toEqual({
        kind: "ambiguous-hantel",
      });
    }
  });

  it("accepts the corrected names", () => {
    for (const de of [
      "Kurzhantel-Bankdrücken (Flachbank)",
      "Kurzhantel-Schrägbankdrücken",
      "Einarmiges Kurzhantel-Rudern",
      "Wadenheben mit Kurzhantel",
    ]) {
      expect(auditGermanExerciseName(de, "dumbbell"), de).toBeNull();
    }
  });
});

describe("auditGermanExerciseName — must not cry wolf", () => {
  it("accepts a Smith machine naming a barbell, because it guides one", () => {
    expect(
      auditGermanExerciseName("Smith-Maschine Langhantelrudern", "machine"),
    ).toBeNull();
  });

  it("accepts barbell exercises that say Langhantel", () => {
    expect(auditGermanExerciseName("Langhantel-Bankdrücken", "barbell")).toBeNull();
  });

  it("accepts names that mention no equipment at all", () => {
    expect(auditGermanExerciseName("Klimmzüge", "body only")).toBeNull();
    expect(auditGermanExerciseName("Beinpresse", "machine")).toBeNull();
  });

  it("does not flag a dumbbell name that never says Hantel", () => {
    expect(auditGermanExerciseName("Goblet Squat", "dumbbell")).toBeNull();
  });

  it("handles missing data without throwing", () => {
    expect(auditGermanExerciseName("", "barbell")).toBeNull();
    expect(auditGermanExerciseName("Kurzhantel-Rudern", null)).toBeNull();
    expect(auditGermanExerciseName("Kurzhantel-Rudern", undefined)).toBeNull();
  });
});
