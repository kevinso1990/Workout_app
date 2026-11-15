import { describe, it, expect } from "vitest";

import { hasVariant, variantSummary } from "@/lib/exerciseVariant";

const t = (key: string) => key.split(".").pop()!;

describe("exercise variant", () => {
  it("summarises tags and the note in one line", () => {
    expect(variantSummary(t, { tags: ["vest", "band"], note: " Pause unten " })).toBe("vest · band · Pause unten");
  });

  it("treats an empty variant as none", () => {
    expect(hasVariant({ tags: [], note: "  " })).toBe(false);
    expect(variantSummary(t, undefined)).toBe("");
  });
});
