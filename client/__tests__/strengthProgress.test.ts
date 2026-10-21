import { describe, it, expect } from "vitest";

import {
  formatVolume,
  mondayStart,
  recentRecords,
  thisWeekSummary,
  weekStreak,
  weeklySetsByMuscle,
  weeklyVolumes,
} from "@/lib/strengthProgress";
import type { WorkoutSession } from "@/lib/storage";

// Wednesday 2026-10-21, 12:00 local.
const NOW = new Date(2026, 9, 21, 12);
const day = (offset: number) => new Date(2026, 9, 21 + offset, 10).toISOString();

const lift = (
  completedAt: string,
  name: string,
  sets: [number, number][],
  over: Partial<WorkoutSession> = {},
): WorkoutSession => ({
  id: `${name}-${completedAt}`,
  planId: "p",
  planName: "Plan",
  dayName: "A",
  completedAt,
  exercises: [{ id: name, name, muscleGroup: "Chest", sets: sets.length, reps: "8" }],
  exerciseProgress: [
    {
      exerciseId: name,
      sets: sets.map(([w, r]) => ({ weight: String(w), reps: String(r), completed: true })) as never,
    },
  ],
  ...over,
});

describe("mondayStart", () => {
  it("returns local midnight of the week's Monday", () => {
    const m = mondayStart(NOW);
    expect([m.getDate(), m.getDay(), m.getHours()]).toEqual([19, 1, 0]);
    expect(mondayStart(new Date(2026, 9, 25, 23)).getDate()).toBe(19); // Sunday
  });
});

describe("formatVolume", () => {
  it("shows kg below a tonne and tonnes above", () => {
    expect(formatVolume(520, "de")).toBe("520 kg");
    expect(formatVolume(0, "de")).toBe("0 kg");
    expect(formatVolume(2450, "de")).toBe("2,5 t");
    expect(formatVolume(2450, "en")).toBe("2.5 t");
    expect(formatVolume(12400, "de")).toBe("12 t");
  });
});

describe("thisWeekSummary", () => {
  it("counts Monday onwards only and ignores cardio volume", () => {
    const history = [
      lift(day(0), "Bench", [[100, 5], [100, 5]]),
      lift(day(-3), "Bench", [[90, 5]]), // previous Sunday
      lift(day(-1), "Run", [], { workoutType: "cardio" }),
    ];
    expect(thisWeekSummary(history, NOW)).toEqual({ workouts: 2, sets: 2, volume: 1000 });
  });
});

describe("weekStreak", () => {
  it("counts consecutive weeks and doesn't break on an unfinished current week", () => {
    const history = [lift(day(-7), "B", [[1, 1]]), lift(day(-14), "B", [[1, 1]]), lift(day(-28), "B", [[1, 1]])];
    expect(weekStreak(history, NOW)).toBe(2);
    expect(weekStreak([...history, lift(day(0), "B", [[1, 1]])], NOW)).toBe(3);
    expect(weekStreak([], NOW)).toBe(0);
  });
});

describe("weeklyVolumes", () => {
  it("returns oldest-first weeks keyed by Monday", () => {
    const weeks = weeklyVolumes([lift(day(-7), "B", [[50, 10]])], NOW);
    expect(weeks.map((w) => w.weekStart.getDate())).toEqual([28, 5, 12, 19]);
    expect(weeks.map((w) => w.volume)).toEqual([0, 0, 500, 0]);
  });
});

describe("weeklySetsByMuscle", () => {
  it("sums completed sets per muscle since Monday", () => {
    const history = [lift(day(0), "Bench", [[100, 5], [100, 5]]), lift(day(-10), "Bench", [[100, 5]])];
    expect(weeklySetsByMuscle(history, NOW)).toEqual({ Chest: 2 });
  });
});

describe("recentRecords", () => {
  it("lists sessions that beat the earlier best, newest first", () => {
    const history = [
      lift(day(-20), "Bench", [[80, 5]]),
      lift(day(-10), "Bench", [[85, 5]]),
      lift(day(-2), "Bench", [[80, 5]]), // not a record
      lift(day(-15), "Squat", [[100, 5]]),
      lift(day(-1), "Squat", [[110, 5]]),
    ];
    const prs = recentRecords(history, NOW);
    expect(prs.map((p) => [p.exerciseName, p.weight])).toEqual([
      ["Squat", 110],
      ["Bench", 85],
    ]);
    expect(prs[1].previous1RM).toBe(93);
  });

  it("does not call a first session a record", () => {
    expect(recentRecords([lift(day(-1), "Bench", [[100, 5]])], NOW)).toEqual([]);
  });
});
