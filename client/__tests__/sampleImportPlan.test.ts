import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";

import { buildSampleImportPlan } from "@/lib/sampleImportPlan";
import { importMatchStatus, type CatalogRow } from "@/lib/importCatalog";

const t = ((key: string) => key) as unknown as TFunction;

const names = [
  "Barbell Squat", "Dumbbell Bench Press", "Seated Cable Rows", "Face Pull", "Dead Bug",
  "Romanian Deadlift", "Pullups", "Dumbbell Shoulder Press", "Kettlebell Swing",
  "Hanging Leg Raise", "World's Greatest Stretch", "Pigeon Stretch", "Cat Stretch", "Glute Bridge",
];
const catalog: CatalogRow[] = names.map((name, i) => ({
  id: i + 1,
  name,
  muscle_group: "Legs",
  equipment: "barbell",
}));

describe("buildSampleImportPlan", () => {
  const plan = buildSampleImportPlan(t, catalog);

  it("shows the structure the import understands", () => {
    expect(plan.schedule?.weeks).toHaveLength(2);
    expect(plan.days.map((d) => d.kind)).toEqual(["strength", "strength", "mobility"]);
    expect(plan.days[0].exercises.filter((e) => e.superset === "A")).toHaveLength(2);
    expect(plan.days[0].warmup).toBeTruthy();
  });

  it("maps every exercise to the catalog, with one guess left to check", () => {
    const statuses = plan.days.flatMap((d) => d.exercises.map(importMatchStatus));
    expect(statuses.filter((s) => s === "custom")).toHaveLength(0);
    expect(statuses.filter((s) => s === "check")).toHaveLength(1);
  });

  it("keeps working without the catalog", () => {
    const offline = buildSampleImportPlan(t, []);
    expect(offline.days.flatMap((d) => d.exercises)).toHaveLength(14);
  });
});
