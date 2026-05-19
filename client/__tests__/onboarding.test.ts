/**
 * Automated tests for the onboarding flow.
 *
 * Coverage:
 *  - ProgressBar advancement: correct number of dots are "active" on each screen
 *  - Per-screen Continue-button guards: disabled until required selection is made
 *  - Recommended split logic: all fitness-level / day-count / goal combinations
 *  - buildOnboardingPlan: plan shape, Full Body A/B/C variants, exercise population
 *  - Full onboarding sequence: simulates walking through every screen in order,
 *    making selections, building the WorkoutPlan via the shared production function,
 *    persisting preferences, and marking onboarding complete
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock AsyncStorage before importing any storage functions.
// The onboarding's final step calls setUserPreferences, saveWorkoutPlan, and
// setOnboardingComplete – all backed by AsyncStorage – so we mock the module.
// ---------------------------------------------------------------------------
vi.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
        return Promise.resolve();
      }),
      multiRemove: vi.fn((keys: string[]) => {
        keys.forEach((k) => delete store[k]);
        return Promise.resolve();
      }),
    },
  };
});

import {
  getRecommendedSplit,
  getActiveProgressDotIndices,
  canAdvanceFromEquipment,
  canAdvanceFromGoals,
  canAdvanceFromFitnessLevel,
  buildOnboardingPlan,
  type FitnessLevel,
  type FitnessGoal,
  type Equipment,
  type MuscleGroup,
} from "../lib/onboardingUtils";

import {
  getEquipmentExercises,
  setOnboardingComplete,
  setUserPreferences,
  saveWorkoutPlan,
  getOnboardingComplete,
  type WorkoutDay,
} from "../lib/storage";

// ---------------------------------------------------------------------------
// Shared test state shape (mirrors OnboardingContext state)
// ---------------------------------------------------------------------------

interface OnboardingState {
  workoutDaysPerWeek: number;
  fitnessLevel: FitnessLevel | null;
  fitnessGoals: FitnessGoal[];
  equipment: Equipment | null;
  focusMuscles: MuscleGroup[];
  splitPreference: "choose" | "recommended" | null;
  exercisePreference: "choose" | "default" | null;
  cardioDays: string[];
}

function makeInitialState(): OnboardingState {
  return {
    workoutDaysPerWeek: 3,
    fitnessLevel: null,
    fitnessGoals: [],
    equipment: null,
    focusMuscles: [],
    splitPreference: null,
    exercisePreference: null,
    cardioDays: [],
  };
}

// ---------------------------------------------------------------------------
// ProgressBar advancement — getActiveProgressDotIndices
// Screens and their step values: Equipment=1, Goals=2, Frequency=3,
// FitnessLevel=4 (out of 4 total).
// ---------------------------------------------------------------------------

describe("ProgressBar advancement across onboarding screens", () => {
  const TOTAL = 4;

  it("Equipment screen (step 1 of 4): exactly 1 dot is active", () => {
    const active = getActiveProgressDotIndices(1, TOTAL);
    expect(active).toHaveLength(1);
    expect(active).toEqual([0]);
  });

  it("Goals screen (step 2 of 4): exactly 2 dots are active", () => {
    const active = getActiveProgressDotIndices(2, TOTAL);
    expect(active).toHaveLength(2);
    expect(active).toEqual([0, 1]);
  });

  it("Frequency screen (step 3 of 4): exactly 3 dots are active", () => {
    const active = getActiveProgressDotIndices(3, TOTAL);
    expect(active).toHaveLength(3);
    expect(active).toEqual([0, 1, 2]);
  });

  it("FitnessLevel screen (step 4 of 4): all 4 dots are active", () => {
    const active = getActiveProgressDotIndices(4, TOTAL);
    expect(active).toHaveLength(4);
    expect(active).toEqual([0, 1, 2, 3]);
  });

  it("each screen adds exactly one more active dot than the previous", () => {
    for (let step = 1; step <= TOTAL; step++) {
      const active = getActiveProgressDotIndices(step, TOTAL);
      expect(active).toHaveLength(step);
    }
  });
});

// ---------------------------------------------------------------------------
// Per-screen Continue-button guard logic
// ---------------------------------------------------------------------------

describe("Equipment screen: Continue button state", () => {
  it("is disabled before any equipment is selected", () => {
    expect(canAdvanceFromEquipment(null)).toBe(false);
  });

  it("becomes enabled when full_gym is selected", () => {
    expect(canAdvanceFromEquipment("full_gym")).toBe(true);
  });

  it("becomes enabled when dumbbells_only is selected", () => {
    expect(canAdvanceFromEquipment("dumbbells_only")).toBe(true);
  });

  it("becomes enabled when bodyweight is selected", () => {
    expect(canAdvanceFromEquipment("bodyweight")).toBe(true);
  });

  it("becomes enabled when kettlebell is selected", () => {
    expect(canAdvanceFromEquipment("kettlebell")).toBe(true);
  });
});

describe("Goals screen: Continue button state", () => {
  it("is disabled when no goals are selected", () => {
    expect(canAdvanceFromGoals([])).toBe(false);
  });

  it("becomes enabled when one goal is selected", () => {
    expect(canAdvanceFromGoals(["build_muscle"])).toBe(true);
  });

  it("remains enabled with multiple goals selected", () => {
    expect(canAdvanceFromGoals(["build_muscle", "lose_fat", "get_stronger"])).toBe(true);
  });
});

describe("FitnessLevel screen: Continue button state", () => {
  it("is disabled before any level is selected", () => {
    expect(canAdvanceFromFitnessLevel(null)).toBe(false);
  });

  it("becomes enabled when beginner is selected", () => {
    expect(canAdvanceFromFitnessLevel("beginner")).toBe(true);
  });

  it("becomes enabled when intermediate is selected", () => {
    expect(canAdvanceFromFitnessLevel("intermediate")).toBe(true);
  });

  it("becomes enabled when advanced is selected", () => {
    expect(canAdvanceFromFitnessLevel("advanced")).toBe(true);
  });
});


// ---------------------------------------------------------------------------
// Recommended split logic
// ---------------------------------------------------------------------------

describe("getRecommendedSplit: beginner", () => {
  it("full-body for 1-3 days/week", () => {
    expect(getRecommendedSplit("beginner", 1, [])).toBe("full-body");
    expect(getRecommendedSplit("beginner", 2, [])).toBe("full-body");
    expect(getRecommendedSplit("beginner", 3, [])).toBe("full-body");
  });

  it("upper-lower for 4 days/week", () => {
    expect(getRecommendedSplit("beginner", 4, [])).toBe("upper-lower");
  });

  it("push-pull-legs for 5+ days/week", () => {
    expect(getRecommendedSplit("beginner", 5, [])).toBe("push-pull-legs");
    expect(getRecommendedSplit("beginner", 6, [])).toBe("push-pull-legs");
  });
});

describe("getRecommendedSplit: null level treated as beginner", () => {
  it("full-body at 3 days", () => {
    expect(getRecommendedSplit(null, 3, [])).toBe("full-body");
  });

  it("upper-lower at 4 days", () => {
    expect(getRecommendedSplit(null, 4, [])).toBe("upper-lower");
  });
});

describe("getRecommendedSplit: get_stronger goal (non-beginner)", () => {
  it("full-body at 3 days for intermediate", () => {
    expect(getRecommendedSplit("intermediate", 3, ["get_stronger"])).toBe("full-body");
  });

  it("upper-lower at 4 days for intermediate", () => {
    expect(getRecommendedSplit("intermediate", 4, ["get_stronger"])).toBe("upper-lower");
  });

  it("push-pull-legs at 5 days for advanced", () => {
    expect(getRecommendedSplit("advanced", 5, ["get_stronger"])).toBe("push-pull-legs");
  });
});

describe("getRecommendedSplit: intermediate", () => {
  it("full-body for 1-2 days/week", () => {
    expect(getRecommendedSplit("intermediate", 1, [])).toBe("full-body");
    expect(getRecommendedSplit("intermediate", 2, [])).toBe("full-body");
  });

  it("push-pull-legs for 3 days/week", () => {
    expect(getRecommendedSplit("intermediate", 3, [])).toBe("push-pull-legs");
  });

  it("upper-lower for 4 days/week", () => {
    expect(getRecommendedSplit("intermediate", 4, [])).toBe("upper-lower");
  });

  it("push-pull-legs for 5+ days/week", () => {
    expect(getRecommendedSplit("intermediate", 5, [])).toBe("push-pull-legs");
  });
});

describe("getRecommendedSplit: advanced", () => {
  it("full-body for 1-2 days/week", () => {
    expect(getRecommendedSplit("advanced", 1, [])).toBe("full-body");
    expect(getRecommendedSplit("advanced", 2, [])).toBe("full-body");
  });

  it("push-pull-legs for 3-4 days/week", () => {
    expect(getRecommendedSplit("advanced", 3, [])).toBe("push-pull-legs");
    expect(getRecommendedSplit("advanced", 4, [])).toBe("push-pull-legs");
  });

  it("bro-split for 5+ days/week", () => {
    expect(getRecommendedSplit("advanced", 5, [])).toBe("bro-split");
    expect(getRecommendedSplit("advanced", 6, [])).toBe("bro-split");
    expect(getRecommendedSplit("advanced", 7, [])).toBe("bro-split");
  });
});

// ---------------------------------------------------------------------------
// buildOnboardingPlan — the shared production plan-building function
// ---------------------------------------------------------------------------

describe("buildOnboardingPlan: plan shape and exercise population", () => {
  it("builds an upper-lower plan with 4 days (Upper/Lower/Upper/Lower)", () => {
    const plan = buildOnboardingPlan("upper-lower", 4, "full_gym", "intermediate");
    expect(plan.daysPerWeek).toBe(4);
    expect(plan.days).toHaveLength(4);
    expect(plan.days[0].dayName).toBe("Upper");
    expect(plan.days[1].dayName).toBe("Lower");
    expect(plan.days[2].dayName).toBe("Upper");
    expect(plan.days[3].dayName).toBe("Lower");
    plan.days.forEach((day) => expect(day.exercises.length).toBeGreaterThan(0));
  });

  it("builds a full-body plan with A/B/C variants for 3 days", () => {
    const plan = buildOnboardingPlan("full-body", 3, "full_gym", "beginner");
    expect(plan.days).toHaveLength(3);
    expect(plan.days[0].dayName).toBe("Full Body A");
    expect(plan.days[1].dayName).toBe("Full Body B");
    expect(plan.days[2].dayName).toBe("Full Body C");
    plan.days.forEach((day) => expect(day.exercises.length).toBeGreaterThan(0));
  });

  it("builds a full-body plan without variant suffix for 1 day", () => {
    const plan = buildOnboardingPlan("full-body", 1, "full_gym", "beginner");
    expect(plan.days).toHaveLength(1);
    expect(plan.days[0].dayName).toBe("Full Body");
  });

  it("builds a bro-split plan covering Chest/Back/Shoulders/Arms/Legs for 5 days", () => {
    const plan = buildOnboardingPlan("bro-split", 5, "full_gym", "advanced");
    expect(plan.days).toHaveLength(5);
    const dayNames = plan.days.map((d) => d.dayName);
    expect(dayNames).toEqual(["Chest", "Back", "Shoulders", "Arms", "Legs"]);
    plan.days.forEach((day) => expect(day.exercises.length).toBeGreaterThan(0));
  });

  it("throws for an unknown split id", () => {
    expect(() => buildOnboardingPlan("unknown-split", 3, "full_gym", "beginner")).toThrow(
      "Unknown split id: unknown-split",
    );
  });

  it("populates bodyweight exercises when equipment is bodyweight", () => {
    const plan = buildOnboardingPlan("push-pull-legs", 3, "bodyweight", "intermediate");
    plan.days.forEach((day) => {
      expect(day.exercises.length).toBeGreaterThan(0);
      day.exercises.forEach((ex) => {
        expect(ex).toHaveProperty("name");
        expect(ex).toHaveProperty("sets");
        expect(ex).toHaveProperty("reps");
      });
    });
  });

  it("uses a custom planId when provided", () => {
    const plan = buildOnboardingPlan("full-body", 2, "full_gym", "beginner", "custom-id-123");
    expect(plan.id).toBe("custom-id-123");
  });
});

// ---------------------------------------------------------------------------
// Full onboarding flow integration test
// Simulates a user walking through every screen in the correct order,
// making selections via the production utilities, and completing onboarding.
// ---------------------------------------------------------------------------

describe("Full onboarding sequence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("steps through all screens in the correct order and creates a plan", async () => {
    let state = makeInitialState();

    // ── Screen 1: Welcome ─────────────────────────────────────────────────
    // No selection needed — user taps "Get Started" and progresses to Equipment.
    // (ProgressBar is not shown on Welcome screen)

    // ── Screen 2: Equipment (ProgressBar step 1/4) ────────────────────────
    expect(canAdvanceFromEquipment(state.equipment)).toBe(false);
    state.equipment = "full_gym";
    expect(canAdvanceFromEquipment(state.equipment)).toBe(true);
    expect(getActiveProgressDotIndices(1, 4)).toEqual([0]);

    // ── Screen 3: Goals (ProgressBar step 2/4) ────────────────────────────
    expect(canAdvanceFromGoals(state.fitnessGoals)).toBe(false);
    state.fitnessGoals = ["build_muscle"];
    expect(canAdvanceFromGoals(state.fitnessGoals)).toBe(true);
    expect(getActiveProgressDotIndices(2, 4)).toEqual([0, 1]);

    // ── Screen 4: Frequency (ProgressBar step 3/4) ────────────────────────
    // FrequencyScreen always shows a selected day (default 3), so Continue is
    // always enabled. User changes to 4 days/week.
    state.workoutDaysPerWeek = 4;
    expect(getActiveProgressDotIndices(3, 4)).toEqual([0, 1, 2]);

    // ── Screen 5: FitnessLevel (ProgressBar step 4/4) ─────────────────────
    expect(canAdvanceFromFitnessLevel(state.fitnessLevel)).toBe(false);
    state.fitnessLevel = "intermediate";
    expect(canAdvanceFromFitnessLevel(state.fitnessLevel)).toBe(true);
    expect(getActiveProgressDotIndices(4, 4)).toEqual([0, 1, 2, 3]);

    // ── Screen 6: SplitSelection — recommended split pre-selected ──────────
    const recommendedSplitId = getRecommendedSplit(
      state.fitnessLevel,
      state.workoutDaysPerWeek,
      state.fitnessGoals,
    );
    // intermediate + 4 days + build_muscle → upper-lower
    expect(recommendedSplitId).toBe("upper-lower");

    // ── "Create My Plan" action ────────────────────────────────────────────
    // Persist user preferences
    await setUserPreferences({
      workoutDaysPerWeek: state.workoutDaysPerWeek,
      splitPreference: "recommended",
      exercisePreference: "default",
      cardioDays: [],
      fitnessLevel: state.fitnessLevel,
      fitnessGoals: state.fitnessGoals,
      equipment: state.equipment,
      focusMuscles: state.focusMuscles,
    });

    // Build and save the workout plan using the shared production function
    const plan = buildOnboardingPlan(
      recommendedSplitId,
      state.workoutDaysPerWeek,
      state.equipment,
      state.fitnessLevel,
      "integration-test-plan",
    );
    expect(plan.daysPerWeek).toBe(4);
    expect(plan.days).toHaveLength(4);
    // Upper/Lower alternating for 4 days: Upper, Lower, Upper, Lower
    expect(plan.days[0].dayName).toBe("Upper");
    expect(plan.days[1].dayName).toBe("Lower");
    expect(plan.days[2].dayName).toBe("Upper");
    expect(plan.days[3].dayName).toBe("Lower");
    // Each day should have exercises populated
    plan.days.forEach((day) => {
      expect(day.exercises.length).toBeGreaterThan(0);
    });

    await saveWorkoutPlan(plan);

    // Mark onboarding complete — this triggers navigation to Main
    await setOnboardingComplete(true);

    // Verify the flag is persisted correctly in AsyncStorage
    const isComplete = await getOnboardingComplete();
    expect(isComplete).toBe(true);
  });

  it("beginner doing 3 days/week gets a full-body plan with A/B/C variants", async () => {
    const state: OnboardingState = {
      ...makeInitialState(),
      equipment: "full_gym",
      fitnessGoals: ["build_muscle"],
      workoutDaysPerWeek: 3,
      fitnessLevel: "beginner",
      focusMuscles: [],
    };

    const recommendedSplitId = getRecommendedSplit(
      state.fitnessLevel,
      state.workoutDaysPerWeek,
      state.fitnessGoals,
    );
    expect(recommendedSplitId).toBe("full-body");

    const plan = buildOnboardingPlan(
      recommendedSplitId,
      state.workoutDaysPerWeek,
      state.equipment,
      state.fitnessLevel,
    );
    expect(plan.daysPerWeek).toBe(3);
    expect(plan.days).toHaveLength(3);
    // With 3 full-body days, variants A/B/C should be used
    expect(plan.days[0].dayName).toBe("Full Body A");
    expect(plan.days[1].dayName).toBe("Full Body B");
    expect(plan.days[2].dayName).toBe("Full Body C");
    plan.days.forEach((day) => {
      expect(day.exercises.length).toBeGreaterThan(0);
    });
  });

  it("advanced user training 5 days gets a bro-split plan covering all muscle groups", async () => {
    const state: OnboardingState = {
      ...makeInitialState(),
      equipment: "full_gym",
      fitnessGoals: ["build_muscle"],
      workoutDaysPerWeek: 5,
      fitnessLevel: "advanced",
      focusMuscles: ["chest", "back"],
    };

    const recommendedSplitId = getRecommendedSplit(
      state.fitnessLevel,
      state.workoutDaysPerWeek,
      state.fitnessGoals,
    );
    expect(recommendedSplitId).toBe("bro-split");

    const plan = buildOnboardingPlan(
      recommendedSplitId,
      state.workoutDaysPerWeek,
      state.equipment,
      state.fitnessLevel,
    );
    expect(plan.daysPerWeek).toBe(5);
    expect(plan.days).toHaveLength(5);
    const dayNames = plan.days.map((d) => d.dayName);
    expect(dayNames).toEqual(["Chest", "Back", "Shoulders", "Arms", "Legs"]);
    plan.days.forEach((day) => {
      expect(day.exercises.length).toBeGreaterThan(0);
    });
  });

  it("bodyweight user gets appropriate exercises for each split day", () => {
    const plan = buildOnboardingPlan("push-pull-legs", 3, "bodyweight", "intermediate");

    plan.days.forEach((day) => {
      expect(day.exercises.length).toBeGreaterThan(0);
      day.exercises.forEach((ex) => {
        expect(ex).toHaveProperty("name");
        expect(ex).toHaveProperty("sets");
        expect(ex).toHaveProperty("reps");
      });
    });
  });

  it("completing onboarding without focus muscles still builds a valid plan", async () => {
    const state: OnboardingState = {
      ...makeInitialState(),
      equipment: "dumbbells_only",
      fitnessGoals: ["lose_fat"],
      workoutDaysPerWeek: 4,
      fitnessLevel: "beginner",
      focusMuscles: [],
    };

    const recommendedSplitId = getRecommendedSplit(
      state.fitnessLevel,
      state.workoutDaysPerWeek,
      state.fitnessGoals,
    );
    expect(recommendedSplitId).toBe("upper-lower");

    const plan = buildOnboardingPlan(
      recommendedSplitId,
      state.workoutDaysPerWeek,
      state.equipment,
      state.fitnessLevel,
    );
    await saveWorkoutPlan(plan);
    await setOnboardingComplete(true);

    const isComplete = await getOnboardingComplete();
    expect(isComplete).toBe(true);
  });
});
