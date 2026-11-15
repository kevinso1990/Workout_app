import { describe, expect, it } from "vitest";

import { detectPerformanceSignals } from "../signalDetection";

const NOW = new Date(2026, 10, 15, 12).getTime();
const DAY = 24 * 60 * 60 * 1000;
const at = (daysAgo: number) => ({
  completedAt: new Date(NOW - daysAgo * DAY).toISOString(),
  exercises: [],
});
const missed = (createdDaysAgo: number, sessions: ReturnType<typeof at>[]) =>
  detectPerformanceSignals(
    { id: "p", daysPerWeek: 3, createdAt: new Date(NOW - createdDaysAgo * DAY).toISOString() },
    sessions,
    NOW,
  ).find((s) => s.type === "MISSED_SESSIONS");

describe("missed sessions", () => {
  it("looks at the last four weeks, not everything since the plan began", () => {
    // Ten weeks old, a long break, then two sessions in the last four weeks:
    // 12 planned, 2 logged — not "28 missed".
    const signal = missed(70, [at(65), at(60), at(10), at(3)]);
    expect(signal?.summary).toMatch(/^10 of 12 planned sessions/);
  });

  it("stays quiet when the athlete kept up", () => {
    const sessions = Array.from({ length: 12 }, (_, i) => at(1 + i * 2));
    expect(missed(70, sessions)).toBeUndefined();
  });

  it("says nothing in the plan's first week", () => {
    expect(missed(4, [at(1)])).toBeUndefined();
  });
});
