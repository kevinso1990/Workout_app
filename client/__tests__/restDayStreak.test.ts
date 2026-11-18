import { describe, expect, it } from "vitest";

import { maxRestDays, restDayStreak } from "@/lib/restDayStreak";
import type { WorkoutSession } from "@/lib/storage";

// Wednesday 2026-11-18, 18:00 local.
const NOW = new Date(2026, 10, 18, 18);
const on = (offset: number) =>
  ({ completedAt: new Date(2026, 10, 18 + offset, 9).toISOString() }) as WorkoutSession;

describe("maxRestDays", () => {
  it("earns more rest for fewer sessions a week", () => {
    expect(maxRestDays(3)).toBe(3);
    expect(maxRestDays(2)).toBe(4);
    expect(maxRestDays(5)).toBe(2);
    expect(maxRestDays(0)).toBe(3);
  });
});

describe("restDayStreak", () => {
  it("runs across rest days within the allowance", () => {
    // Mon/Wed/Fri rhythm, two weeks, last session Monday.
    const history = [-16, -14, -12, -9, -7, -5, -2].map(on);
    const s = restDayStreak(history, NOW, 3);
    expect(s.days).toBe(17);
    expect(s.restLeft).toBe(2); // Tuesday rested, Wednesday still open
  });

  it("breaks on a gap longer than the allowance", () => {
    const history = [-20, -10, -2].map(on);
    expect(restDayStreak(history, NOW, 3).days).toBe(3);
  });

  it("is 0 once the rest since the last session runs out", () => {
    expect(restDayStreak([on(-5)], NOW, 3).days).toBe(0);
    expect(restDayStreak([on(-4)], NOW, 3)).toMatchObject({ days: 5, restLeft: 0 });
  });

  it("training today refills the rest", () => {
    expect(restDayStreak([on(-1), on(0)], NOW, 3)).toMatchObject({ days: 2, restLeft: 3 });
  });

  it("remembers the longest streak", () => {
    const earlierLonger = restDayStreak([-30, -28, -26, -24, -4, -2].map(on), NOW, 3);
    expect(earlierLonger).toMatchObject({ days: 5, longest: 7 });
    const currentLongest = restDayStreak([-30, -28, -12, -10, -8, -6, -4, -2].map(on), NOW, 3);
    expect(currentLongest).toMatchObject({ days: 13, longest: 13 });
    const broken = restDayStreak([-30, -28, -26, -24, -10].map(on), NOW, 3);
    expect(broken).toMatchObject({ days: 0, longest: 7 });
    expect(broken.chains.map((c) => c.end - c.start + 1)).toEqual([7, 1]);
  });
});
