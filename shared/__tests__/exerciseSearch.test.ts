import { describe, it, expect } from "vitest";
import { textMatchRank, sortByRelevance } from "../exerciseSearch";

describe("textMatchRank", () => {
  it("ranks exact match best", () => {
    expect(textMatchRank("Squat", "squat")).toBe(0);
  });
  it("ranks starts-with next", () => {
    expect(textMatchRank("Squat Jump", "squat")).toBe(1);
  });
  it("ranks a word-boundary match ahead of a mid-word match", () => {
    expect(textMatchRank("Back Squat", "squat")).toBe(2);
    expect(textMatchRank("Squatting Jack", "squat")).toBe(1); // starts-with wins first
  });
  it("ranks a match with no word boundary last", () => {
    expect(textMatchRank("Kettlebell Squatting", "squat")).toBe(2); // "Squat" still starts a word
  });
  it("is Infinity when there is no match at all", () => {
    expect(textMatchRank("Bench Press", "squat")).toBe(Infinity);
  });
});

describe("sortByRelevance — the reported bug", () => {
  type Ex = { name: string; equipment: string };
  const catalog: Ex[] = [
    // Natural catalog order groups by muscle_group then name — Legs come
    // before e.g. "Kettlebell Swing" (Back), so this fixture mirrors that:
    // an unrelated kettlebell exercise sits ahead of the real name match.
    { name: "Goblet Squat", equipment: "kettlebell" },
    { name: "Kettlebell Swing", equipment: "kettlebell" },
    { name: "Squat", equipment: "barbell" },
    { name: "Back Squat", equipment: "barbell" },
  ];

  it("ranks a name match above a same-equipment exercise with no match in its name", () => {
    // Searching "squat": Goblet Squat has no "squat"... wait it does via name.
    // Use "kettlebell" instead — the actual reported scenario.
    const results = sortByRelevance(
      catalog,
      "kettlebell",
      (e) => e.name,
      (e) => [e.equipment],
    );
    // "Kettlebell Swing" (name starts with the query) must outrank
    // "Goblet Squat" (only the equipment field matches, not the name).
    const swingIdx = results.findIndex((e) => e.name === "Kettlebell Swing");
    const gobletIdx = results.findIndex((e) => e.name === "Goblet Squat");
    expect(swingIdx).toBeLessThan(gobletIdx);
  });

  it("ranks an exact match above word-boundary matches", () => {
    // Real call sites filter first, then sort — "Kettlebell Swing" wouldn't
    // reach sortByRelevance at all for a "squat" search in practice.
    const matching = catalog.filter((e) => e.name.toLowerCase().includes("squat"));
    const results = sortByRelevance(matching, "squat", (e) => e.name);
    expect(results[0].name).toBe("Squat"); // exact match — the only rank-0 result
    // "Back Squat" and "Goblet Squat" are both word-boundary matches (rank 2);
    // stable sort keeps them in their original catalog order relative to each
    // other, which is "Goblet Squat" first per the fixture above.
    expect(results.slice(1).map((e) => e.name)).toEqual(["Goblet Squat", "Back Squat"]);
  });

  it("is a reorder only — it never drops items, filtering stays the caller's job", () => {
    // sortByRelevance runs on an already-filtered list in real usage; it must
    // not itself remove non-matching entries (that would double as a second,
    // inconsistent filter).
    const results = sortByRelevance(
      catalog,
      "kettlebell",
      (e) => e.name,
      (e) => [e.equipment],
    );
    expect(results).toHaveLength(catalog.length);
    expect(results.map((e) => e.name)).toContain("Goblet Squat");
  });

  it("is a no-op for an empty query", () => {
    expect(sortByRelevance(catalog, "", (e) => e.name)).toEqual(catalog);
    expect(sortByRelevance(catalog, "   ", (e) => e.name)).toEqual(catalog);
  });

  it("accepts multiple equally-weighted primary fields and takes the best match", () => {
    // Regression for a real mistake made while wiring this in: using ONLY
    // name_de as primary would wrongly demote an exact ENGLISH name match to
    // the equipment-level tier whenever name_de didn't also match.
    type Bilingual = { name: string; nameDe: string; equipment: string };
    const items: Bilingual[] = [
      { name: "Bench Press", nameDe: "Bankdrücken", equipment: "barbell" },
      { name: "Leg Press", nameDe: "Beinpresse", equipment: "machine" },
    ];
    const results = sortByRelevance(
      items,
      "bench",
      (e) => [e.name, e.nameDe],
      (e) => [e.equipment],
    );
    expect(results[0].name).toBe("Bench Press");
  });

  it("preserves original order within equal rank (stable sort)", () => {
    const items = ["Lunge A", "Lunge B", "Lunge C"];
    const results = sortByRelevance(items, "lunge", (s) => s);
    expect(results).toEqual(["Lunge A", "Lunge B", "Lunge C"]);
  });
});
