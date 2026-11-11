import { describe, it, expect } from "vitest";
import { formatRest, isTimedTarget, planDaySummary, sessionHueIndex, sessionLetter, sessionSlots, supersetLabels, supersetMembers, weekStripCaption } from "@/lib/planStructure";

describe("plan structure helpers", () => {
  it("labels superset members A1/A2 and ignores single-member blocks", () => {
    const exs = [{ superset: "A" }, { superset: "A" }, { superset: "B" }, { superset: "B" }, { superset: "C" }, {}];
    expect(supersetLabels(exs)).toEqual(["A1", "A2", "B1", "B2", null, null]);
    expect(supersetMembers(exs, 3)).toEqual([2, 3]);
    expect(supersetMembers(exs, 4)).toBeNull();
  });

  it("recognises timed targets", () => {
    expect(isTimedTarget("30-45 s")).toBe(true);
    expect(isTimedTarget("45 Sek.")).toBe(true);
    expect(isTimedTarget("8-12")).toBe(false);
  });

  it("formats rest", () => {
    expect(formatRest(90)).toBe("90 s");
    expect(formatRest(210)).toBe("3:30 min");
    expect(formatRest(60)).toBe("1 min");
    expect(formatRest(45)).toBe("45 s");
  });

  it("splits long session names into two short caption lines", () => {
    expect(weekStripCaption("Ganzkörper A")).toEqual(["Ganzkörper", "A"]);
    expect(weekStripCaption("GK A kurz – Bein / Hinge")).toEqual(["GK A", "kurz"]);
    expect(weekStripCaption("Push")).toEqual(["Push", null]);
  });
});

describe("planDaySummary", () => {
  it("shortens session names and drops long/short variants of the same session", () => {
    expect(
      planDaySummary([
        "Mobility + Hüftkraft",
        "GK A kurz – Bein / Hinge",
        "GK B kurz – Pull",
        "GK A lang – Bein / Hinge",
        "GK B lang – Pull",
      ]),
    ).toBe("Mobility + Hüftkraft · GK A · B");
  });

  it("keeps plain names and removes weekday notes in brackets", () => {
    expect(planDaySummary(["Push (Mo)", "Pull", "Beine"])).toBe("Push · Pull · Beine");
    expect(planDaySummary(["Ganzkörper A", "Ganzkörper B", "Ganzkörper C"])).toBe("Ganzkörper A · B · C");
  });
});

describe("sessionSlots", () => {
  const schedule = {
    weeks: [
      [{ weekday: 1, dayId: "b" }, { weekday: 5, dayId: "a" }],
      [{ weekday: 1, dayId: "a" }],
    ],
  };

  it("lists weekdays with their cycle week in a rotation", () => {
    expect(sessionSlots(schedule, "a")).toEqual([
      { week: 1, weekday: 5 },
      { week: 2, weekday: 1 },
    ]);
  });

  it("drops the week for a weekday the session has in every week", () => {
    const everyMonday = {
      weeks: [
        [{ weekday: 0, dayId: "m" }],
        [{ weekday: 0, dayId: "m" }, { weekday: 3, dayId: "m" }],
      ],
    };
    expect(sessionSlots(everyMonday, "m")).toEqual([
      { week: null, weekday: 0 },
      { week: 2, weekday: 3 },
    ]);
  });

  it("leaves the week out for a fixed week and is empty without a schedule", () => {
    expect(sessionSlots({ weeks: [schedule.weeks[0]] }, "b")).toEqual([{ week: null, weekday: 1 }]);
    expect(sessionSlots(undefined, "a")).toEqual([]);
    expect(sessionSlots(schedule, undefined)).toEqual([]);
  });
});

describe("sessionLetter", () => {
  it("reads the letter the plan gives a session", () => {
    expect(sessionLetter("GK A kurz – Bein / Hinge")).toBe("A");
    expect(sessionLetter("Ganzkörper C")).toBe("C");
  });

  it("is null when the name has no letter", () => {
    expect(sessionLetter("Push")).toBeNull();
    expect(sessionLetter("Mobility – A-Skip")).toBeNull();
  });
});

describe("sessionHueIndex", () => {
  it("gives the short and long variant of a session the same hue", () => {
    expect(sessionHueIndex("GK A kurz – Bein", 1, 6)).toBe(0);
    expect(sessionHueIndex("GK A lang – Bein", 4, 6)).toBe(0);
    expect(sessionHueIndex("GK C kurz", 3, 6)).toBe(2);
  });

  it("falls back to the position and wraps around", () => {
    expect(sessionHueIndex("Push", 1, 6)).toBe(1);
    expect(sessionHueIndex("Beine", 7, 6)).toBe(1);
  });
});
