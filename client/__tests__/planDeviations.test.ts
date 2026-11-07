import { describe, it, expect } from "vitest";

import { detectPlanDeviations, applyPlanDeviation } from "@/lib/planDeviations";
import type { Exercise, WorkoutPlan, WorkoutSession } from "@/lib/storage";

const ex = (id: string, name: string, sets = 3, muscleGroup = "Chest"): Exercise => ({
  id,
  name,
  muscleGroup,
  sets,
  reps: "8-12",
});

const plan: WorkoutPlan = {
  id: "p1",
  name: "Plan",
  daysPerWeek: 1,
  createdAt: "2026-01-01T00:00:00Z",
  lastModified: "2026-01-01T00:00:00Z",
  days: [
    {
      dayName: "Full Body B",
      exercises: [
        ex("a", "Bench Press"),
        ex("b", "Lateral Raise", 3, "Shoulders"),
        ex("c", "Leg Press", 3, "Legs"),
      ],
    },
  ],
};

/** One session: per exercise name, how many working sets were completed. */
function session(day: number, done: Record<string, number>, extras: Exercise[] = []): WorkoutSession {
  const exercises = [...plan.days[0].exercises, ...extras];
  return {
    id: String(day),
    planId: "p1",
    planName: "Plan",
    dayName: "Full Body B",
    completedAt: `2026-02-0${day}T10:00:00Z`,
    exercises,
    exerciseProgress: exercises.map((e) => ({
      exerciseId: e.id,
      sets: Array.from({ length: Math.max(e.sets, done[e.name] ?? 0) }, (_, i) => ({
        weight: "50",
        reps: "10",
        rating: null,
        completed: i < (done[e.name] ?? e.sets),
      })),
    })),
  };
}

describe("detectPlanDeviations", () => {
  it("asks only after the same habit three sessions in a row", () => {
    const two = [1, 2].map((d) => session(d, { "Lateral Raise": 0 }));
    expect(detectPlanDeviations(plan, 0, two, new Set())).toEqual([]);

    const three = [1, 2, 3].map((d) => session(d, { "Lateral Raise": 0 }));
    expect(detectPlanDeviations(plan, 0, three, new Set())).toMatchObject([
      { kind: "skip", exerciseName: "Lateral Raise" },
    ]);
  });

  it("suggests the usual set count when sets are always dropped or added", () => {
    const history = [
      session(1, { "Bench Press": 2, "Leg Press": 4 }),
      session(2, { "Bench Press": 2, "Leg Press": 5 }),
      session(3, { "Bench Press": 1, "Leg Press": 4 }),
    ];
    expect(detectPlanDeviations(plan, 0, history, new Set())).toMatchObject([
      { kind: "sets", exerciseName: "Bench Press", from: 3, to: 2 },
      { kind: "sets", exerciseName: "Leg Press", from: 3, to: 4 },
    ]);
  });

  it("ignores a mixed pattern", () => {
    const history = [
      session(1, { "Bench Press": 2 }),
      session(2, { "Bench Press": 3 }),
      session(3, { "Bench Press": 2 }),
    ];
    expect(detectPlanDeviations(plan, 0, history, new Set())).toEqual([]);
  });

  it("offers an exercise that is added every time, and merges a same-muscle swap", () => {
    const curls = ex("x", "Biceps Curl", 3, "Biceps");
    const flyes = ex("y", "Cable Fly", 3, "Shoulders");
    const history = [1, 2, 3].map((d) =>
      session(d, { "Lateral Raise": 0, "Biceps Curl": 3, "Cable Fly": 2 }, [curls, flyes]),
    );
    const out = detectPlanDeviations(plan, 0, history, new Set());
    expect(out).toMatchObject([
      { kind: "replace", exerciseName: "Lateral Raise", exercise: { name: "Cable Fly", sets: 2 } },
      { kind: "add", exercise: { name: "Biceps Curl", sets: 3 } },
    ]);
  });

  it("only counts sessions after the plan was last edited, and skips answered ones", () => {
    const history = [1, 2, 3].map((d) => session(d, { "Lateral Raise": 0 }));
    const edited = { ...plan, lastModified: "2026-02-02T12:00:00Z" };
    expect(detectPlanDeviations(edited, 0, history, new Set())).toEqual([]);

    const [found] = detectPlanDeviations(plan, 0, history, new Set());
    expect(detectPlanDeviations(plan, 0, history, new Set([found.key]))).toEqual([]);
  });

  it("treats a session with nothing logged as abandoned, not as a habit", () => {
    const history = [
      session(1, { "Lateral Raise": 0 }),
      session(2, { "Bench Press": 0, "Lateral Raise": 0, "Leg Press": 0 }),
      session(3, { "Lateral Raise": 0 }),
    ];
    expect(detectPlanDeviations(plan, 0, history, new Set())).toEqual([]);
  });
});

describe("applyPlanDeviation", () => {
  const now = "2026-03-01T00:00:00Z";

  it("writes each kind into the plan day and bumps lastModified", () => {
    const sets = applyPlanDeviation(
      plan,
      0,
      { kind: "sets", key: "k", exerciseName: "Bench Press", from: 3, to: 2 },
      now,
    );
    expect(sets.days[0].exercises[0].sets).toBe(2);
    expect(sets.lastModified).toBe(now);

    const skip = applyPlanDeviation(plan, 0, { kind: "skip", key: "k", exerciseName: "Lateral Raise" }, now);
    expect(skip.days[0].exercises.map((e) => e.name)).toEqual(["Bench Press", "Leg Press"]);

    const replace = applyPlanDeviation(
      plan,
      0,
      { kind: "replace", key: "k", exerciseName: "Lateral Raise", exercise: ex("y", "Cable Fly", 2) },
      now,
    );
    expect(replace.days[0].exercises.map((e) => e.name)).toEqual(["Bench Press", "Cable Fly", "Leg Press"]);

    const add = applyPlanDeviation(plan, 0, { kind: "add", key: "k", exercise: ex("x", "Biceps Curl") }, now);
    expect(add.days[0].exercises.map((e) => e.name)).toEqual([
      "Bench Press",
      "Lateral Raise",
      "Leg Press",
      "Biceps Curl",
    ]);
  });
});
