import type { TFunction } from "i18next";

import type { ImportedExercise, ImportedWorkoutPlan } from "@/hooks/useWorkoutImport";
import type { CatalogRow } from "@/lib/importCatalog";

type SampleExercise = {
  name: string;
  sets: number;
  reps: string;
  restSeconds?: number;
  superset?: string;
  /** What a trainer's sheet might say instead — shown as a guess to check. */
  writtenAs?: string;
};

/**
 * A plan of our own (no trainer's sheet copied) that shows what the import
 * understands — a two-week rotation, a superset, warm-ups, rest times and a
 * mobility day — for someone who wants to see it before they have their own
 * plan at hand. One exercise arrives as a guess, so the review shows how a
 * doubtful match is checked.
 */
const DAY_A: SampleExercise[] = [
  { name: "Barbell Squat", sets: 3, reps: "6-8", restSeconds: 120 },
  { name: "Dumbbell Bench Press", sets: 3, reps: "8-10", restSeconds: 90 },
  { name: "Seated Cable Rows", sets: 3, reps: "10", superset: "A", restSeconds: 60 },
  { name: "Face Pull", sets: 3, reps: "12-15", superset: "A", restSeconds: 60 },
  { name: "Dead Bug", sets: 2, reps: "10" },
];

const DAY_B: SampleExercise[] = [
  { name: "Romanian Deadlift", sets: 3, reps: "8", restSeconds: 120 },
  { name: "Pullups", sets: 3, reps: "6-8", restSeconds: 90 },
  { name: "Dumbbell Shoulder Press", sets: 3, reps: "10", restSeconds: 90 },
  { name: "Kettlebell Swing", sets: 3, reps: "15", writtenAs: "KB Swings russisch" },
  { name: "Hanging Leg Raise", sets: 2, reps: "8-12" },
];

const MOBILITY: SampleExercise[] = [
  { name: "World's Greatest Stretch", sets: 2, reps: "5" },
  { name: "Pigeon Stretch", sets: 2, reps: "30" },
  { name: "Cat Stretch", sets: 2, reps: "10" },
  { name: "Glute Bridge", sets: 2, reps: "12" },
];

function toImported(ex: SampleExercise, catalog: CatalogRow[]): ImportedExercise {
  const row = catalog.find((r) => r.name === ex.name);
  return {
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    weight: null,
    notes: null,
    superset: ex.superset ?? null,
    restSeconds: ex.restSeconds ?? null,
    catalogExerciseId: row?.id ?? null,
    muscleGroup: row?.muscle_group,
    importMeta: {
      originalName: ex.writtenAs ?? ex.name,
      matchQuality: ex.writtenAs ? "fuzzy" : "exact",
      needsUserMapping: false,
    },
  };
}

export function buildSampleImportPlan(t: TFunction, catalog: CatalogRow[]): ImportedWorkoutPlan {
  const day = (list: SampleExercise[]) => list.map((ex) => toImported(ex, catalog));
  return {
    planName: t("importWorkout.sample.planName"),
    days: [
      {
        dayName: t("importWorkout.sample.dayA"),
        kind: "strength",
        warmup: t("importWorkout.sample.warmup"),
        exercises: day(DAY_A),
      },
      {
        dayName: t("importWorkout.sample.dayB"),
        kind: "strength",
        warmup: t("importWorkout.sample.warmup"),
        exercises: day(DAY_B),
      },
      { dayName: t("importWorkout.sample.mobility"), kind: "mobility", exercises: day(MOBILITY) },
    ],
    // Mo / Mi / Fr alternate A and B over two weeks; Saturday is mobility.
    schedule: {
      weeks: [
        [
          { weekday: 0, dayIndex: 0 },
          { weekday: 2, dayIndex: 1 },
          { weekday: 4, dayIndex: 0 },
          { weekday: 5, dayIndex: 2 },
        ],
        [
          { weekday: 0, dayIndex: 1 },
          { weekday: 2, dayIndex: 0 },
          { weekday: 4, dayIndex: 1 },
          { weekday: 5, dayIndex: 2 },
        ],
      ],
    },
  };
}
