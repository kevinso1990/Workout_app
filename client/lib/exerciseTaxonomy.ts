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
 * Mobility/stretching exercise names from free-exercise-db's own "stretching"
 * category that don't contain "stretch" (e.g. "Child's Pose", "Cat Stretch"'s
 * sibling "90/90 Hamstring", foam-rolling "…-SMR" moves). The `exercises`
 * table has no category column, so this is the exact-name list for everything
 * in that category minus the ones `isMobilityExercise`'s substring check
 * already catches — regenerate from the "stretching"-category rows of
 * https://github.com/yuhonas/free-exercise-db if that source is re-imported.
 */
const MOBILITY_EXACT_NAMES = new Set(
  [
    "90/90 Hamstring", "Adductor", "Adductor/Groin", "Ankle Circles",
    "Ankle On The Knee", "Anterior Tibialis-SMR", "Arm Circles",
    "Brachialis-SMR", "Calves-SMR", "Child's Pose", "Crossover Reverse Lunge",
    "Elbow Circles", "Elbows Back", "Foot-SMR", "Frog Hops",
    "Front Leg Raises", "Groiners", "Hamstring-SMR", "Hip Circles (prone)",
    "Hug A Ball", "Hug Knees To Chest", "Iliotibial Tract-SMR", "Inchworm",
    "Knee Across The Body", "Knee Circles", "Kneeling Hip Flexor",
    "Latissimus Dorsi-SMR", "Looking At Ceiling", "Lower Back Curl",
    "Lower Back-SMR", "Lying Bent Leg Groin", "Lying Crossover", "Lying Glute",
    "Lying Hamstring", "Lying Prone Quadriceps", "Neck-SMR",
    "One Arm Against Wall", "One Half Locust", "One Handed Hang",
    "One Knee To Chest", "Overhead Lat", "Overhead Triceps",
    "Pelvic Tilt Into Bridge", "Peroneals-SMR", "Piriformis-SMR", "Pyramid",
    "Quadriceps-SMR", "Rear Leg Raises", "Rhomboids-SMR", "Scissor Kick",
    "Seated Biceps", "Seated Front Deltoid", "Seated Glute", "Seated Hamstring",
    "Shoulder Circles", "Shoulder Raise", "Side Leg Raises", "Side Wrist Pull",
    "Sit Squats", "Split Squats", "Standing Hip Circles",
    "Standing Hip Flexors", "Standing Pelvic Tilt", "Standing Toe Touches",
    "Stomach Vacuum", "Superman", "The Straddle", "Toe Touchers",
    "Torso Rotation", "Upper Back-Leg Grab", "Windmills", "Wrist Circles",
  ].map((n) => n.toLowerCase()),
);

/**
 * Stretch / mobility classifier. The free-exercise-db catalog files these under
 * their target muscle group (e.g. "Hamstring Stretch" → Legs), so there's no DB
 * category to key on. Most are named "… Stretch"; the rest are matched by exact
 * name via MOBILITY_EXACT_NAMES above.
 */
export function isMobilityExercise(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("stretch") || MOBILITY_EXACT_NAMES.has(n);
}

/**
 * Isometric "hold" moves are logged in SECONDS, not reps (e.g. Dead Hang,
 * Plank, Wall Sit, L-Sit). Stretches also count as timed holds. Keyed on the
 * name since the catalog has no isometric flag.
 */
const HOLD_PATTERNS = [
  "hold",
  "hang",
  "plank",
  "wall sit",
  "l-sit",
  "hollow",
  "superman",
  "isometric",
  "bird dog",
  "dead bug",
];
export function isHoldExercise(name: string): boolean {
  const n = name.toLowerCase();
  return isMobilityExercise(name) || HOLD_PATTERNS.some((p) => n.includes(p));
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
