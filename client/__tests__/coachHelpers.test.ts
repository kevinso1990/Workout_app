import { describe, it, expect, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));

import { buildBriefingTimeline } from "@/lib/coachHelpers";

describe("buildBriefingTimeline", () => {
  const session = (completedAt: string, dayName: string) =>
    ({
      id: completedAt,
      planId: "p",
      planName: "P",
      dayName,
      completedAt,
      exercises: [{ id: "1", name: dayName.includes("Pull") ? "Lat Pulldown" : "Bench Press" }],
    }) as never;

  it("names today, the latest workout (not an older one) and what's next", () => {
    const text = buildBriefingTimeline({
      sessions: [session("2026-11-10T18:00:00Z", "GK C kurz – Push / Core"), session("2026-11-12T18:00:00Z", "GK B kurz – Pull")],
      now: new Date(2026, 10, 13, 9),
      dayLabel: (n) => n,
      next: { weekday: 5, dayName: "GK A lang – Bein / Hinge" },
    });
    expect(text).toContain("Today is Friday 2026-11-13.");
    expect(text).toContain("Most recent workout (yesterday): Thursday 2026-11-12 — GK B kurz – Pull (Lat Pulldown).");
    expect(text).not.toContain("Push / Core");
    expect(text).toContain("Next planned session: Saturday 2026-11-14 — GK A lang – Bein / Hinge.");
  });

  it("prefers today's planned session over the next one", () => {
    const text = buildBriefingTimeline({
      sessions: [],
      now: new Date(2026, 10, 13, 9),
      dayLabel: (n) => n,
      plannedToday: "GK C kurz",
      next: { weekday: 5, dayName: "GK A lang" },
    });
    expect(text).toContain("Planned for today (not done yet): GK C kurz.");
    expect(text).not.toContain("Next planned");
  });
});
