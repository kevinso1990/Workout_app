/**
 * Regression guard for beginner plan generation across the full
 * equipment x split x day-count matrix.
 *
 * Root bug this protects against: a beginner-tier exercise pool silently
 * containing a movement that most true beginners cannot perform at all
 * (unassisted Pull-Up/Chin-Up as the ONLY back exercise) or that is unsafe
 * to self-teach without coaching (barbell compounds, ballistic kettlebell
 * lifts like KB Swing/Snatch/Turkish Get-Up). These bugs don't throw or
 * fail type-checking — the plan "generates fine", it's just unusable or
 * unsafe for the athlete it was generated for. The only way to catch that
 * class of bug is to actually enumerate every combination and inspect the
 * exercise names, which is what this file does.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
    multiRemove: vi.fn(() => Promise.resolve()),
  },
}));

import {
  generateEquipmentAwarePlan,
  type Equipment,
  type Exercise,
} from "@/lib/storage";
import { buildOnboardingPlan, SPLIT_OPTIONS } from "@/lib/onboardingUtils";

// Exact (case-insensitive) exercise names a true beginner should never be
// handed unsupervised on that equipment type. Deliberately exact-match, not
// substring — e.g. "Tricep Dips" (safe, feet-supported) must not be caught
// by a loose match on "dips" that's really targeting "Chest Dips".
const UNSAFE_FOR_BEGINNER: Partial<Record<Equipment, string[]>> = {
  full_gym: [
    "barbell squat",
    "barbell deadlift",
    "barbell bench press",
    "bent over barbell row",
    "barbell overhead press",
    "barbell curl",
    "barbell bicep curl",
  ],
  bodyweight: [
    "pull-ups",
    "pull-up",
    "pullups",
    "chin-ups",
    "chin-up",
    "chest dips",
    "pistol squat",
    "sissy squat",
    "muscle-up",
    "muscle-ups",
    "hanging leg raise",
    "handstand push-ups",
  ],
  home_minimal: [
    "pull-ups",
    "pull-up",
    "pullups",
    "chin-ups",
    "chin-up",
    "chest dips",
    "pistol squat",
    "sissy squat",
    "muscle-up",
    "muscle-ups",
    "hanging leg raise",
    "handstand push-ups",
  ],
  kettlebell: [
    "kb swing",
    "kb renegade row",
    "kb high pull",
    "kb turkish get-up",
    "kb push press",
    "kb snatch",
    "kb clean",
  ],
};

function collectExerciseNames(days: { exercises: Exercise[] }[]): string[] {
  return days.flatMap((d) => d.exercises.map((e) => e.name));
}

function assertNoUnsafeExercises(equipment: Equipment, names: string[], context: string) {
  const blocklist = UNSAFE_FOR_BEGINNER[equipment];
  if (!blocklist) return;
  const lowerNames = names.map((n) => n.toLowerCase());
  for (const unsafe of blocklist) {
    expect(
      lowerNames.includes(unsafe),
      `${context}: found blocklisted beginner exercise "${unsafe}" (equipment=${equipment})`,
    ).toBe(false);
  }
}

const EQUIPMENT_WITH_BEGINNER_GUARDS = Object.keys(UNSAFE_FOR_BEGINNER) as Equipment[];

describe("Beginner plan generation — generateEquipmentAwarePlan (manual Create Plan flow)", () => {
  for (const equipment of EQUIPMENT_WITH_BEGINNER_GUARDS) {
    for (let daysPerWeek = 1; daysPerWeek <= 7; daysPerWeek++) {
      it(`${equipment} / ${daysPerWeek}d/week: no unsafe exercises, no empty days`, () => {
        const plan = generateEquipmentAwarePlan(daysPerWeek, "Test Plan", equipment, "beginner");

        expect(plan.days.length).toBe(daysPerWeek);
        for (const day of plan.days) {
          expect(
            day.exercises.length,
            `${equipment}/${daysPerWeek}d — day "${day.dayName}" has no exercises`,
          ).toBeGreaterThan(0);
        }

        const names = collectExerciseNames(plan.days);
        assertNoUnsafeExercises(equipment, names, `generateEquipmentAwarePlan(${daysPerWeek}, ${equipment})`);
      });
    }
  }
});

describe("Beginner plan generation — buildOnboardingPlan (onboarding flow)", () => {
  for (const equipment of EQUIPMENT_WITH_BEGINNER_GUARDS) {
    for (const split of SPLIT_OPTIONS) {
      // A couple of representative day counts per split: the split's minimum,
      // and one past it (capped at 7) so multi-cycle / Full-Body-variant logic
      // is exercised too.
      const dayCounts = [split.minDays, Math.min(split.minDays + 2, 7)];
      for (const daysPerWeek of dayCounts) {
        it(`${equipment} / ${split.id} / ${daysPerWeek}d/week: no unsafe exercises, no empty days`, () => {
          const plan = buildOnboardingPlan(split.id, daysPerWeek, equipment, "beginner");

          expect(plan.days.length).toBe(daysPerWeek);
          for (const day of plan.days) {
            expect(
              day.exercises.length,
              `${equipment}/${split.id}/${daysPerWeek}d — day "${day.dayName}" has no exercises`,
            ).toBeGreaterThan(0);
          }

          const names = collectExerciseNames(plan.days);
          assertNoUnsafeExercises(
            equipment,
            names,
            `buildOnboardingPlan(${split.id}, ${daysPerWeek}, ${equipment})`,
          );
        });
      }
    }
  }
});

describe("Beginner plan generation — intermediate/advanced are unaffected", () => {
  it("full_gym intermediate still gets barbell compounds (guard is beginner-only)", () => {
    const plan = generateEquipmentAwarePlan(3, "Test", "full_gym", "intermediate");
    const names = collectExerciseNames(plan.days).map((n) => n.toLowerCase());
    expect(names.some((n) => n.includes("barbell"))).toBe(true);
  });

  it("kettlebell advanced still gets KB Swing (ballistic work is fine once experienced)", () => {
    const plan = generateEquipmentAwarePlan(3, "Test", "kettlebell", "advanced");
    const names = collectExerciseNames(plan.days).map((n) => n.toLowerCase());
    expect(names.some((n) => n === "kb swing")).toBe(true);
  });
});
