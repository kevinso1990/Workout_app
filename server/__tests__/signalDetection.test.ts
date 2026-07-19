import { describe, it, expect } from "vitest";

import {
  detectPerformanceSignals,
  formatSignalsForPrompt,
  type SignalDetectionSession,
} from "../../shared/signalDetection";

const PLAN = {
  id: "p1",
  daysPerWeek: 3,
  createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
};

function benchSession(
  date: string,
  weight: string,
  rating: "green" | "yellow" | "red",
): SignalDetectionSession {
  return {
    completedAt: date,
    exercises: [{ id: "ex1", name: "Barbell Bench Press" }],
    exerciseProgress: [
      {
        exerciseId: "ex1",
        sets: [
          { weight, reps: "8", completed: true, rating },
          { weight, reps: "8", completed: true, rating },
        ],
      },
    ],
  };
}

describe("detectPerformanceSignals", () => {
  it("detects plateau with same weight and worsening feedback", () => {
    const sessions = [
      benchSession("2026-05-01", "80", "yellow"),
      benchSession("2026-05-08", "80", "red"),
      benchSession("2026-05-15", "80", "red"),
    ];
    const signals = detectPerformanceSignals(PLAN, sessions);
    expect(signals.some((s) => s.type === "PLATEAU")).toBe(true);
    const plateau = signals.find((s) => s.type === "PLATEAU");
    expect(plateau?.exercise_name).toBe("Barbell Bench Press");
  });

  it("detects overreach when last 3 sessions are majority red", () => {
    const redSession = (): SignalDetectionSession => ({
      completedAt: new Date().toISOString(),
      exercises: [
        { id: "a", name: "Squat" },
        { id: "b", name: "Press" },
      ],
      exerciseProgress: [
        {
          exerciseId: "a",
          sets: [{ weight: "100", reps: "5", completed: true, rating: "red" }],
        },
        {
          exerciseId: "b",
          sets: [{ weight: "60", reps: "5", completed: true, rating: "red" }],
        },
      ],
    });
    const sessions = [
      { ...redSession(), completedAt: "2026-05-01" },
      { ...redSession(), completedAt: "2026-05-08" },
      { ...redSession(), completedAt: "2026-05-15" },
    ];
    const signals = detectPerformanceSignals(PLAN, sessions);
    expect(signals.some((s) => s.type === "OVERREACH")).toBe(true);
  });

  it("returns no signals for healthy progression", () => {
    const sessions = [
      benchSession("2026-05-01", "70", "green"),
      benchSession("2026-05-08", "72.5", "green"),
      benchSession("2026-05-15", "75", "green"),
    ];
    const signals = detectPerformanceSignals(PLAN, sessions);
    expect(signals.filter((s) => s.type !== "MISSED_SESSIONS")).toHaveLength(0);
  });

  it("formats prompt block with signal constraint", () => {
    const signals = detectPerformanceSignals(PLAN, [
      benchSession("2026-05-01", "80", "red"),
      benchSession("2026-05-08", "80", "red"),
      benchSession("2026-05-15", "80", "red"),
    ]);
    const block = formatSignalsForPrompt(signals);
    expect(block).toContain("Detected performance signals:");
    expect(block).toContain("PLATEAU");
    expect(block).toContain("Every proposed change must reference a detected signal");
  });
});
