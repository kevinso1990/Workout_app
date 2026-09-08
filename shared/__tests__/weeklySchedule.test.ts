/**
 * The scheduler's whole point is the coaching rules, so the tests assert those
 * rather than just "it returned seven slots".
 */

import { describe, it, expect } from "vitest";
import {
  scheduleTrainingWeek,
  describeCommitmentsForPrompt,
  isLowerBodySession,
  type WeeklyCommitment,
  type Weekday,
} from "../weeklySchedule";

const MON = 0 as Weekday;
const TUE = 1 as Weekday;
const WED = 2 as Weekday;
const THU = 3 as Weekday;
const SAT = 5 as Weekday;

function commitment(
  weekday: Weekday,
  sport: WeeklyCommitment["sport"],
  id = `${sport}-${weekday}`,
): WeeklyCommitment {
  return { id, weekday, sport };
}

function gymDayFor(
  schedule: ReturnType<typeof scheduleTrainingWeek>,
  dayName: string,
): Weekday | undefined {
  return schedule.slots.find((s) => s.kind === "gym" && s.dayName === dayName)?.weekday;
}

describe("isLowerBodySession", () => {
  it("recognises leg-loading session names in both languages", () => {
    for (const n of ["Legs", "Lower", "Full Body", "Full Body A", "Ganzkörper"]) {
      expect(isLowerBodySession(n), n).toBe(true);
    }
  });

  it("does not flag upper-body sessions", () => {
    for (const n of ["Push", "Pull", "Upper", "Chest", "Back", "Arms"]) {
      expect(isLowerBodySession(n), n).toBe(false);
    }
  });
});

describe("scheduleTrainingWeek — structure", () => {
  it("always returns all seven days exactly once, in order", () => {
    const s = scheduleTrainingWeek({
      commitments: [commitment(TUE, "basketball")],
      sessionDayNames: ["Push", "Pull", "Legs"],
    });
    expect(s.slots).toHaveLength(7);
    expect(s.slots.map((x) => x.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("never schedules the gym on a day already taken by sport", () => {
    const commitments = [commitment(TUE, "basketball"), commitment(THU, "running")];
    const s = scheduleTrainingWeek({
      commitments,
      sessionDayNames: ["Push", "Pull", "Legs", "Upper"],
    });
    for (const slot of s.slots) {
      if (slot.kind === "gym") {
        expect(commitments.some((c) => c.weekday === slot.weekday)).toBe(false);
      }
    }
  });

  it("reports sessions that do not fit instead of dropping them silently", () => {
    const commitments = [
      commitment(MON, "running"),
      commitment(TUE, "basketball"),
      commitment(WED, "tennis"),
      commitment(THU, "football"),
      commitment(4 as Weekday, "boxing"),
    ];
    const s = scheduleTrainingWeek({
      commitments,
      sessionDayNames: ["Push", "Pull", "Legs", "Upper"],
    });
    expect(s.slots.filter((x) => x.kind === "gym")).toHaveLength(2);
    expect(s.unplacedDayNames).toEqual(["Legs", "Upper"]);
  });

  it("handles a week with no commitments at all", () => {
    const s = scheduleTrainingWeek({
      commitments: [],
      sessionDayNames: ["Push", "Pull", "Legs"],
    });
    expect(s.slots.filter((x) => x.kind === "gym")).toHaveLength(3);
    expect(s.unplacedDayNames).toEqual([]);
  });

  it("handles no sessions at all", () => {
    const s = scheduleTrainingWeek({ commitments: [], sessionDayNames: [] });
    expect(s.slots.every((x) => x.kind === "rest")).toBe(true);
  });
});

describe("scheduleTrainingWeek — recovery rules", () => {
  it("does not put leg day immediately before basketball", () => {
    const s = scheduleTrainingWeek({
      commitments: [commitment(TUE, "basketball")],
      sessionDayNames: ["Push", "Pull", "Legs"],
    });
    // Monday is the day before Tuesday — playing on dead legs is the case
    // this whole module exists to prevent.
    expect(gymDayFor(s, "Legs")).not.toBe(MON);
  });

  it("does not put leg day immediately before a run either", () => {
    const s = scheduleTrainingWeek({
      commitments: [commitment(THU, "running")],
      sessionDayNames: ["Push", "Pull", "Legs"],
    });
    expect(gymDayFor(s, "Legs")).not.toBe(WED);
  });

  it("keeps leg day off both sides of a court sport when the week allows it", () => {
    const s = scheduleTrainingWeek({
      commitments: [commitment(WED, "tennis")],
      sessionDayNames: ["Push", "Pull", "Legs"],
    });
    const legs = gymDayFor(s, "Legs");
    expect(legs).not.toBe(TUE);
    expect(legs).not.toBe(THU);
  });

  it("still allows upper-body work next to a run — that pairing is free", () => {
    const s = scheduleTrainingWeek({
      commitments: [commitment(THU, "running")],
      sessionDayNames: ["Push", "Pull", "Legs", "Upper"],
    });
    // Four sessions and six free days: the days flanking Thursday should be
    // usable rather than left empty out of misplaced caution.
    const flanking = s.slots.filter(
      (x) => (x.weekday === WED || x.weekday === 4) && x.kind === "gym",
    );
    expect(flanking.length).toBeGreaterThan(0);
  });

  it("spreads two full-body sessions apart rather than stacking them", () => {
    const s = scheduleTrainingWeek({
      commitments: [],
      sessionDayNames: ["Full Body A", "Full Body B"],
    });
    const a = gymDayFor(s, "Full Body A")!;
    const b = gymDayFor(s, "Full Body B")!;
    const raw = Math.abs(a - b);
    const gap = Math.min(raw, 7 - raw);
    expect(gap).toBeGreaterThanOrEqual(2);
  });

  it("spreads three sessions across the week instead of clustering them", () => {
    const s = scheduleTrainingWeek({
      commitments: [],
      sessionDayNames: ["Push", "Pull", "Legs"],
    });
    const days = s.slots.filter((x) => x.kind === "gym").map((x) => x.weekday).sort();
    const gaps = days.map((d, i) => {
      const next = days[(i + 1) % days.length];
      return i === days.length - 1 ? next + 7 - d : next - d;
    });
    // No two sessions back to back when there is room not to be.
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2);
  });

  it("fills a tight week even when every choice is compromised", () => {
    // Five sessions, two sport days: only five free days, so back-to-back is
    // unavoidable. It must still place all five rather than give up.
    const s = scheduleTrainingWeek({
      commitments: [commitment(TUE, "football"), commitment(SAT, "running")],
      sessionDayNames: ["Push", "Pull", "Legs", "Upper", "Lower"],
    });
    expect(s.slots.filter((x) => x.kind === "gym")).toHaveLength(5);
    expect(s.unplacedDayNames).toEqual([]);
  });
});

describe("describeCommitmentsForPrompt", () => {
  it("is empty when there is nothing to say", () => {
    expect(describeCommitmentsForPrompt([])).toBe("");
  });

  it("names the days and flags leg-heavy sports", () => {
    const text = describeCommitmentsForPrompt([
      commitment(TUE, "basketball"),
      commitment(THU, "running"),
    ]);
    expect(text).toContain("Tuesday: basketball");
    expect(text).toContain("Thursday: running");
    expect(text).toMatch(/legs/i);
  });

  it("uses the custom label instead of the literal word custom", () => {
    const text = describeCommitmentsForPrompt([
      { id: "c1", weekday: MON, sport: "custom", label: "Bouldern" },
    ]);
    expect(text).toContain("Bouldern");
    expect(text).not.toContain("custom");
  });

  it("does not claim legs are taxed when only swimming is committed", () => {
    const text = describeCommitmentsForPrompt([commitment(MON, "swimming")]);
    expect(text).toContain("swimming");
    expect(text).not.toMatch(/high demand on the legs/i);
  });
});
