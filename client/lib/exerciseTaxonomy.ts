/**
 * Localized labels for muscle group / equipment taxonomy. The underlying
 * English values (from the DB, or the fixed filter categories in
 * ExercisesScreen) stay untouched for filtering/matching — only the
 * rendered label is translated, same pattern as exerciseDisplayName.ts.
 */

import { MUSCLE_GROUP_META } from "@/lib/exerciseImages";

type TFunction = (key: string, opts?: Record<string, unknown>) => string;

const MUSCLE_GROUP_KEYS: Record<string, string> = {
  All: "all",
  Chest: "chest",
  Back: "back",
  Shoulders: "shoulders",
  Legs: "legs",
  Arms: "arms",
  Core: "core",
  "Full Body": "fullBody",
  Biceps: "biceps",
  Triceps: "triceps",
  Forearms: "forearms",
  Traps: "traps",
  "Rear Delts": "rearDelts",
  Quads: "quads",
  Hamstrings: "hamstrings",
  Calves: "calves",
  Glutes: "glutes",
  Mobility: "mobility",
};

const EQUIPMENT_KEYS: Record<string, string> = {
  Barbell: "barbell",
  Dumbbell: "dumbbell",
  Dumbbells: "dumbbell",
  Cable: "cable",
  Machine: "machine",
  Bodyweight: "bodyweight",
  Kettlebell: "kettlebell",
  Kettlebells: "kettlebell",
  Bands: "bands",
  Other: "other",
};

// "Arms" only exists as a filter-category aggregate (ExercisesScreen), never a
// raw DB muscle_group value, so it needs its own entry outside MUSCLE_GROUP_META.
const ARMS_COLOR = "#DDA0DD";

// "Mobility" is a name-derived pseudo-category (stretch/mobility moves), not a
// raw DB muscle_group. Catalog rows keep their real muscle group (Legs, Back…);
// this only drives the browse/picker filter and its chip color.
const MOBILITY_COLOR = "#2FB8A6";

/**
 * Stretch / mobility classifier. The free-exercise-db catalog files these under
 * their target muscle group (e.g. "Hamstring Stretch" → Legs), so there's no DB
 * category to key on — every mobility move in the catalog is named "… Stretch",
 * which makes the name the reliable signal (51 rows, zero false positives).
 */
export function isMobilityExercise(name: string): boolean {
  return name.toLowerCase().includes("stretch");
}

/**
 * Consistent accent color per muscle group, shared across the catalog grid,
 * plan detail view, and exercise picker rows — single source of truth is
 * MUSCLE_GROUP_META (also used for the exercise detail modal's icon+color badge).
 */
export function getMuscleGroupColor(group: string): string {
  if (group === "Arms") return ARMS_COLOR;
  if (group === "Mobility") return MOBILITY_COLOR;
  return MUSCLE_GROUP_META[group]?.color ?? "#647692";
}

export function translateMuscleGroup(t: TFunction, group: string): string {
  const key = MUSCLE_GROUP_KEYS[group];
  if (!key) return group;
  return t(`exercises.muscleGroups.${key}`, { defaultValue: group });
}

export function translateEquipment(t: TFunction, equipment: string): string {
  // DB values arrive lowercase (e.g. "barbell"); UI/local data arrives capitalized.
  const normalized = equipment.charAt(0).toUpperCase() + equipment.slice(1).toLowerCase();
  const key = EQUIPMENT_KEYS[normalized];
  if (!key) return equipment;
  return t(`exercises.equipment.${key}`, { defaultValue: equipment });
}

const CATEGORY_KEYS: Record<string, string> = {
  Compound: "compound",
  Isolation: "isolation",
  Exercise: "genericExercise",
};

export function translateExerciseCategory(t: TFunction, category: string): string {
  const key = CATEGORY_KEYS[category];
  if (!key) return category;
  return t(`exercises.category.${key}`, { defaultValue: category });
}
