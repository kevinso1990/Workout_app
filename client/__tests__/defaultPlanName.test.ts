import { describe, it, expect } from "vitest";

import { displayPlanName } from "@/lib/defaultPlanName";

const t = (key: string, opts?: Record<string, unknown>) =>
  key === "plans.defaultPlanName" ? "Mein Trainingsplan" : String(opts?.defaultValue ?? key);

describe("displayPlanName", () => {
  it("localises plans saved under the old English default name", () => {
    expect(displayPlanName(t, "My Workout Plan")).toBe("Mein Trainingsplan");
  });

  it("leaves the user's own plan names alone", () => {
    expect(displayPlanName(t, "Push Tag A")).toBe("Push Tag A");
    expect(displayPlanName(t, "my workout plan v2")).toBe("my workout plan v2");
  });
});
