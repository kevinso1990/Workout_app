import { describe, it, expect } from "vitest";

import {
  findMobilityDayToSplit,
  isMobilityDay,
  splitMobilityDay,
} from "@/lib/mobilitySplit";
import { MOBILITY_PLAN_ID } from "@/lib/mobilitySchedule";
import type { WorkoutPlan } from "@/lib/storage";

const ex = (name: string) => ({ id: name, name, muscleGroup: "Back", sets: 2, reps: "30s" });

const plan: WorkoutPlan = {
  id: "p1",
  name: "Ganzkörper",
  daysPerWeek: 4,
  days: [
    { dayName: "Full Body A", exercises: [ex("Barbell Squat"), ex("Bench Press")] },
    { dayName: "Full Body B", exercises: [ex("Deadlift")] },
    { dayName: "Tag 3", exercises: [ex("Cat Stretch"), ex("Pigeon Stretch"), ex("Plank")] },
    { dayName: "Full Body C", exercises: [ex("Row")] },
  ],
  createdAt: "",
  lastModified: "",
};

describe("isMobilityDay", () => {
  it("recognises mobility by name or by mostly-stretch content", () => {
    expect(isMobilityDay({ dayName: "Mobility & Dehnen", exercises: [] })).toBe(true);
    expect(isMobilityDay(plan.days[2])).toBe(true);
    expect(isMobilityDay(plan.days[0])).toBe(false);
  });
});

describe("findMobilityDayToSplit", () => {
  it("finds the mobility day inside a training plan", () => {
    const c = findMobilityDayToSplit([plan], new Set());
    expect(c?.dayIndex).toBe(2);
    expect(c?.key).toBe("p1:Tag 3");
  });

  it("skips answered days, the mobility plan itself and mobility-only plans", () => {
    expect(findMobilityDayToSplit([plan], new Set(["p1:Tag 3"]))).toBeNull();
    const onlyMobility = { ...plan, id: "p2", days: [plan.days[2]] };
    const mobilityPlan = { ...plan, id: MOBILITY_PLAN_ID };
    expect(findMobilityDayToSplit([mobilityPlan, onlyMobility], new Set())).toBeNull();
  });
});

describe("splitMobilityDay", () => {
  it("moves the day into the standalone Mobility-Session", () => {
    const { trainingPlan, mobilityPlan } = splitMobilityDay(plan, 2, "Mobility-Session", "now");
    expect(trainingPlan.days.map((d) => d.dayName)).toEqual(["Full Body A", "Full Body B", "Full Body C"]);
    expect(trainingPlan.daysPerWeek).toBe(3);
    expect(mobilityPlan.id).toBe(MOBILITY_PLAN_ID);
    expect(mobilityPlan.days[0].exercises.map((e) => e.name)).toEqual(["Cat Stretch", "Pigeon Stretch", "Plank"]);
  });
});
