import { describe, it, expect, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));

import { isTimedExercise, renameExerciseInHistory, renameExerciseInPlans } from "@/lib/customExercises";
import type { WorkoutPlan, WorkoutSession } from "@/lib/storage";

describe("isTimedExercise", () => {
  it("guesses from the name and the target", () => {
    expect(isTimedExercise("Plank", "3", {})).toBe(true);
    expect(isTimedExercise("Hyperextension", "30-45 s", {})).toBe(true);
    expect(isTimedExercise("Hyperextension", "12", {})).toBe(false);
  });

  it("lets the user's choice win either way", () => {
    expect(isTimedExercise("Hyperextension", "12", { hyperextension: "time" })).toBe(true);
    expect(isTimedExercise("Plank", "30 s", { plank: "weight" })).toBe(false);
  });
});

const plan = (names: string[]): WorkoutPlan => ({
  id: "p",
  name: "P",
  daysPerWeek: 1,
  days: [{ dayName: "A", exercises: names.map((n, i) => ({ id: String(i), name: n, muscleGroup: "Back", sets: 3, reps: "10" })) }],
  createdAt: "",
  lastModified: "",
});

describe("renameExerciseInPlans", () => {
  it("renames every use, case-insensitively", () => {
    const [p] = renameExerciseInPlans([plan(["hyperext hold", "Row"])], "Hyperext Hold", "Hyperextension Hold");
    expect(p.days[0].exercises.map((e) => e.name)).toEqual(["Hyperextension Hold", "Row"]);
  });

  it("returns the same array when nothing matches", () => {
    const plans = [plan(["Row"])];
    expect(renameExerciseInPlans(plans, "Curl", "Hammer Curl")).toBe(plans);
  });
});

describe("renameExerciseInHistory", () => {
  it("keeps one exercise's history under its new name", () => {
    const session = { id: "s", planId: "p", planName: "P", dayName: "A", completedAt: "", exercises: plan(["Old"]).days[0].exercises } as WorkoutSession;
    expect(renameExerciseInHistory([session], "old", "New")[0].exercises[0].name).toBe("New");
  });
});
