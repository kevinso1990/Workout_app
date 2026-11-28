import { describe, expect, it } from "vitest";

import { weekStreak } from "@/lib/weekStreak";
import type { WorkoutSession } from "@/lib/storage";

// Wednesday 2026-11-18, 18:00 local.
const NOW = new Date(2026, 10, 18, 18);
const on = (offset: number, extra: Partial<WorkoutSession> = {}) =>
  ({
    planId: "p",
    exercises: [{ name: "Bench Press" }],
    completedAt: new Date(2026, 10, 18 + offset, 9).toISOString(),
    ...extra,
  }) as WorkoutSession;

describe("weekStreak", () => {
  it("counts full weeks that reached the goal", () => {
    // Mon/Wed/Fri for the two weeks before this one.
    const history = [-16, -14, -12, -9, -7, -5].map((d) => on(d));
    const s = weekStreak(history, NOW, 3);
    expect(s.weeks).toBe(2);
    expect(s.thisWeek).toBe(0);
  });

  it("does not break during a week that is still open", () => {
    const history = [-9, -7, -5, -2].map((d) => on(d));
    const s = weekStreak(history, NOW, 3);
    expect(s.weeks).toBe(1);
    expect(s.thisWeek).toBe(1);
  });

  it("adds this week once its goal is met", () => {
    const history = [-9, -7, -5, -2, -1, 0].map((d) => on(d));
    expect(weekStreak(history, NOW, 3).weeks).toBe(2);
  });

  it("breaks on a past week below the goal", () => {
    // Two weeks ago full, last week only one session.
    const history = [-16, -14, -12, -7].map((d) => on(d));
    const s = weekStreak(history, NOW, 3);
    expect(s.weeks).toBe(0);
    expect(s.longest).toBe(1);
  });

  it("leaves cardio and mobility out of the goal", () => {
    const history = [
      on(-9),
      on(-7, { workoutType: "cardio" } as Partial<WorkoutSession>),
      on(-5, { exercises: [{ name: "Couch Stretch" }, { name: "Hamstring Stretch" }] } as Partial<WorkoutSession>),
    ];
    expect(weekStreak(history, NOW, 2).recent[3].count).toBe(1);
  });

  it("counts two workouts on one day as one training day", () => {
    const history = [-9, -9, -9].map((d) => on(d));
    const s = weekStreak(history, NOW, 3);
    expect(s.recent[3].count).toBe(1);
    expect(s.weeks).toBe(0);
  });

  it("starts empty", () => {
    const s = weekStreak([], NOW, 3);
    expect(s).toMatchObject({ weeks: 0, longest: 0, goal: 3 });
    expect(s.recent).toHaveLength(5);
  });
});
