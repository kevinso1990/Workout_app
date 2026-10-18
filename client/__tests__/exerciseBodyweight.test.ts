import { describe, it, expect } from "vitest";

import { isBodyweightExercise } from "@/lib/exerciseBodyweight";

describe("isBodyweightExercise", () => {
  it("hides weight for stretches even when the catalog files them under 'Other'", () => {
    // The real catalog row for Cat Stretch has equipment "Other", which used
    // to put a KG column on a stretch.
    expect(isBodyweightExercise({ name: "Cat Stretch", equipment: "Other" })).toBe(true);
    expect(isBodyweightExercise({ name: "Child's Pose", equipment: "other" })).toBe(true);
    expect(isBodyweightExercise({ name: "Pigeon Stretch", equipment: null })).toBe(true);
  });

  it("recognises bodyweight by equipment, mechanics, or name", () => {
    expect(isBodyweightExercise({ name: "Anything", equipment: "Bodyweight" })).toBe(true);
    expect(isBodyweightExercise({ name: "Anything", mechanics: "calisthenics" })).toBe(true);
    expect(isBodyweightExercise({ name: "Pull-Up", equipment: "Other" })).toBe(true);
  });

  it("keeps the weight column for loaded exercises", () => {
    expect(isBodyweightExercise({ name: "Barbell Bench Press", equipment: "Barbell" })).toBe(false);
    expect(isBodyweightExercise({ name: "Kettlebell Swing", equipment: "Kettlebell" })).toBe(false);
  });
});
