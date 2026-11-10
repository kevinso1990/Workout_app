import { describe, it, expect } from "vitest";
import {
  normalizeRepsTarget,
  normalizeSchedule,
  normalizeSets,
  normalizeSuperset,
  stripWeekdaySuffix,
} from "../services/importStructure";
import { normalizeImportedPlan } from "../routes/importWorkout";
import { initDb } from "../db";

// normalizeImportedPlan matches names against the seeded exercise catalog.
initDb();

describe("normalizeRepsTarget", () => {
  it("reads ranges, seconds, minutes and per-side targets", () => {
    expect(normalizeRepsTarget("6–8")).toEqual({ reps: "6-8", perSide: false });
    expect(normalizeRepsTarget("20–30 Sek/Seite")).toEqual({ reps: "20-30 s", perSide: true });
    expect(normalizeRepsTarget("45 Sek")).toEqual({ reps: "45 s", perSide: false });
    expect(normalizeRepsTarget("2–3 Min")).toEqual({ reps: "120-180 s", perSide: false });
    expect(normalizeRepsTarget("8/Seite")).toEqual({ reps: "8", perSide: true });
    expect(normalizeRepsTarget("10", true)).toEqual({ reps: "10", perSide: true });
    expect(normalizeRepsTarget(12)).toEqual({ reps: "12", perSide: false });
    expect(normalizeRepsTarget(null)).toEqual({ reps: null, perSide: false });
  });
});

describe("structure helpers", () => {
  it("takes the upper bound of a set range", () => {
    expect(normalizeSets("2–3")).toBe(3);
    expect(normalizeSets(4)).toBe(4);
    expect(normalizeSets(undefined)).toBe(3);
  });

  it("accepts only block letters as supersets", () => {
    expect(normalizeSuperset("A")).toBe("A");
    expect(normalizeSuperset("Superset B")).toBe("B");
    expect(normalizeSuperset("A1")).toBe("A");
    expect(normalizeSuperset("Finisher")).toBeNull();
  });

  it("moves weekday hints out of session names", () => {
    expect(stripWeekdaySuffix("GK A lang – Bein / Hinge (Sa)")).toBe("GK A lang – Bein / Hinge");
    expect(stripWeekdaySuffix("Mobility – Mo abends")).toBe("Mobility");
    expect(stripWeekdaySuffix("Mobility + Hüftkraft mit Band (abends)")).toBe("Mobility + Hüftkraft mit Band");
    expect(stripWeekdaySuffix("GK B kurz – Pull")).toBe("GK B kurz – Pull");
  });
});

describe("normalizeSchedule", () => {
  const names = ["Mobility", "GK A kurz – Bein / Hinge", "GK B kurz – Pull", "Cardio 4×4"];

  it("resolves weekdays and loosely written day names", () => {
    const weeks = normalizeSchedule(
      {
        weeks: [
          { sessions: [{ weekday: "mon", dayName: "Mobility – Mo abends" }, { weekday: "tue", dayName: "GK B kurz" }] },
          { sessions: [{ weekday: "mon", dayName: "Mobility" }, { weekday: "tue", dayName: "GK A kurz – Bein / Hinge" }, { weekday: "sun", dayName: "Cardio 4×4" }] },
        ],
      },
      names,
    );
    expect(weeks).toEqual([
      [{ weekday: 0, dayIndex: 0 }, { weekday: 1, dayIndex: 2 }],
      [{ weekday: 0, dayIndex: 0 }, { weekday: 1, dayIndex: 1 }, { weekday: 6, dayIndex: 3 }],
    ]);
  });

  it("drops unknown days and collapses identical weeks", () => {
    const week = { sessions: [{ weekday: "tue", dayName: "GK A kurz – Bein / Hinge" }, { weekday: "fri", dayName: "Yoga" }] };
    expect(normalizeSchedule({ weeks: [week, week] }, names)).toEqual([[{ weekday: 1, dayIndex: 1 }]]);
    expect(normalizeSchedule(undefined, names)).toEqual([]);
  });
});

describe("normalizeImportedPlan — full plan vs. older app builds", () => {
  const raw = () => ({
    planName: "GK",
    avoidExercises: [],
    days: [
      { dayName: "GK A kurz – Bein / Hinge", kind: "strength", warmup: "Couch Stretch", exercises: [
        { name: "A1 Trap Bar Deadlift", sets: 3, reps: "6–8", superset: "A", restSeconds: 90, alternative: "Zuhause: KB Suitcase DL" },
        { name: "A2 Copenhagen Plank", sets: 3, reps: "20–30 Sek", perSide: true, superset: "A", restSeconds: 90 },
        { name: "Hip Airplanes", sets: 2, reps: "6/Seite", superset: "C" },
      ] },
      { dayName: "Mobility – Mo abends", kind: "mobility", exercises: [{ name: "Child's Pose", sets: 1, reps: "60 Sek" }] },
      { dayName: "Cardio 4×4", kind: "cardio", notes: "4 × 4 Min", exercises: [{ name: "Intervalle", sets: 4, reps: "4 Min" }] },
    ],
    schedule: { weeks: [{ sessions: [
      { weekday: "mon", dayName: "Mobility" },
      { weekday: "tue", dayName: "GK A kurz – Bein / Hinge" },
      { weekday: "sun", dayName: "Cardio 4×4" },
    ] }] },
  });

  it("keeps structure, mobility/cardio days and the schedule for v2 clients", () => {
    const plan = normalizeImportedPlan(raw(), { fullPlan: true }) as any;
    expect(plan.days.map((d: any) => [d.dayName, d.kind])).toEqual([
      ["GK A kurz – Bein / Hinge", "strength"],
      ["Mobility", "mobility"],
      ["Cardio 4×4", "cardio"],
    ]);
    const [dl, cph, air] = plan.days[0].exercises;
    expect(dl.importMeta.originalName).toBe("Trap Bar Deadlift");
    expect([dl.reps, dl.superset, dl.restSeconds, dl.alternative]).toEqual(["6-8", "A", 90, "Zuhause: KB Suitcase DL"]);
    expect([cph.reps, cph.perSide]).toEqual(["20-30 s", true]);
    // A lone "superset" is just an exercise.
    expect([air.reps, air.perSide, air.superset]).toEqual(["6", true, null]);
    expect(plan.days[0].warmup).toBe("Couch Stretch");
    expect(plan.days[2].exercises).toEqual([]);
    expect(plan.schedule.weeks).toEqual([[{ weekday: 0, dayIndex: 1 }, { weekday: 1, dayIndex: 0 }, { weekday: 6, dayIndex: 2 }]]);
  });

  it("sends older builds strength days only, without a schedule", () => {
    const plan = normalizeImportedPlan(raw()) as any;
    expect(plan.days.map((d: any) => d.dayName)).toEqual(["GK A kurz – Bein / Hinge"]);
    expect(plan.schedule).toBeUndefined();
  });
});
