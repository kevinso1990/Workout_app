import { describe, it, expect } from "vitest";
import {
  cycleWeekIndex,
  planDayOnDate,
  planTrainingWeek,
  weekdaysOfDay,
  type PlanSchedule,
} from "../planSchedule";

// GK plan: Mo mobility, Di/Do short, Sa long — rotating over three weeks.
const days = [
  { id: "mob", dayName: "Mobility" },
  { id: "ak", dayName: "GK A kurz" },
  { id: "bk", dayName: "GK B kurz" },
  { id: "ck", dayName: "GK C kurz" },
  { id: "al", dayName: "GK A lang" },
  { id: "bl", dayName: "GK B lang" },
  { id: "cl", dayName: "GK C lang" },
];
const schedule: PlanSchedule = {
  cycleStart: "2026-11-09", // a Monday
  weeks: [
    [{ weekday: 0, dayId: "mob" }, { weekday: 1, dayId: "bk" }, { weekday: 3, dayId: "ck" }, { weekday: 5, dayId: "al" }],
    [{ weekday: 0, dayId: "mob" }, { weekday: 1, dayId: "ck" }, { weekday: 3, dayId: "ak" }, { weekday: 5, dayId: "bl" }],
    [{ weekday: 0, dayId: "mob" }, { weekday: 1, dayId: "ak" }, { weekday: 3, dayId: "bk" }, { weekday: 5, dayId: "cl" }],
  ],
};
const date = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0);

describe("plan schedule with rotation", () => {
  it("counts cycle weeks from the start Monday and wraps", () => {
    expect(cycleWeekIndex(schedule, date(2026, 11, 9))).toBe(0);
    expect(cycleWeekIndex(schedule, date(2026, 11, 15))).toBe(0); // Sunday, same week
    expect(cycleWeekIndex(schedule, date(2026, 11, 17))).toBe(1);
    expect(cycleWeekIndex(schedule, date(2026, 11, 24))).toBe(2);
    expect(cycleWeekIndex(schedule, date(2026, 12, 1))).toBe(0);
    expect(cycleWeekIndex(schedule, date(2026, 11, 2))).toBe(2); // before the start
  });

  it("puts each week's sessions on the plan's weekdays", () => {
    const at = (d: Date) => planDayOnDate({ commitments: [], days, schedule, date: d });
    expect(at(date(2026, 11, 10))).toBe(2); // week 1 Tue → GK B kurz
    expect(at(date(2026, 11, 14))).toBe(4); // week 1 Sat → GK A lang
    expect(at(date(2026, 11, 19))).toBe(1); // week 2 Thu → GK A kurz
    expect(at(date(2026, 11, 28))).toBe(6); // week 3 Sat → GK C lang
    expect(at(date(2026, 11, 11))).toBeUndefined(); // Wed is free
  });

  it("lays out the current week with its cycle position", () => {
    const week = planTrainingWeek({ commitments: [], days, schedule, now: date(2026, 11, 18) });
    expect(week.cycle).toEqual({ week: 2, of: 3 });
    expect(week.slots.map((s) => s.kind)).toEqual(["gym", "gym", "rest", "gym", "rest", "gym", "rest"]);
    expect(week.slots[1].dayName).toBe("GK C kurz");
  });

  it("keeps sport commitments on the plan's free days", () => {
    const week = planTrainingWeek({
      commitments: [{ id: "c", weekday: 6, sport: "custom", label: "Cardio 4×4" }],
      days,
      schedule,
      now: date(2026, 11, 10),
    });
    expect(week.slots[6].kind).toBe("sport");
  });

  it("ignores entries whose day was deleted and falls back when nothing resolves", () => {
    const fewer = days.filter((d) => d.id !== "bk");
    expect(planDayOnDate({ commitments: [], days: fewer, schedule, date: date(2026, 11, 10) })).toBeUndefined();
    const auto = planTrainingWeek({
      commitments: [],
      days: [{ dayName: "A" }, { dayName: "B" }],
      schedule,
      now: date(2026, 11, 10),
    });
    expect(auto.cycle).toBeNull();
    expect(auto.dayIndexByWeekday.size).toBe(2);
  });

  it("lists a day's weekdays across the cycle", () => {
    expect(weekdaysOfDay(schedule, "mob")).toEqual([0]);
    expect(weekdaysOfDay(schedule, "ak")).toEqual([1, 3]);
    expect(weekdaysOfDay(undefined, "ak")).toEqual([]);
  });
});
