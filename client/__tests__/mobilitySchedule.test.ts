import { describe, it, expect } from "vitest";

import {
  isMobilitySession,
  mobilityReminderDates,
  mondayBasedWeekday,
  MOBILITY_PLAN_ID,
} from "@/lib/mobilitySchedule";

// Monday 2026-10-19, 10:00 local time.
const MONDAY_10AM = new Date(2026, 9, 19, 10, 0);

const label = (d: Date) => `${mondayBasedWeekday(d)}@${d.getHours()}:${d.getMinutes()}`;

describe("mobilityReminderDates", () => {
  it("schedules each chosen weekday at 19:30 over the next two weeks", () => {
    const dates = mobilityReminderDates([0, 2, 4], MONDAY_10AM, false);
    expect(dates).toHaveLength(6);
    expect(dates.map(label)).toEqual([
      "0@19:30", "2@19:30", "4@19:30", "0@19:30", "2@19:30", "4@19:30",
    ]);
    expect(dates[0].getDate()).toBe(19);
  });

  it("skips today once the mobility session is already logged", () => {
    const dates = mobilityReminderDates([0], MONDAY_10AM, true);
    expect(dates.map((d) => d.getDate())).toEqual([26]);
  });

  it("skips today's reminder when 19:30 has already passed", () => {
    const evening = new Date(2026, 9, 19, 20, 0);
    expect(mobilityReminderDates([0], evening, false).map((d) => d.getDate())).toEqual([26]);
  });

  it("schedules nothing without chosen weekdays", () => {
    expect(mobilityReminderDates([], MONDAY_10AM, false)).toEqual([]);
  });
});

describe("isMobilitySession", () => {
  it("recognises the Mobility-Session plan", () => {
    expect(isMobilitySession({ planId: MOBILITY_PLAN_ID, exercises: [] })).toBe(true);
  });

  it("counts a session that is mostly stretches", () => {
    expect(
      isMobilitySession({
        planId: "123",
        exercises: [{ name: "Cat Stretch" }, { name: "Child's Pose" }, { name: "Plank" }],
      }),
    ).toBe(true);
  });

  it("does not count a strength session with one stretch at the end", () => {
    expect(
      isMobilitySession({
        planId: "123",
        exercises: [{ name: "Barbell Squat" }, { name: "Deadlift" }, { name: "Hamstring Stretch" }],
      }),
    ).toBe(false);
  });
});
