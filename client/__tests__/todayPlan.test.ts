import { describe, it, expect } from "vitest";

import { scheduleTrainingWeek } from "@shared/weeklySchedule";
import { primaryPlan, todayOverview } from "@/lib/todayPlan";
import { MOBILITY_PLAN_ID } from "@/lib/mobilitySchedule";
import type { WorkoutPlan, WorkoutSession } from "@/lib/storage";

const ex = (name: string) => ({ name, sets: 3, reps: "8-12" }) as never;

const plan: WorkoutPlan = {
  id: "p1",
  name: "Ganzkörper",
  daysPerWeek: 3,
  days: [
    { dayName: "Ganzkörper A", exercises: [ex("Squat"), ex("Bench Press")] },
    { dayName: "Ganzkörper B", exercises: [ex("Deadlift")] },
    { dayName: "Ganzkörper C", exercises: [ex("Row"), ex("Dip"), ex("Curl")] },
  ],
  createdAt: "",
  lastModified: "",
};

const mobilityPlan: WorkoutPlan = {
  id: MOBILITY_PLAN_ID,
  name: "Mobility-Session",
  daysPerWeek: 1,
  days: [{ dayName: "Mobility", exercises: [ex("Pigeon Stretch")] }],
  createdAt: "",
  lastModified: "",
};

const gymWeekdays = scheduleTrainingWeek({
  commitments: [],
  sessionDayNames: plan.days.map((d) => d.dayName),
})
  .slots.filter((s) => s.kind === "gym")
  .map((s) => ({ weekday: s.weekday, dayName: s.dayName! }));

/** A date in the week of Mon 2026-10-19 on the given Monday-based weekday. */
const onWeekday = (wd: number, hour = 10) => new Date(2026, 9, 19 + wd, hour);

const logged = (date: Date, over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: "s",
  planId: "p1",
  planName: "Ganzkörper",
  dayName: "Ganzkörper A",
  completedAt: date.toISOString(),
  exercises: [ex("Squat")],
  ...over,
});

const base = { plans: [mobilityPlan, plan], commitments: [], mobilityWeekdays: [], history: [] };

describe("todayOverview", () => {
  it("offers the strength day the week strip puts on today", () => {
    const { weekday, dayName } = gymWeekdays[1];
    const o = todayOverview({ ...base, now: onWeekday(weekday) });
    expect(o.strength?.dayName).toBe(dayName);
    expect(o.strength?.dayIndex).toBe(plan.days.findIndex((d) => d.dayName === dayName));
    expect(o.next).toBeNull();
  });

  it("points to the next session on a rest day", () => {
    const gym = new Set(gymWeekdays.map((g) => g.weekday));
    const rest = [0, 1, 2, 3, 4, 5, 6].find((d) => !gym.has(d))!;
    const o = todayOverview({ ...base, now: onWeekday(rest) });
    expect(o.strength).toBeNull();
    const expected = [1, 2, 3, 4, 5, 6, 7].map((k) => (rest + k) % 7).find((d) => gym.has(d));
    expect(o.next?.weekday).toBe(expected);
  });

  it("stops offering the day once a strength workout is logged today", () => {
    const now = onWeekday(gymWeekdays[0].weekday, 18);
    const o = todayOverview({ ...base, now, history: [logged(onWeekday(gymWeekdays[0].weekday, 9))] });
    expect(o.strength).toBeNull();
    expect(o.doneToday).toBe(true);
    expect(o.next).not.toBeNull();
  });

  it("does not count a cardio log as today's strength workout", () => {
    const now = onWeekday(gymWeekdays[0].weekday, 18);
    const cardio = logged(onWeekday(gymWeekdays[0].weekday, 9), { workoutType: "cardio" });
    expect(todayOverview({ ...base, now, history: [cardio] }).strength).not.toBeNull();
  });

  it("offers the mobility session on its weekday until it is logged", () => {
    const now = onWeekday(3);
    expect(todayOverview({ ...base, mobilityWeekdays: [3], now }).mobility?.planId).toBe(MOBILITY_PLAN_ID);
    const done = logged(onWeekday(3, 8), { planId: MOBILITY_PLAN_ID });
    expect(todayOverview({ ...base, mobilityWeekdays: [3], now, history: [done] }).mobility).toBeNull();
    expect(todayOverview({ ...base, mobilityWeekdays: [2], now }).mobility).toBeNull();
  });

  it("reports today's sport commitment and keeps gym off that day", () => {
    const commitments = [{ id: "c", weekday: 1 as const, sport: "football" as never }];
    const o = todayOverview({ ...base, commitments, now: onWeekday(1) });
    expect(o.sport?.weekday).toBe(1);
    expect(o.strength).toBeNull();
  });
});

describe("primaryPlan", () => {
  it("skips the Mobility-Session plan", () => {
    expect(primaryPlan([mobilityPlan, plan])?.id).toBe("p1");
    expect(primaryPlan([mobilityPlan])).toBeNull();
  });
});
