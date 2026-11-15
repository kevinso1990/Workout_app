import { describe, it, expect } from "vitest";

import { planToPromote } from "@/lib/todayPlan";
import type { WorkoutPlan, WorkoutSession } from "@/lib/storage";

const day = (dayName: string) => ({ dayName, exercises: [] }) as never;
const plan = (id: string, days: string[], createdAt: string): WorkoutPlan => ({
  id,
  name: id,
  daysPerWeek: days.length,
  days: days.map(day),
  createdAt,
  lastModified: createdAt,
});
const workout = (planId: string, completedAt: string) =>
  ({ planId, completedAt, exercises: [] }) as unknown as WorkoutSession;

const week = plan("week", ["GK A kurz", "GK B kurz", "GK A lang"], "2026-11-01T10:00:00Z");

describe("planToPromote", () => {
  it("brings back the plan being trained after an older plan was put in front", () => {
    const old = plan("old", ["Push", "Pull", "Legs"], "2026-10-01T10:00:00Z");
    expect(planToPromote([old, week], [workout("week", "2026-11-14T10:00:00Z")])).toBe("week");
  });

  it("keeps a plan added after the last workout — the athlete just chose it", () => {
    const fresh = plan("fresh", ["Upper", "Lower"], "2026-11-15T09:00:00Z");
    expect(planToPromote([fresh, week], [workout("week", "2026-11-14T10:00:00Z")])).toBeNull();
  });

  it("never lets a one-session import replace a week's plan", () => {
    const quick = plan("quick", ["Full Body"], "2026-11-15T12:29:00Z");
    expect(planToPromote([quick, week], [workout("week", "2026-11-15T12:28:00Z")])).toBe("week");
  });

  it("leaves things alone when the front plan is the trained one", () => {
    expect(planToPromote([week], [workout("week", "2026-11-14T10:00:00Z")])).toBeNull();
  });
});
