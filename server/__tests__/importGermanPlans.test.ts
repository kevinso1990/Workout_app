/**
 * German trainer plans, as measured by the import benchmark (2026-11-20):
 * hand-written shorthand ("KH-Bankdr.", "rum. Kreuzh.") came back unmapped,
 * and the equipment the plan put in the note ("Rudern" · "Kabel") was ignored,
 * so the barbell default was picked. DB_PATH=":memory:" via vitest.config.ts.
 */
import { describe, it, expect, beforeAll } from "vitest";

import { initDb } from "../db";
import {
  expandShorthand,
  matchExerciseToCatalog,
  matchExerciseWithNotes,
} from "../services/importExerciseMatchService";

beforeAll(() => initDb());

describe("German shorthand", () => {
  it("expands what a coach writes by hand", () => {
    expect(expandShorthand("KH-Bankdr.")).toBe("Kurzhantel-Bankdrücken");
    expect(expandShorthand("rum. Kreuzh.")).toBe("Rumänisches Kreuzheben");
    expect(expandShorthand("Klimmz.")).toBe("Klimmzüge");
  });

  it("never rewrites inside full words", () => {
    for (const n of ["Bankdrücken", "Kreuzheben", "Klimmzüge", "Beinstrecker", "Rumänisches Kreuzheben"]) {
      expect(expandShorthand(n), n).toBe(n);
    }
  });

  it("maps abbreviated rows to the catalog without asking the user", () => {
    const expected: Record<string, RegExp> = {
      "KH-Bankdr.": /dumbbell bench press/i,
      "Schulterdr. KH": /dumbbell shoulder press/i,
      "LH-Rudern": /barbell row/i,
      "rum. Kreuzh.": /romanian deadlift/i,
      "Beinstr.": /leg extension/i,
      "Katze-Kuh": /cat stretch/i,
      // From public plans (Engel, Heimat KK) in the real-plan benchmark.
      "Brustpresse, sitzend": /machine chest press/i,
      "Rudern, eng": /seated cable row/i,
      "Seitheben am Kabel einarmig": /cable lateral raise/i,
      "Rudern LH vorgebeugt (Untergriff)": /reverse grip bent-over row/i,
    };
    for (const [raw, want] of Object.entries(expected)) {
      const m = matchExerciseToCatalog(raw);
      expect(m.needsUserMapping, raw).toBe(false);
      expect(m.canonicalName, raw).toMatch(want);
    }
  });
});

describe("equipment from the note", () => {
  it("uses the note's equipment when the name leaves it open", () => {
    expect(matchExerciseWithNotes("Rudern", "Superset A2, Kabel").canonicalName).toMatch(/cable/i);
    expect(matchExerciseWithNotes("Kreuzheben", "rumänisch, Pause 2 min").canonicalName).toMatch(/romanian/i);
    expect(matchExerciseWithNotes("Schrägbankdrücken", "Kurzhantel").canonicalName).toMatch(/incline dumbbell/i);
  });

  it("keeps the source's own name as the original", () => {
    expect(matchExerciseWithNotes("Rudern", "Kabel").originalName).toBe("Rudern");
  });

  it("falls back to the plain name without a usable hint", () => {
    expect(matchExerciseWithNotes("Bankdrücken", "RPE 8").canonicalName).toBe(
      matchExerciseToCatalog("Bankdrücken").canonicalName,
    );
    // The name already says which bar — a note can't override it.
    expect(matchExerciseWithNotes("Kurzhantel-Bankdrücken", "Langhantel geht auch").canonicalName).toMatch(/dumbbell/i);
  });
});

describe("cardio day from a table", () => {
  it("keeps the row as the day's prescription", async () => {
    const { normalizeImportedPlan } = await import("../routes/importWorkout");
    const plan = normalizeImportedPlan(
      {
        planName: "Plan Lisa",
        days: [
          { dayName: "Tag 1", kind: "strength", exercises: [{ name: "Bankdrücken", sets: 3, reps: "10" }] },
          { dayName: "Tag 3 Cardio", kind: "cardio", exercises: [{ name: "Laufen 30 Min locker" }] },
        ],
      },
      { fullPlan: true },
    );
    const cardio = (plan.days as Record<string, unknown>[])[1];
    expect(cardio.exercises).toEqual([]);
    expect(cardio.notes).toBe("Laufen 30 Min locker");
    expect(cardio.durationMinutes).toBe(30);
  });
});

describe("incomplete reads", () => {
  it("flags a read that stopped after one exercise", async () => {
    const { importLooksIncomplete } = await import("../routes/importWorkout");
    const thin = { days: [{ dayName: "Ganzkörper A", kind: "strength", exercises: [{ name: "Kniebeuge" }] }] };
    expect(importLooksIncomplete(thin, null)).toBe(true);
  });

  it("flags a read far below what the text parser sees", async () => {
    const { importLooksIncomplete } = await import("../routes/importWorkout");
    const five = { days: [{ dayName: "A", kind: "strength", exercises: Array.from({ length: 5 }, () => ({})) }] };
    expect(importLooksIncomplete(five, 15)).toBe(true);
    expect(importLooksIncomplete(five, 6)).toBe(false);
  });

  it("counts a cardio day as an item", async () => {
    const { importItemCount, importLooksIncomplete } = await import("../routes/importWorkout");
    const plan = {
      days: [
        { dayName: "A", kind: "strength", exercises: [{}, {}] },
        { dayName: "Cardio", kind: "cardio", exercises: [] },
      ],
    };
    expect(importItemCount(plan)).toBe(3);
    expect(importLooksIncomplete(plan, null)).toBe(false);
  });
});

describe("schedule", () => {
  it("keeps a third week that repeats the first", async () => {
    const { normalizeImportedPlan } = await import("../routes/importWorkout");
    const ex = [{ name: "Kniebeuge", sets: 3, reps: "6" }];
    const week = (a: string) => ({ sessions: [{ weekday: "mon", dayName: a }] });
    const plan = normalizeImportedPlan(
      {
        planName: "3-Wochen-Zyklus",
        days: [
          { dayName: "A kurz", kind: "strength", exercises: ex },
          { dayName: "B kurz", kind: "strength", exercises: ex },
        ],
        schedule: { weeks: [week("A kurz"), week("B kurz"), week("A kurz")] },
      },
      { fullPlan: true },
    );
    expect((plan.schedule as { weeks: unknown[] }).weeks).toHaveLength(3);
  });
});
