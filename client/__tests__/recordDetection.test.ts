import { describe, it, expect } from "vitest";
import { recordBaseline, isRecordSet } from "@/lib/recordDetection";
import type { WorkoutSession } from "@/lib/storage";

function session(name: string, sets: [string, string, boolean][]): WorkoutSession {
  return {
    id: Math.random().toString(36),
    planId: "p",
    planName: "Plan",
    dayName: "A",
    completedAt: "2026-11-01T10:00:00Z",
    exercises: [{ name } as WorkoutSession["exercises"][number]],
    exerciseProgress: [
      { sets: sets.map(([weight, reps, completed]) => ({ weight, reps, completed })) },
    ] as unknown as WorkoutSession["exerciseProgress"],
  };
}

describe("recordBaseline", () => {
  it("counts workouts with a completed set and their best volume", () => {
    const history = [
      session("Bankdrücken", [["60", "8", true], ["62,5", "8", true]]),
      session("Bankdrücken", [["70", "5", false]]),
      session("Kniebeuge", [["100", "5", true]]),
    ];
    expect(recordBaseline(history, "Bankdrücken")).toEqual({ sessions: 1, bestVolume: 500 });
  });
});

describe("isRecordSet", () => {
  const twoSessions = { sessions: 2, bestVolume: 480 };

  it("never fires for an exercise with fewer than two earlier workouts", () => {
    expect(isRecordSet({ baseline: { sessions: 0, bestVolume: 0 }, sessionBest: 0, weight: 60, reps: 8 })).toBe(false);
    expect(isRecordSet({ baseline: { sessions: 1, bestVolume: 400 }, sessionBest: 0, weight: 60, reps: 8 })).toBe(false);
  });

  it("fires when a set beats the history", () => {
    expect(isRecordSet({ baseline: twoSessions, sessionBest: 0, weight: 62.5, reps: 8 })).toBe(true);
  });

  it("does not fire again for a set that only matches this workout's record", () => {
    expect(isRecordSet({ baseline: twoSessions, sessionBest: 500, weight: 62.5, reps: 8 })).toBe(false);
    expect(isRecordSet({ baseline: twoSessions, sessionBest: 500, weight: 65, reps: 8 })).toBe(true);
  });
});
