import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { getDislikedExerciseIds } from "./voteService";
import { geminiGenerateContent } from "./geminiGenerate";
import {
  buildGeminiAutoGeneratePrompt,
  sanitizeCoachingInstructions,
  type GeminiGeneratedPlan,
} from "./aiGenerator";
import type {
  Plan,
  PlanExercise,
  PlanWithExercises,
  PlanExerciseInput,
  CreatePlanBody,
  UpdatePlanBody,
  AutoGeneratePlansBody,
} from "../models";

// ── Input validation schema ───────────────────────────────────────────────────

const VALID_EXPERIENCE = ["beginner", "intermediate", "advanced"] as const;
const VALID_GOALS      = ["build_muscle", "lose_fat", "get_stronger"] as const;
const VALID_EQUIPMENT  = [
  "barbell", "full_gym",
  "dumbbell", "dumbbells_only",
  "bodyweight", "home_minimal",
  "kettlebell",
] as const;

const VALID_MUSCLE_GROUPS = ["chest", "back", "shoulders", "arms", "legs", "core"] as const;

const VALID_SPLIT_PREFERENCES = [
  "push-pull-legs",
  "upper-lower",
  "full-body",
  "bro-split",
] as const;

const autoGenerateSchema = z.object({
  frequency:    z.number({ invalid_type_error: "frequency must be a number" }).int().min(1).max(7),
  experience:   z.enum(VALID_EXPERIENCE, { message: "experience must be beginner | intermediate | advanced" }),
  goal:         z.enum(VALID_GOALS,      { message: "goal must be build_muscle | lose_fat | get_stronger" }),
  equipment:    z.enum(VALID_EQUIPMENT).optional().default("barbell"),
  focusMuscles: z.array(z.enum(VALID_MUSCLE_GROUPS)).optional().default([]),
  splitPreference: z.enum(VALID_SPLIT_PREFERENCES).optional(),
  goalText: z.string().trim().min(3).max(200).optional(),
});

/** Equipment categories that hold mobility / stretching / warm-up movements. */
const MOBILITY_EQUIPMENT = ["other", "bodyweight", "bands"] as const;

/**
 * Maps UI muscle group names (lowercase, from OnboardingContext MuscleGroup type)
 * to DB muscle_group column values (title-case, as stored in the exercises table).
 * A single UI selection can map to multiple DB groups (e.g. "arms" → Biceps + Triceps).
 */
const FOCUS_MUSCLE_DB_MAP: Record<string, string[]> = {
  chest:     ["Chest"],
  back:      ["Back"],
  shoulders: ["Shoulders"],
  arms:      ["Biceps", "Triceps"],
  legs:      ["Legs"],
  core:      ["Core"],
};

/**
 * Reorders a list of exercise names so that exercises whose DB muscle_group
 * matches one of the focused groups appear first.  Order within each bucket
 * (focused vs non-focused) is preserved to maintain template quality.
 *
 * Uses case-insensitive comparison as a safety net in case DB values differ
 * between seed versions.
 */
function prioritizeFocusedExercises(names: string[], focusMuscles: string[]): string[] {
  if (focusMuscles.length === 0) return names;

  const dbGroups = new Set(
    focusMuscles.flatMap((m) => (FOCUS_MUSCLE_DB_MAP[m] ?? []).map((g) => g.toLowerCase())),
  );

  const rows = db
    .prepare(
      `SELECT name, muscle_group FROM exercises WHERE name IN (${names.map(() => "?").join(",")})`,
    )
    .all(...names) as { name: string; muscle_group: string }[];

  const muscleByName = new Map(rows.map((r) => [r.name, r.muscle_group]));

  const focused: string[]    = [];
  const remaining: string[]  = [];
  for (const n of names) {
    const mg = (muscleByName.get(n) ?? "").toLowerCase();
    if (dbGroups.has(mg)) {
      focused.push(n);
    } else {
      remaining.push(n);
    }
  }
  return [...focused, ...remaining];
}

// ── Weekly volume targets (sets per muscle group per week) ────────────────────
//
// Derived from RP / NSCA practical ranges for natural lifters.
// These are targets to hit across the full weekly plan, not per session.
//
// Level        | MEV (Minimum) | Target range | MRV (Max recoverable)
// -------------|---------------|--------------|----------------------
// Beginner     | 8             | 8–12         | 14
// Intermediate | 10            | 12–20        | 22
// Advanced     | 12            | 16–24        | 26
//
// How the plan hits these targets:
//   Full Body 1–2x/week  → 1–2 sessions × ~4–5 sets/compound = 4–10 sets/muscle
//                           → Primary compound gets +1 set bonus to compensate (see below)
//   Full Body 3x/week    → 3 sessions × ~3 sets/compound = ~9 sets/muscle ✓ beginner
//   Upper/Lower 4x/week  → 2 upper sessions × ~3-4 sets + 2 lower × ~3 = ~12–16 ✓ int/adv
//   PPL 6x/week          → 2 sessions each split × ~4-5 compound sets = ~16–20 ✓ advanced

// ── Shared helper ────────────────────────────────────────────────────────────

function fetchPlanExercises(planId: number): PlanExercise[] {
  return db
    .prepare(
      `SELECT pe.*, e.name, e.muscle_group
       FROM plan_exercises pe
       JOIN exercises e ON e.id = pe.exercise_id
       WHERE pe.plan_id = ?
       ORDER BY pe.sort_order`,
    )
    .all(planId) as PlanExercise[];
}

// ── Public service functions ─────────────────────────────────────────────────

export function listPlans(userId: number): PlanWithExercises[] {
  const plans = db
    .prepare("SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as Plan[];
  return plans.map((p) => ({ ...p, exercises: fetchPlanExercises(p.id) }));
}

export function getPlan(id: number, userId: number): PlanWithExercises {
  // Strict ownership: legacy plans with NULL user_id are NOT accessible to any
  // authenticated user. Users can only see plans they explicitly own.
  const plan = db
    .prepare("SELECT * FROM plans WHERE id = ? AND user_id = ?")
    .get(id, userId) as Plan | undefined;
  if (!plan) throw new AppError(404, "Plan not found");
  return { ...plan, exercises: fetchPlanExercises(plan.id) };
}

export function createPlan(body: CreatePlanBody, userId?: number): PlanWithExercises {
  const { name, exercises } = body;
  if (!name) throw new AppError(400, "name required");

  const insertPlan = db.prepare("INSERT INTO plans (name, user_id) VALUES (?, ?)");
  const insertExercise = db.prepare(
    `INSERT INTO plan_exercises
       (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight, superset_group)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const planId = db.transaction(() => {
    const result = insertPlan.run(name, userId ?? null);
    const pid = result.lastInsertRowid as number;
    if (Array.isArray(exercises)) {
      exercises.forEach((ex: PlanExerciseInput, i: number) => {
        insertExercise.run(
          pid,
          ex.exercise_id,
          i,
          ex.default_sets ?? 3,
          ex.default_reps ?? 10,
          ex.default_weight ?? 0,
          ex.superset_group ?? null,
        );
      });
    }
    return pid;
  })();

  const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(planId) as Plan;
  return { ...plan, exercises: fetchPlanExercises(planId) };
}

/** Throws 404 if the plan doesn't exist or isn't strictly owned by this user. */
function assertOwnsPlan(id: number, userId: number): void {
  const row = db
    .prepare("SELECT 1 FROM plans WHERE id = ? AND user_id = ?")
    .get(id, userId) as { 1: number } | undefined;
  if (!row) throw new AppError(404, "Plan not found");
}

export function updatePlan(id: number, body: UpdatePlanBody, userId: number): PlanWithExercises {
  assertOwnsPlan(id, userId);

  const { name, exercises } = body;

  const insertExercise = db.prepare(
    `INSERT INTO plan_exercises
       (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight, superset_group)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    if (name) {
      // Defence-in-depth: include user_id in the WHERE clause so a TOCTOU
      // race between assertOwnsPlan and the UPDATE can't mutate someone else's plan.
      db.prepare("UPDATE plans SET name = ? WHERE id = ? AND user_id = ?").run(name, id, userId);
    }
    if (Array.isArray(exercises)) {
      db.prepare(
        `DELETE FROM plan_exercises
         WHERE plan_id = ? AND plan_id IN (SELECT id FROM plans WHERE user_id = ?)`,
      ).run(id, userId);
      exercises.forEach((ex: PlanExerciseInput, i: number) => {
        insertExercise.run(
          id,
          ex.exercise_id,
          i,
          ex.default_sets ?? 3,
          ex.default_reps ?? 10,
          ex.default_weight ?? 0,
          ex.superset_group ?? null,
        );
      });
    }
  })();

  const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(id) as Plan;
  return { ...plan, exercises: fetchPlanExercises(id) };
}

export function deletePlan(id: number, userId: number): void {
  assertOwnsPlan(id, userId);
  // user_id in the WHERE clause prevents a TOCTOU race from deleting another user's plan
  db.prepare("DELETE FROM plans WHERE id = ? AND user_id = ?").run(id, userId);
}

// ── Equipment constraint layer ───────────────────────────────────────────────

/**
 * Maps incoming equipment string → DB equipment column values that are
 * allowed in a generated plan.  Bodyweight is always included as a
 * universal fallback so core/mobility slots are never empty.
 */
const ALLOWED_EQUIPMENT: Record<string, string[]> = {
  barbell:    ["barbell", "dumbbell", "cable", "machine", "bodyweight"],
  dumbbell:   ["dumbbell", "bodyweight"],
  bodyweight: ["bodyweight"],
  kettlebell: ["kettlebell", "bodyweight"],
  // Aliases sent by some older clients
  full_gym:       ["barbell", "dumbbell", "cable", "machine", "bodyweight"],
  dumbbells_only: ["dumbbell", "bodyweight"],
  home_minimal:   ["dumbbell", "bodyweight"],
};

/**
 * Resolve an exercise name to a DB row that satisfies the equipment
 * constraint.  Resolution order:
 *   1. Exact name match with allowed equipment
 *   2. Dumbbell/bodyweight/KB swap map (see below)
 *   3. Any non-custom exercise for the same muscle group within allowed equip.
 *   4. null  →  slot is dropped (no disallowed exercises ever sneak in)
 */
function resolveExercise(
  name: string,
  allowedEquip: string[],
  dislikedIds: number[],
): { id: number; name: string; muscle_group: string } | null {
  const placeholders = allowedEquip.map(() => "?").join(",");

  // 1. Exact match
  const exact = db.prepare(
    `SELECT id, name, muscle_group FROM exercises
     WHERE name = ?
       AND equipment IN (${placeholders})
       AND id NOT IN (${dislikedIds.length ? dislikedIds.join(",") : "0"})`,
  ).get(name, ...allowedEquip) as { id: number; name: string; muscle_group: string } | undefined;
  if (exact) return exact;

  // 2. Swap maps
  const swapped = EQUIPMENT_SWAP[name];
  if (swapped) {
    for (const candidate of swapped) {
      const row = db.prepare(
        `SELECT id, name, muscle_group FROM exercises
         WHERE name = ?
           AND equipment IN (${placeholders})
           AND id NOT IN (${dislikedIds.length ? dislikedIds.join(",") : "0"})`,
      ).get(candidate, ...allowedEquip) as { id: number; name: string; muscle_group: string } | undefined;
      if (row) return row;
    }
  }

  // 3. Muscle-group fallback — look up original exercise's muscle group first
  const source = db.prepare("SELECT muscle_group FROM exercises WHERE name = ?").get(name) as
    | { muscle_group: string }
    | undefined;
  if (source) {
    const fallback = db.prepare(
      `SELECT id, name, muscle_group FROM exercises
       WHERE muscle_group = ?
         AND equipment IN (${placeholders})
         AND is_custom = 0
         AND id NOT IN (${dislikedIds.length ? dislikedIds.join(",") : "0"})
       ORDER BY RANDOM() LIMIT 1`,
    ).get(source.muscle_group, ...allowedEquip) as
      | { id: number; name: string; muscle_group: string }
      | undefined;
    if (fallback) return fallback;
  }

  // 4. No valid exercise exists for this slot → drop it
  return null;
}

/**
 * Fallback candidates for exercises that won't exist under restricted
 * equipment.  Each entry lists alternatives in preference order.
 *
 * Format: original name → [preferred alternative, secondary alternative, ...]
 */
const EQUIPMENT_SWAP: Record<string, string[]> = {
  // ── Barbell → dumbbell / KB / bodyweight ──────────────────────────────
  "Barbell Squat":         ["Goblet Squat",         "KB Goblet Squat",      "Reverse Lunges"],
  "Front Squat":           ["Goblet Squat",         "KB Goblet Squat"],
  "Barbell Bench Press":   ["Dumbbell Bench Press", "KB Floor Press",       "Push-Ups"],
  "Barbell Row":           ["Dumbbell Row",          "KB Row",               "Pull-Ups"],
  "Overhead Press":        ["Dumbbell Shoulder Press", "KB Press"],
  "Barbell Curl":          ["Dumbbell Curl",         "KB Curl",              "Chin-Ups"],
  "Barbell Shrug":         ["Dumbbell Shrug",        "KB Farmer's Walk"],
  "Romanian Deadlift":     ["Romanian Deadlift",     "KB Romanian Deadlift"],
  "Stiff Leg Deadlift":    ["Romanian Deadlift",     "KB Romanian Deadlift"],
  "Deadlift":              ["Romanian Deadlift",     "KB Romanian Deadlift", "Glute Bridge"],
  "Hip Thrust":            ["Glute Bridge",          "KB Swing"],
  // ── Cable / machine → dumbbell / KB / bodyweight ─────────────────────
  "Cable Flyes":           ["Dumbbell Flyes",        "KB Squeeze Press",     "Push-Ups"],
  "Tricep Pushdown":       ["Overhead Tricep Extension", "KB Overhead Tricep Extension", "Tricep Dips"],
  "Lat Pulldown":          ["Dumbbell Row",          "KB High Pull",         "Pull-Ups"],
  "Seated Cable Row":      ["Dumbbell Row",          "KB Renegade Row",      "Pull-Ups"],
  "Face Pull":             ["Rear Delt Fly",         "KB High Pull"],
  "Cable Lateral Raise":   ["Lateral Raise",         "KB Lateral Raise"],
  "Leg Press":             ["Goblet Squat",          "KB Goblet Squat",      "Reverse Lunges"],
  "Leg Curl":              ["Romanian Deadlift",     "KB Romanian Deadlift", "Glute Bridge"],
  "Seated Leg Curl":       ["Romanian Deadlift",     "KB Swing",             "Glute Bridge"],
  "Leg Extension":         ["Goblet Squat",          "KB Goblet Squat",      "Sissy Squat"],
  "Hack Squat":            ["Goblet Squat",          "KB Goblet Squat"],
  "Standing Calf Raise":   ["KB Calf Raise",         "Plank"],
  "Seated Calf Raise":     ["KB Calf Raise",         "Plank"],
  // ── Dumbbell → KB / bodyweight ─────────────────────────────────────────
  "Dumbbell Bench Press":  ["KB Floor Press",        "Push-Ups"],
  "Incline Dumbbell Press":["KB Squeeze Press",      "Push-Ups"],
  "Dumbbell Row":          ["KB Row",                "Pull-Ups"],
  "Dumbbell Shoulder Press":["KB Press"],
  "Lateral Raise":         ["KB Lateral Raise"],
  "Hammer Curl":           ["KB Hammer Curl",        "Chin-Ups"],
  "Overhead Tricep Extension":["KB Overhead Tricep Extension", "Tricep Dips"],
  "Bulgarian Split Squat": ["KB Bulgarian Split Squat", "Reverse Lunges"],
  "Goblet Squat":          ["KB Goblet Squat",       "Reverse Lunges"],
  "Walking Lunges":        ["KB Lunges",             "Reverse Lunges"],
  "Reverse Lunges":        ["KB Lunges",             "Reverse Lunges"],
  "Dumbbell Shrug":        ["KB Farmer's Walk"],
  // ── Pull-Ups (bodyweight) — already fine in all contexts ─────────────
  "Pull-Ups":              ["Pull-Ups",              "KB High Pull",         "Chin-Ups"],
  "Chin-Ups":              ["Chin-Ups",              "KB Curl"],
};

// ── Equipment-specific plan templates ────────────────────────────────────────
// Four canonical template sets; resolved at runtime against the DB so any
// missing names are caught and substituted by resolveExercise().

// Full Body A/B split rationale (Renaissance Periodization full-body templates):
// when training full-body 2×/week, repeating the same session burns recovery on
// the same patterns and leaves the antagonist patterns under-trained. We
// alternate by movement *pattern* (knee-dominant vs hip-dominant; horizontal
// vs vertical push/pull) so each pattern still hits MEV across the week while
// avoiding redundant sessions. The original `fullBody` is preserved as the
// 3-day single template (beginner SS-style); `fullBodyB` is the second session
// only generated when `frequency >= 2`.
const TEMPLATES_BARBELL = {
  fullBody:  ["Barbell Squat", "Romanian Deadlift", "Barbell Bench Press", "Barbell Row", "Overhead Press", "Plank"],
  fullBodyB: ["Romanian Deadlift", "Bulgarian Split Squat", "Overhead Press", "Pull-Ups", "Incline Dumbbell Press", "Hanging Leg Raise"],
  fullBodyC: ["Front Squat", "Stiff Leg Deadlift", "Dumbbell Bench Press", "Lat Pulldown", "Lateral Raise", "Cable Crunch"],
  upperA:    ["Barbell Bench Press", "Incline Dumbbell Press", "Barbell Row", "Lat Pulldown", "Overhead Press", "Barbell Curl", "Tricep Pushdown"],
  lowerA:    ["Barbell Squat", "Romanian Deadlift", "Leg Press", "Leg Curl", "Standing Calf Raise"],
  upperB:    ["Dumbbell Bench Press", "Cable Flyes", "Dumbbell Row", "Pull-Ups", "Dumbbell Shoulder Press", "Hammer Curl", "Overhead Tricep Extension"],
  lowerB:    ["Bulgarian Split Squat", "Stiff Leg Deadlift", "Hack Squat", "Seated Leg Curl", "Seated Calf Raise"],
  push:      ["Barbell Bench Press", "Incline Dumbbell Press", "Cable Flyes", "Overhead Press", "Lateral Raise", "Tricep Pushdown", "Overhead Tricep Extension"],
  pull:      ["Barbell Row", "Lat Pulldown", "Seated Cable Row", "Face Pull", "Barbell Curl", "Hammer Curl", "Barbell Shrug"],
  legs:      ["Barbell Squat", "Romanian Deadlift", "Leg Press", "Leg Extension", "Leg Curl", "Standing Calf Raise", "Plank"],
};

const TEMPLATES_DUMBBELL = {
  fullBody:  ["Goblet Squat", "Romanian Deadlift", "Dumbbell Bench Press", "Dumbbell Row", "Dumbbell Shoulder Press", "Plank"],
  fullBodyB: ["Romanian Deadlift", "Bulgarian Split Squat", "Dumbbell Shoulder Press", "Pull-Ups", "Incline Dumbbell Press", "Hanging Leg Raise"],
  fullBodyC: ["Bulgarian Split Squat", "Walking Lunges", "Incline Dumbbell Press", "Chest Supported Row", "Lateral Raise", "Dead Bug"],
  upperA:    ["Dumbbell Bench Press", "Incline Dumbbell Press", "Dumbbell Row", "Chest Supported Row", "Dumbbell Shoulder Press", "Dumbbell Curl", "Overhead Tricep Extension"],
  lowerA:    ["Goblet Squat", "Romanian Deadlift", "Bulgarian Split Squat", "Walking Lunges", "Glute Bridge"],
  upperB:    ["Incline Dumbbell Press", "Dumbbell Flyes", "Dumbbell Row", "Rear Delt Fly", "Lateral Raise", "Hammer Curl", "Overhead Tricep Extension"],
  lowerB:    ["Bulgarian Split Squat", "Romanian Deadlift", "Goblet Squat", "Walking Lunges", "Glute Bridge"],
  push:      ["Dumbbell Bench Press", "Incline Dumbbell Press", "Dumbbell Flyes", "Dumbbell Shoulder Press", "Lateral Raise", "Overhead Tricep Extension", "Tricep Kickback"],
  pull:      ["Dumbbell Row", "Chest Supported Row", "Rear Delt Fly", "Dumbbell Curl", "Hammer Curl", "Incline Dumbbell Curl", "Dumbbell Shrug"],
  legs:      ["Goblet Squat", "Romanian Deadlift", "Bulgarian Split Squat", "Walking Lunges", "Step Ups", "Glute Bridge", "Plank"],
};

const TEMPLATES_BODYWEIGHT = {
  fullBody:  ["Push-Ups", "Pull-Ups", "Reverse Lunges", "Glute Bridge", "Plank"],
  fullBodyB: ["Diamond Push-Ups", "Chin-Ups", "Sissy Squat", "Hyperextension", "Hanging Leg Raise"],
  fullBodyC: ["Pike Push-Ups", "Chin-Ups", "Bulgarian Split Squat", "Mountain Climbers", "Dead Bug"],
  upperA:    ["Push-Ups", "Pull-Ups", "Chest Dips", "Chin-Ups", "Tricep Dips", "Diamond Push-Ups"],
  lowerA:    ["Reverse Lunges", "Glute Bridge", "Sissy Squat", "Mountain Climbers", "Plank"],
  upperB:    ["Diamond Push-Ups", "Chin-Ups", "Tricep Dips", "Pull-Ups", "Push-Ups"],
  lowerB:    ["Reverse Lunges", "Glute Bridge", "Sissy Squat", "Dead Bug", "Plank"],
  push:      ["Push-Ups", "Chest Dips", "Diamond Push-Ups", "Tricep Dips", "Plank", "Mountain Climbers"],
  pull:      ["Pull-Ups", "Chin-Ups", "Hyperextension", "Hanging Leg Raise", "Dead Bug"],
  legs:      ["Reverse Lunges", "Glute Bridge", "Sissy Squat", "Mountain Climbers", "Dead Bug", "Plank"],
};

const TEMPLATES_KETTLEBELL = {
  fullBody:  ["KB Swing", "KB Push Press", "KB Romanian Deadlift", "KB Press", "KB High Pull"],
  fullBodyB: ["KB Goblet Squat", "KB Row", "KB Floor Press", "KB Renegade Row", "KB Curl"],
  fullBodyC: ["KB Bulgarian Split Squat", "KB Lunges", "KB Turkish Get-Up", "KB Halo", "KB Calf Raise"],
  upperA:    ["KB Floor Press", "KB Squeeze Press", "KB Row", "KB Renegade Row", "KB Press", "KB Curl", "KB Overhead Tricep Extension"],
  lowerA:    ["KB Goblet Squat", "KB Swing", "KB Romanian Deadlift", "KB Lunges", "KB Calf Raise"],
  upperB:    ["KB Squeeze Press", "KB Floor Press", "KB High Pull", "KB Renegade Row", "KB Lateral Raise", "KB Hammer Curl", "KB Skull Crusher"],
  lowerB:    ["KB Bulgarian Split Squat", "KB Romanian Deadlift", "KB Swing", "KB Goblet Squat", "KB Calf Raise"],
  push:      ["KB Floor Press", "KB Squeeze Press", "KB Press", "KB Push Press", "KB Lateral Raise", "KB Overhead Tricep Extension", "KB Skull Crusher"],
  pull:      ["KB Row", "KB Renegade Row", "KB High Pull", "KB Clean", "KB Curl", "KB Hammer Curl", "KB Farmer's Walk"],
  legs:      ["KB Goblet Squat", "KB Swing", "KB Romanian Deadlift", "KB Lunges", "KB Bulgarian Split Squat", "KB Calf Raise", "KB Turkish Get-Up"],
};

function selectTemplates(equipment: string) {
  switch (equipment) {
    case "dumbbell":
    case "dumbbells_only":
      return TEMPLATES_DUMBBELL;
    case "bodyweight":
    case "home_minimal":
      return TEMPLATES_BODYWEIGHT;
    case "kettlebell":
      return TEMPLATES_KETTLEBELL;
    default:
      return TEMPLATES_BARBELL;
  }
}

// ── Exercise tier classification ─────────────────────────────────────────────

/**
 * Classifies each named exercise as primary compound, secondary compound,
 * or isolation.  Used to assign different set/rep volumes per exercise.
 *
 * Primary compounds:   multi-joint, highest motor-unit recruitment, placed first
 * Secondary compounds: multi-joint but lower load or more assistance-focused
 * Isolation:           single-joint, placed last, capped at 3 sets
 */
const EXERCISE_TIER: Record<string, "primary" | "secondary" | "isolation"> = {
  // ── Primary compounds ──────────────────────────────────────────────────────
  "Barbell Squat":           "primary",
  "Deadlift":                "primary",
  "Barbell Bench Press":     "primary",
  "Barbell Row":             "primary",
  "Overhead Press":          "primary",
  "Romanian Deadlift":       "primary",
  "Pull-Ups":                "primary",
  "Chin-Ups":                "primary",
  "Goblet Squat":            "primary",
  "KB Goblet Squat":         "primary",
  "KB Swing":                "primary",
  "KB Turkish Get-Up":       "primary",
  "Push-Ups":                "primary",   // primary in bodyweight context
  "Dumbbell Row":            "primary",
  "Chest Dips":              "primary",

  // ── Secondary compounds ────────────────────────────────────────────────────
  "Incline Dumbbell Press":   "secondary",
  "Dumbbell Bench Press":     "secondary",
  "Bulgarian Split Squat":    "secondary",
  "KB Bulgarian Split Squat": "secondary",
  "Stiff Leg Deadlift":       "secondary",
  "Hack Squat":               "secondary",
  "Lat Pulldown":             "secondary",
  "Seated Cable Row":         "secondary",
  "Face Pull":                "secondary",
  "Dumbbell Shoulder Press":  "secondary",
  "Leg Press":                "secondary",
  "Walking Lunges":           "secondary",
  "Reverse Lunges":           "secondary",
  "Hip Thrust":               "secondary",
  "Glute Bridge":             "secondary",
  "Step Ups":                 "secondary",
  "Dumbbell Flyes":           "secondary",
  "Cable Flyes":              "secondary",
  "Hyperextension":           "secondary",
  "KB Floor Press":           "secondary",
  "KB Row":                   "secondary",
  "KB Press":                 "secondary",
  "KB Romanian Deadlift":     "secondary",
  "KB Lunges":                "secondary",
  "KB Renegade Row":          "secondary",
  "KB Push Press":            "secondary",
  "KB Clean":                 "secondary",
  "KB High Pull":             "secondary",
  "KB Squeeze Press":         "secondary",
  "Diamond Push-Ups":         "secondary",
  "Tricep Dips":              "secondary",
  "Sissy Squat":              "secondary",
  "Mountain Climbers":        "secondary",

  // ── Isolation ─────────────────────────────────────────────────────────────
  "Lateral Raise":               "isolation",
  "KB Lateral Raise":            "isolation",
  "Front Raise":                 "isolation",
  "Rear Delt Fly":               "isolation",
  "Barbell Curl":                "isolation",
  "Dumbbell Curl":               "isolation",
  "Hammer Curl":                 "isolation",
  "KB Curl":                     "isolation",
  "KB Hammer Curl":              "isolation",
  "Preacher Curl":               "isolation",
  "Incline Dumbbell Curl":       "isolation",
  "Concentration Curl":          "isolation",
  "Tricep Pushdown":             "isolation",
  "Overhead Tricep Extension":   "isolation",
  "KB Overhead Tricep Extension":"isolation",
  "Tricep Kickback":             "isolation",
  "KB Skull Crusher":            "isolation",
  "Leg Extension":               "isolation",
  "Leg Curl":                    "isolation",
  "Seated Leg Curl":             "isolation",
  "Standing Calf Raise":         "isolation",
  "Seated Calf Raise":           "isolation",
  "KB Calf Raise":               "isolation",
  "Barbell Shrug":               "isolation",
  "Dumbbell Shrug":              "isolation",
  "KB Farmer's Walk":            "isolation",
  "Plank":                       "isolation",
  "Side Plank":                  "isolation",
  "Russian Twist":               "isolation",
  "Hanging Leg Raise":           "isolation",
  "Cable Crunch":                "isolation",
  "Ab Wheel Rollout":            "isolation",
  "Dead Bug":                    "isolation",
  "Crunches":                    "isolation",
  "Sit-Ups":                     "isolation",
};

function classifyExercise(name: string): "primary" | "secondary" | "isolation" {
  return EXERCISE_TIER[name] ?? "secondary";
}

// ── Per-exercise-tier volume prescription ────────────────────────────────────

/**
 * Sets and reps by exercise tier, goal, experience, and weekly muscle frequency.
 *
 * Rules (NSCA / RP principles):
 * - Primary compounds drive the most adaptation → most sets, appropriate rep range
 * - Secondary compounds support primaries → moderate sets
 * - Isolation exercises have diminishing returns beyond 3 sets → hard cap at 3
 * - Strength goals: heavier loads, lower reps, more sets for compounds
 * - Muscle/hypertrophy: moderate loads, 8–12 rep range
 * - Fat loss: moderate loads, higher reps / shorter rest
 *
 * weeklyMuscleFreq adjusts for how often a muscle group is trained per week:
 * - When ≤1x/week (e.g. 1-day full body), primary compounds receive +1 set
 *   to compensate for less frequent stimulus and still hit weekly volume targets.
 */
function getExerciseSetsReps(
  tier: "primary" | "secondary" | "isolation",
  goal: string,
  experience: string,
  weeklyMuscleFreq = 2,
): { sets: number; reps: number } {
  const isStrength = goal === "get_stronger" || goal === "strength";
  const isMuscle   = goal === "build_muscle" || goal === "muscle";
  const isFat      = goal === "lose_fat";
  const adv = experience === "advanced";
  const beg = experience === "beginner";
  // +1 set bonus when muscle hits only once/week to still reach minimum weekly volume
  const freqBonus = weeklyMuscleFreq <= 1 ? 1 : 0;

  if (tier === "primary") {
    // Strength: 3–5 sets × low reps; clear progression across experience
    if (isStrength) return { sets: (beg ? 3 : adv ? 5 : 4) + freqBonus, reps: beg ? 5 : adv ? 3 : 5 };
    // Muscle: 3–4 sets × 8 reps; intermediate gets 4 sets (up from 3) —
    // enough to drive hypertrophy without overwhelming session capacity
    if (isMuscle)   return { sets: (beg ? 3 : adv ? 4 : 4) + freqBonus, reps: 8 };
    if (isFat)      return { sets: 3 + freqBonus,                        reps: 10 };
    /* fallback */  return { sets: (beg ? 2 : 3) + freqBonus,            reps: 12 };
  }

  if (tier === "secondary") {
    if (isStrength) return { sets: 3, reps: 8 };
    if (isMuscle)   return { sets: adv ? 4 : 3, reps: 10 };
    if (isFat)      return { sets: 3, reps: 12 };
    return { sets: beg ? 2 : 3, reps: 15 };
  }

  // Isolation — hard cap at 3 sets; higher reps for metabolic stimulus
  if (isStrength) return { sets: 3, reps: 10 };
  if (isMuscle)   return { sets: 3, reps: 12 };
  return { sets: 2, reps: 15 };
}

// ── Evidence-based split selection ───────────────────────────────────────────

/**
 * Exercises per session, scaled by both split type and experience.
 *
 * Full-body sessions keep a lower count because each slot is a multi-joint
 * compound covering multiple muscle groups — more exercises would just exceed
 * practical session length. Split sessions can support more exercises because
 * each targets a narrower muscle group with dedicated volume.
 *
 * Rule matrix:
 *   Split          | Beginner | Intermediate | Advanced
 *   ---------------|----------|--------------|----------
 *   Full Body      |    4     |      5       |    6
 *   Upper/Lower(F) |    5     |      6       |    7
 *   Upper/Lower    |    5     |      6       |    7
 *   Push/Pull/Legs |    5     |      6       |    7
 */
function getExerciseCount(experience: string, planShape: string): number {
  const table: Record<string, Record<string, number>> = {
    fullBody:       { beginner: 4, intermediate: 5, advanced: 6 },
    upperLowerFull: { beginner: 5, intermediate: 6, advanced: 7 },
    upperLower:     { beginner: 5, intermediate: 6, advanced: 7 },
    ppl:            { beginner: 5, intermediate: 6, advanced: 7 },
  };
  return table[planShape]?.[experience] ?? 6;
}

/**
 * Frequency × experience → training split.
 *
 * Rules:
 * 1-2 days: Full Body for everyone — insufficient frequency for split work.
 *
 * 3 days:   Beginners → Full Body 3×/week (practice the same compounds
 *             repeatedly; Starting Strength / GZCLP model).
 *           Intermediate/Advanced → Upper / Lower / Full Body rotation.
 *             Each muscle group is hit ~1.5× per week (better than PPL's 1×).
 *             Upper Mon: chest/back/shoulders/arms
 *             Lower Wed: quads/hamstrings/glutes/calves
 *             Full Fri:  full-body compounds revisit everything
 *           (PPL at 3 days gives only 1× weekly frequency per muscle group —
 *            less effective than the ULF structure for most lifters.)
 *
 * 4 days:   Upper / Lower for all — 2× weekly frequency per muscle group,
 *           solid for both intermediate and advanced.
 *
 * 5+ days:  Beginners → Upper / Lower (PPL is too many distinct patterns
 *             for someone still building movement competency).
 *           Intermediate/Advanced → Push / Pull / Legs (higher volume per
 *             session, appropriate for experienced lifters).
 */
type PlanShape = "fullBody" | "upperLowerFull" | "upperLower" | "ppl" | "broSplit";

function getPlanShape(
  frequency: number,
  experience: string,
): PlanShape {
  if (frequency <= 2) return "fullBody";
  if (frequency === 3) return experience === "beginner" ? "fullBody" : "upperLowerFull";
  if (frequency === 4) return "upperLower";
  // 5+ days
  return experience === "beginner" ? "upperLower" : "ppl";
}

function resolvePlanShape(
  splitPreference: string | undefined,
  frequency: number,
  experience: string,
): PlanShape {
  switch (splitPreference) {
    case "push-pull-legs":
      return "ppl";
    case "upper-lower":
      return frequency <= 3 ? "upperLowerFull" : "upperLower";
    case "full-body":
      return "fullBody";
    case "bro-split":
      return "broSplit";
    default:
      return getPlanShape(frequency, experience);
  }
}

/** Removes server plan rows with no exercises and no linked sessions (failed auto-generate). */
export function cleanupOrphanAutoGeneratePlans(userId: number | undefined): number {
  if (userId == null) return 0;
  const result = db.prepare(
    `DELETE FROM plans
     WHERE user_id = ?
       AND (local_plan_id IS NULL OR local_plan_id = '')
       AND id NOT IN (SELECT DISTINCT plan_id FROM sessions WHERE plan_id IS NOT NULL)
       AND id NOT IN (SELECT DISTINCT plan_id FROM plan_exercises)`,
  ).run(userId);
  return result.changes;
}

function deletePlansByIds(planIds: number[]): void {
  if (planIds.length === 0) return;
  const placeholders = planIds.map(() => "?").join(",");
  db.prepare(`DELETE FROM plans WHERE id IN (${placeholders})`).run(...planIds);
}

// ── Auto-generate plans ──────────────────────────────────────────────────────

type PlanSessionSpec = { name: string; exerciseNames: string[] };

type AutoGenRuntime = {
  parsed: z.infer<typeof autoGenerateSchema>;
  planShape: PlanShape;
  exerciseCount: number;
  weeklyMuscleFreq: number;
  allowedEquip: string[];
  dislikedIds: number[];
  tpl: ReturnType<typeof selectTemplates>;
  prefix: string;
  maxSessionSets: number;
  userId?: number;
};

function makeAutoGenRuntime(
  body: AutoGeneratePlansBody,
  userId?: number,
  deviceId?: string,
): AutoGenRuntime {
  const parsed = autoGenerateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join("; ");
    throw new AppError(400, msg);
  }
  const { frequency, experience, goal, equipment, focusMuscles, splitPreference, goalText } =
    parsed.data;
  const planShape = resolvePlanShape(splitPreference, frequency, experience);
  const exerciseCount = getExerciseCount(experience, planShape);
  const weeklyMuscleFreq =
    planShape === "fullBody" ? Math.min(frequency, 3) : 2;
  const baseEquip = ALLOWED_EQUIPMENT[equipment] ?? ALLOWED_EQUIPMENT["barbell"];
  // Free-text goals (e.g. "improve hip mobility") need mobility/stretch moves,
  // which live under other/bodyweight/bands equipment. Broaden the allow-list so
  // those exercises survive the whitelist AND the resolveExercise equipment
  // filter downstream. Structured onboarding generation is untouched (no goalText).
  const allowedEquip = goalText
    ? [...new Set([...baseEquip, ...MOBILITY_EQUIPMENT])]
    : baseEquip;
  const dislikedIds = deviceId ? getDislikedExerciseIds(deviceId) : [];
  const tpl = selectTemplates(equipment);
  const prefix = equipment === "kettlebell" ? "KB " : "";
  const maxSessionSets =
    experience === "beginner" ? 14 : experience === "advanced" ? 25 : 21;
  return {
    parsed: { frequency, experience, goal, equipment, focusMuscles, splitPreference, goalText },
    planShape,
    exerciseCount,
    weeklyMuscleFreq,
    allowedEquip,
    dislikedIds,
    tpl,
    prefix,
    maxSessionSets,
    userId,
  };
}

function normalizeExerciseKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

type TemplatePools = AutoGenRuntime["tpl"];

/**
 * Multi-day full-body splits: ensure no exercise repeats across Day A / B / C.
 */
function enforceSplitDayVariation(
  sessions: PlanSessionSpec[],
  tpl: TemplatePools,
): PlanSessionSpec[] {
  const fbIndices: number[] = [];
  sessions.forEach((s, i) => {
    if (/full body/i.test(s.name)) fbIndices.push(i);
  });
  if (fbIndices.length < 2) return sessions;

  const pools: string[][] = [tpl.fullBody, tpl.fullBodyB, tpl.fullBodyC].filter(
    (p): p is string[] => Array.isArray(p) && p.length > 0,
  );
  if (pools.length < 2) return sessions;

  const globalUsed = new Set<string>();
  const result = sessions.map((s) => ({
    name: s.name,
    exerciseNames: [...s.exerciseNames],
  }));

  for (let fbOrdinal = 0; fbOrdinal < fbIndices.length; fbOrdinal++) {
    const sessionIdx = fbIndices[fbOrdinal];
    const pool = pools[fbOrdinal % pools.length] ?? pools[0];
    const session = result[sessionIdx];
    const next: string[] = [];

    for (const name of session.exerciseNames) {
      const key = normalizeExerciseKey(name);
      if (!globalUsed.has(key)) {
        next.push(name);
        globalUsed.add(key);
        continue;
      }
      const replacement = pool.find(
        (c) => !globalUsed.has(normalizeExerciseKey(c)),
      );
      if (replacement) {
        next.push(replacement);
        globalUsed.add(normalizeExerciseKey(replacement));
      }
    }

    if (next.length >= 4) {
      result[sessionIdx] = { name: session.name, exerciseNames: next };
    } else {
      const fresh = pool.filter((c) => !globalUsed.has(normalizeExerciseKey(c)));
      const names = fresh.length >= 4 ? fresh : pool;
      result[sessionIdx] = { name: session.name, exerciseNames: [...names] };
      for (const n of names) globalUsed.add(normalizeExerciseKey(n));
    }
  }

  return result;
}

function getBroSplitSessions(rt: AutoGenRuntime): PlanSessionSpec[] {
  const { tpl, prefix, parsed } = rt;
  const broDays: PlanSessionSpec[] = [
    {
      name: `${prefix}Chest`,
      exerciseNames: tpl.push.slice(0, 5),
    },
    {
      name: `${prefix}Back`,
      exerciseNames: tpl.pull.slice(0, 6),
    },
    {
      name: `${prefix}Shoulders`,
      exerciseNames: [
        tpl.push[3],
        tpl.push[4],
        tpl.pull[3],
        ...tpl.push.slice(5, 7),
      ].filter(Boolean),
    },
    {
      name: `${prefix}Arms`,
      exerciseNames: [
        ...tpl.pull.slice(4, 7),
        ...tpl.push.slice(5, 7),
      ].filter(Boolean),
    },
    {
      name: `${prefix}Legs`,
      exerciseNames: [...tpl.legs],
    },
  ];
  const sessions: PlanSessionSpec[] = [];
  for (let i = 0; i < parsed.frequency; i++) {
    sessions.push(broDays[i % broDays.length]);
  }
  return sessions;
}

function getDefaultPlanSessions(rt: AutoGenRuntime): PlanSessionSpec[] {
  const { parsed, planShape, tpl, prefix } = rt;
  const { frequency } = parsed;
  if (planShape === "broSplit") {
    return getBroSplitSessions(rt);
  }
  if (planShape === "fullBody") {
    if (frequency >= 3 && tpl.fullBodyC) {
      return [
        { name: `${prefix}Full Body A`, exerciseNames: [...tpl.fullBody] },
        { name: `${prefix}Full Body B`, exerciseNames: [...tpl.fullBodyB] },
        { name: `${prefix}Full Body C`, exerciseNames: [...tpl.fullBodyC] },
      ];
    }
    if (frequency >= 2 && tpl.fullBodyB) {
      return [
        { name: `${prefix}Full Body A`, exerciseNames: [...tpl.fullBody] },
        { name: `${prefix}Full Body B`, exerciseNames: [...tpl.fullBodyB] },
      ];
    }
    return [{ name: `${prefix}Full Body`, exerciseNames: [...tpl.fullBody] }];
  }
  if (planShape === "upperLowerFull") {
    return [
      { name: `${prefix}Upper`, exerciseNames: [...tpl.upperA] },
      { name: `${prefix}Lower`, exerciseNames: [...tpl.lowerA] },
      { name: `${prefix}Full Body`, exerciseNames: [...tpl.fullBody] },
    ];
  }
  if (planShape === "upperLower") {
    return [
      { name: `${prefix}Upper A`, exerciseNames: [...tpl.upperA] },
      { name: `${prefix}Lower A`, exerciseNames: [...tpl.lowerA] },
      { name: `${prefix}Upper B`, exerciseNames: [...tpl.upperB] },
      { name: `${prefix}Lower B`, exerciseNames: [...tpl.lowerB] },
    ];
  }
  return [
    { name: `${prefix}Push`, exerciseNames: [...tpl.push] },
    { name: `${prefix}Pull`, exerciseNames: [...tpl.pull] },
    { name: `${prefix}Legs`, exerciseNames: [...tpl.legs] },
  ];
}

function persistAutoGeneratedPlans(rt: AutoGenRuntime, sessions: PlanSessionSpec[]): number[] {
  const normalizedSessions = enforceSplitDayVariation(sessions, rt.tpl);
  const { exerciseCount, weeklyMuscleFreq, allowedEquip, dislikedIds, maxSessionSets, userId } = rt;
  const { goal, experience, focusMuscles } = rt.parsed;

  const buildExercises = (names: string[]) => {
    const seen = new Set<number>();
    const rows: { id: number; sortOrder: number; sets: number; reps: number }[] = [];
    let totalSets = 0;
    for (const name of names.slice(0, exerciseCount + 6)) {
      if (rows.length >= exerciseCount) break;
      const resolved = resolveExercise(name, allowedEquip, dislikedIds);
      if (!resolved || seen.has(resolved.id)) continue;
      const tier = classifyExercise(name);
      const { sets, reps } = getExerciseSetsReps(tier, goal, experience, weeklyMuscleFreq);
      if (totalSets + sets > maxSessionSets) continue;
      seen.add(resolved.id);
      totalSets += sets;
      rows.push({ id: resolved.id, sortOrder: rows.length, sets, reps });
    }
    return rows;
  };

  const insertPlan = db.prepare("INSERT INTO plans (name, user_id) VALUES (?, ?)");
  const insertPE = db.prepare(
    `INSERT INTO plan_exercises
       (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const createdPlans: number[] = [];
  try {
    db.transaction(() => {
      for (const session of normalizedSessions) {
        const pid = insertPlan.run(session.name, userId ?? null).lastInsertRowid as number;
        const ordered = prioritizeFocusedExercises(session.exerciseNames, focusMuscles);
        const built = buildExercises(ordered);
        if (built.length === 0) {
          throw new AppError(500, `No exercises resolved for session ${session.name}`);
        }
        for (const ex of built) {
          insertPE.run(pid, ex.id, ex.sortOrder, ex.sets, ex.reps, 0);
        }
        createdPlans.push(pid);
      }
    })();
    return createdPlans;
  } catch (err) {
    deletePlansByIds(createdPlans);
    throw err;
  }
}

export function autoGeneratePlans(body: AutoGeneratePlansBody, userId?: number, deviceId?: string): { planIds: number[] } {
  cleanupOrphanAutoGeneratePlans(userId);
  const rt = makeAutoGenRuntime(body, userId, deviceId);
  return { planIds: persistAutoGeneratedPlans(rt, getDefaultPlanSessions(rt)) };
}

function getExerciseNameWhitelist(allowedEquip: string[]): Map<string, string> {
  const placeholders = allowedEquip.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT name FROM exercises WHERE equipment IN (${placeholders}) AND is_custom = 0`,
    )
    .all(...allowedEquip) as { name: string }[];
  const m = new Map<string, string>();
  for (const r of rows) {
    m.set(r.name.toLowerCase().trim(), r.name);
  }
  return m;
}

function extractJsonFromModelText(text: string): unknown {
  let t = text.trim();
  const fence = /```(?:json)?\s*\n?([\s\S]*?)```/im;
  const m = fence.exec(t);
  if (m) t = m[1].trim();
  return JSON.parse(t);
}

type RawGeminiExerciseRow = {
  name?: unknown;
  sets?: unknown;
  reps?: unknown;
  weight?: unknown;
  instructions?: unknown;
  notes?: unknown;
};

/**
 * Parses and validates Gemini's full plan JSON. Returns null if structure,
 * whitelist mapping, or per-day exercise counts are invalid.
 */
function parseGeminiGeneratedPlan(
  data: unknown,
  rt: AutoGenRuntime,
  whitelist: Map<string, string>,
  expectedSessions: PlanSessionSpec[],
): GeminiGeneratedPlan | null {
  const root = data as { planName?: unknown; days?: unknown[] };
  if (!root?.days || !Array.isArray(root.days)) return null;
  if (root.days.length !== expectedSessions.length) return null;

  const globalUsed = new Set<string>();
  const days: GeminiGeneratedPlan["days"] = [];

  for (let i = 0; i < root.days.length; i++) {
    const rawDay = root.days[i] as { dayName?: unknown; exercises?: unknown[] };
    const rawExercises = Array.isArray(rawDay?.exercises) ? rawDay.exercises : [];
    const exercises: GeminiGeneratedPlan["days"][0]["exercises"] = [];

    for (const raw of rawExercises as RawGeminiExerciseRow[]) {
      const canon = whitelist.get(String(raw?.name ?? "").toLowerCase().trim());
      if (!canon) continue;

      const key = normalizeExerciseKey(canon);
      if (globalUsed.has(key)) continue;

      const sets = Math.round(Number(raw.sets));
      const reps = Math.round(Number(raw.reps));
      if (!Number.isFinite(sets) || sets < 1 || sets > 10) continue;
      if (!Number.isFinite(reps) || reps < 1 || reps > 120) continue;

      let weight = Number(raw.weight ?? 0);
      if (!Number.isFinite(weight) || weight < 0) weight = 0;
      if (rt.parsed.equipment === "bodyweight") weight = 0;

      const instrRaw = raw.instructions ?? raw.notes;
      const instructions =
        typeof instrRaw === "string" ? sanitizeCoachingInstructions(instrRaw) : "";

      globalUsed.add(key);
      exercises.push({ name: canon, sets, reps, weight, instructions });
    }

    if (exercises.length < 4) return null;

    const dayName =
      String(rawDay?.dayName ?? "").trim() || expectedSessions[i].name;
    days.push({ dayName, exercises });
  }

  const planName =
    String(root.planName ?? "").trim() || "Generated Workout Plan";

  return { planName, days };
}

/** Persists Gemini's full plan using model-provided sets/reps (no getExerciseSetsReps). */
function persistStructuredGeminiPlan(
  rt: AutoGenRuntime,
  plan: GeminiGeneratedPlan,
): number[] {
  const { allowedEquip, dislikedIds, maxSessionSets, userId } = rt;

  const insertPlan = db.prepare("INSERT INTO plans (name, user_id) VALUES (?, ?)");
  const insertPE = db.prepare(
    `INSERT INTO plan_exercises
       (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const createdPlans: number[] = [];

  try {
    db.transaction(() => {
      for (const day of plan.days) {
        const pid = insertPlan.run(day.dayName, userId ?? null).lastInsertRowid as number;
        let totalSets = 0;
        let sortOrder = 0;
        const seen = new Set<number>();
        let inserted = 0;

        for (const ex of day.exercises) {
          const resolved = resolveExercise(ex.name, allowedEquip, dislikedIds);
          if (!resolved || seen.has(resolved.id)) continue;

          if (totalSets + ex.sets > maxSessionSets) continue;

          seen.add(resolved.id);
          totalSets += ex.sets;
          insertPE.run(
            pid,
            resolved.id,
            sortOrder++,
            ex.sets,
            ex.reps,
            rt.parsed.equipment === "bodyweight" ? 0 : ex.weight,
          );
          inserted += 1;
        }

        if (inserted === 0) {
          throw new AppError(500, `Gemini day ${day.dayName} produced no catalog exercises`);
        }
        createdPlans.push(pid);
      }
    })();
    return createdPlans;
  } catch (err) {
    deletePlansByIds(createdPlans);
    throw err;
  }
}

/**
 * When `GEMINI_API_KEY` is set, asks Gemini for the complete structured plan JSON,
 * then persists sets/reps/weight from the model (not local tier tables).
 * Returns `null` on any failure so callers can fall back to `autoGeneratePlans`.
 */
async function callClaudeGeneratePlan(prompt: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Empty Claude response");
  return textBlock.text;
}

/**
 * Runs the AI plan generator: Claude (primary) → Gemini (fallback), matching
 * the rest of the app (import, modify, coach). Previously this path was
 * Gemini-only, so it silently failed whenever Gemini credits ran out even
 * though Anthropic — the primary provider — had capacity.
 */
async function generatePlanText(prompt: string): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    try {
      return await callClaudeGeneratePlan(prompt);
    } catch (e) {
      if (!process.env.GEMINI_API_KEY?.trim()) throw e;
      console.warn(
        "[autoGenerate] Claude failed, trying Gemini fallback:",
        e instanceof Error ? e.message : e,
      );
    }
  }
  return geminiGenerateContent([{ text: prompt }], { grounding: true });
}

export async function tryAutoGeneratePlansWithAi(
  body: AutoGeneratePlansBody,
  userId?: number,
  deviceId?: string,
): Promise<{ planIds: number[] } | null> {
  // Deterministic template path in Vitest; avoids flaky overlap assertions when a real API key is present.
  if (process.env.VITEST === "true") return null;
  if (!process.env.ANTHROPIC_API_KEY?.trim() && !process.env.GEMINI_API_KEY?.trim()) return null;
  cleanupOrphanAutoGeneratePlans(userId);
  let rt: AutoGenRuntime;
  try {
    rt = makeAutoGenRuntime(body, userId, deviceId);
  } catch {
    return null;
  }
  const defaultSessions = getDefaultPlanSessions(rt);
  const whitelist = getExerciseNameWhitelist(rt.allowedEquip);
  if (whitelist.size < 12) return null;

  const whitelistLines = [...whitelist.values()].sort().join("\n");

  const prompt = buildGeminiAutoGeneratePrompt({
    frequency: rt.parsed.frequency,
    experience: rt.parsed.experience,
    goal: rt.parsed.goal,
    equipment: rt.parsed.equipment,
    focusMuscles: rt.parsed.focusMuscles,
    splitPreference: rt.parsed.splitPreference,
    goalText: rt.parsed.goalText,
    sessionLines: defaultSessions.map((s, idx) => `${idx + 1}. ${s.name}`).join("\n"),
    whitelistLines,
    sessionCount: defaultSessions.length,
  });

  try {
    const text = await generatePlanText(prompt);
    const data = extractJsonFromModelText(text);
    const structured = parseGeminiGeneratedPlan(data, rt, whitelist, defaultSessions);
    if (!structured) {
      console.warn("[tryAutoGeneratePlansWithAi] model output failed validation (day count or <4 matched exercises per day)");
      return null;
    }
    return { planIds: persistStructuredGeminiPlan(rt, structured) };
  } catch (e) {
    console.warn("[tryAutoGeneratePlansWithAi]", e instanceof Error ? e.message : e);
    return null;
  }
}
