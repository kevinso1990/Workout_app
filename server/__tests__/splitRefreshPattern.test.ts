import { describe, it, expect } from "vitest";

import {
  detectSplitPatternMismatch,
  SPLIT_REFRESH_MIN_SESSIONS,
  type SplitPatternPlan,
  type SplitPatternSession,
} from "../../shared/splitRefreshPattern";

const PPL_PLAN: SplitPatternPlan = {
  id: "plan-1",
  name: "Push Pull Legs",
  days: [
    { dayName: "Push" },
    { dayName: "Pull" },
    { dayName: "Legs" },
  ],
};

function makeSession(dayName: string, index: number): SplitPatternSession {
  return {
    planId: "plan-1",
    dayName,
    completedAt: new Date(2026, 4, index + 1).toISOString(),
    exercises: [
      {
        id: "e1",
        muscleGroup: dayName === "Legs" ? "Legs" : "Chest",
        sets: 3,
      },
    ],
    exerciseProgress: [
      { exerciseId: "e1", sets: [{ completed: true }] },
    ],
  };
}

describe("detectSplitPatternMismatch", () => {
  it("detects skewed push volume on a PPL plan", () => {
    const sessions: SplitPatternSession[] = [];
    for (let i = 0; i < 8; i++) {
      sessions.push(makeSession(i < 6 ? "Push" : "Pull", i));
    }
    const result = detectSplitPatternMismatch(PPL_PLAN, sessions);
    expect(result.mismatch).toBe(true);
    expect(result.summary).toContain("push");
  });

  it("returns no mismatch for balanced PPL logging", () => {
    const sessions = [
      makeSession("Push", 0),
      makeSession("Pull", 1),
      makeSession("Legs", 2),
      makeSession("Push", 3),
      makeSession("Pull", 4),
      makeSession("Legs", 5),
    ];
    const result = detectSplitPatternMismatch(PPL_PLAN, sessions);
    expect(result.mismatch).toBe(false);
  });

  it("requires minimum session count", () => {
    const sessions = Array.from({ length: SPLIT_REFRESH_MIN_SESSIONS - 1 }, (_, i) =>
      makeSession("Push", i),
    );
    const result = detectSplitPatternMismatch(PPL_PLAN, sessions);
    expect(result.mismatch).toBe(false);
  });
});
