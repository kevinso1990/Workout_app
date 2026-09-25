import { describe, it, expect } from "vitest";

import {
  decideRefinement,
  type RefinementContext,
} from "../planRefinementPolicy";

const untouched: RefinementContext = {
  storedPlanExists: true,
  lastModifiedAtRequest: "2026-09-25T09:00:00.000Z",
  lastModifiedNow: "2026-09-25T09:00:00.000Z",
  sessionsLogged: 0,
  refinedDayCount: 3,
};

describe("a refinement may only overwrite an untouched plan", () => {
  it("applies to a plan nobody has touched", () => {
    expect(decideRefinement(untouched)).toBe("apply");
  });

  it("never overwrites a plan the user has edited", () => {
    expect(
      decideRefinement({ ...untouched, lastModifiedNow: "2026-09-25T09:05:00.000Z" }),
    ).toBe("suggest");
  });

  it("never overwrites a plan that already has training history", () => {
    // Losing a plan you have trained with is worse than any improvement is
    // worth — the sets logged against it are the user's own work.
    expect(decideRefinement({ ...untouched, sessionsLogged: 1 })).toBe("suggest");
  });

  it("discards a refinement for a plan that was deleted meanwhile", () => {
    expect(decideRefinement({ ...untouched, storedPlanExists: false })).toBe("drop");
  });

  it("discards an empty refinement rather than replacing a real plan with it", () => {
    // Valid JSON with no days is the realistic bad-model output, and it would
    // otherwise pass every other check and wipe the plan.
    expect(decideRefinement({ ...untouched, refinedDayCount: 0 })).toBe("drop");
  });

  it("checks emptiness before ownership, so a deleted plan never resurfaces", () => {
    expect(
      decideRefinement({ ...untouched, storedPlanExists: false, refinedDayCount: 0 }),
    ).toBe("drop");
  });
});
