import { describe, it, expect } from "vitest";
import { importedPlanToStorage, withCardioCommitments } from "@/lib/importedPlan";
import type { ImportedWorkoutPlan } from "@/hooks/useWorkoutImport";

const imported: ImportedWorkoutPlan = {
  planName: "GK Advanced",
  days: [
    { dayName: "Mobility", kind: "mobility", exercises: [{ name: "Child's Pose", sets: 1, reps: "60 s", weight: null, notes: null }] },
    {
      dayName: "GK A kurz – Bein / Hinge",
      kind: "strength",
      warmup: "Couch Stretch 45 Sek/Seite",
      exercises: [
        { name: "Trap Bar Deadlift", sets: 3, reps: "6-8", weight: null, notes: "Volle Pause.", superset: "A", restSeconds: 90, alternative: "Zuhause: KB Suitcase DL" },
        { name: "Copenhagen Plank", sets: 3, reps: "20-30 s", perSide: true, weight: null, notes: null, superset: "A", restSeconds: 90 },
      ],
    },
    { dayName: "GK A lang", kind: "strength", exercises: [{ name: "Dips", sets: 4, reps: "8-10", weight: null, notes: null }] },
    { dayName: "Cardio 4×4", kind: "cardio", durationMinutes: 35, notes: "4 × 4 Min", exercises: [] },
  ],
  schedule: {
    weeks: [
      [{ weekday: 0, dayIndex: 0 }, { weekday: 1, dayIndex: 1 }, { weekday: 5, dayIndex: 2 }, { weekday: 6, dayIndex: 3 }],
      [{ weekday: 0, dayIndex: 0 }, { weekday: 3, dayIndex: 1 }, { weekday: 6, dayIndex: 3 }],
    ],
  },
};

describe("importedPlanToStorage", () => {
  const now = new Date(2026, 10, 11, 12); // Wednesday 11 Nov 2026
  const { plan, cardioDays } = importedPlanToStorage(imported, "p1", now);

  it("keeps structure and drops the cardio day from the lifting plan", () => {
    expect(plan.days.map((d) => d.dayName)).toEqual(["Mobility", "GK A kurz – Bein / Hinge", "GK A lang"]);
    expect(plan.days[0].kind).toBe("mobility");
    expect(plan.days[1].warmup).toBe("Couch Stretch 45 Sek/Seite");
    const [dl, cph] = plan.days[1].exercises;
    expect(dl).toMatchObject({ reps: "6-8", targetReps: 6, superset: "A", restSeconds: 90, notes: "Volle Pause.", alternative: "Zuhause: KB Suitcase DL" });
    expect(cph).toMatchObject({ reps: "20-30 s", perSide: true });
  });

  it("maps the rotation onto stable day ids, starting this week", () => {
    expect(plan.schedule).toEqual({
      cycleStart: "2026-11-09",
      weeks: [
        [{ weekday: 0, dayId: "p1-d0" }, { weekday: 1, dayId: "p1-d1" }, { weekday: 5, dayId: "p1-d2" }],
        [{ weekday: 0, dayId: "p1-d0" }, { weekday: 3, dayId: "p1-d1" }],
      ],
    });
    // Strength sessions per week, mobility not counted.
    expect(plan.daysPerWeek).toBe(2);
  });

  it("turns the cardio day into weekly appointments", () => {
    expect(cardioDays).toEqual([{ label: "Cardio 4×4", weekdays: [6], durationMinutes: 35 }]);
    const commitments = withCardioCommitments([], cardioDays, "p1");
    expect(commitments).toEqual([{ id: "p1-cardio-6", weekday: 6, sport: "custom", label: "Cardio 4×4", durationMinutes: 35 }]);
    const taken = [{ id: "x", weekday: 6 as const, sport: "football" as const }];
    expect(withCardioCommitments(taken, cardioDays, "p1")).toBe(taken);
  });

  it("leaves a plan without weekdays unscheduled", () => {
    const { plan: plain } = importedPlanToStorage({ ...imported, schedule: { weeks: [] } }, "p2", now);
    expect(plain.schedule).toBeUndefined();
    expect(plain.daysPerWeek).toBe(3);
  });
});
