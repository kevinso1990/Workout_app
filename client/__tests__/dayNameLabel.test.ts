import { describe, it, expect } from "vitest";

import { translateDayName } from "@/lib/dayNameLabel";

const de: Record<string, string> = {
  "onboarding.dayNames.fullBody": "Ganzkörper",
  "onboarding.dayNames.push": "Push",
  "onboarding.dayNames.upper": "Oberkörper",
  "onboarding.dayNames.legs": "Beine",
};
const t = (key: string, opts?: Record<string, unknown>) =>
  de[key] ?? String(opts?.defaultValue ?? key);

describe("translateDayName", () => {
  it("translates template day names and keeps the variant letter", () => {
    expect(translateDayName(t, "Full Body A")).toBe("Ganzkörper A");
    expect(translateDayName(t, "Full Body")).toBe("Ganzkörper");
    expect(translateDayName(t, "Upper B")).toBe("Oberkörper B");
    expect(translateDayName(t, "Legs")).toBe("Beine");
  });

  it("leaves user and imported day names untouched", () => {
    expect(translateDayName(t, "Tag 1")).toBe("Tag 1");
    expect(translateDayName(t, "Mobility-Session")).toBe("Mobility-Session");
    expect(translateDayName(t, "Leg Day Heavy")).toBe("Leg Day Heavy");
  });
});
