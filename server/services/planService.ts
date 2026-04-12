import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { getDislikedExerciseIds } from "./voteService";
import type {
  Plan,
  PlanExercise,
  PlanWithExercises,
  PlanExerciseInput,
  CreatePlanBody,
  UpdatePlanBody,
  AutoGeneratePlansBody,
} from "../models";

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

export function listPlans(userId?: number): PlanWithExercises[] {
  const plans = userId
    ? (db.prepare("SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Plan[])
    : (db.prepare("SELECT * FROM plans WHERE user_id IS NULL ORDER BY created_at DESC").all() as Plan[]);
  return plans.map((p) => ({ ...p, exercises: fetchPlanExercises(p.id) }));
}

export function getPlan(id: number, userId?: number): PlanWithExercises {
  const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(id) as Plan | undefined;
  if (!plan) throw new AppError(404, "Plan not found");
  if (userId !== undefined && plan.user_id !== null && plan.user_id !== userId) {
    throw new AppError(403, "Access denied");
  }
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

export function updatePlan(id: number, body: UpdatePlanBody): PlanWithExercises {
  const { name, exercises } = body;

  const insertExercise = db.prepare(
    `INSERT INTO plan_exercises
       (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight, superset_group)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  db.transaction(() => {
    if (name) {
      db.prepare("UPDATE plans SET name = ? WHERE id = ?").run(name, id);
    }
    if (Array.isArray(exercises)) {
      db.prepare("DELETE FROM plan_exercises WHERE plan_id = ?").run(id);
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

export function deletePlan(id: number): void {
  db.prepare("DELETE FROM plans WHERE id = ?").run(id);
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

const TEMPLATES_BARBELL = {
  fullBody:  ["Barbell Squat", "Romanian Deadlift", "Barbell Bench Press", "Barbell Row", "Overhead Press", "Plank"],
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
  upperA:    ["Push-Ups", "Pull-Ups", "Chest Dips", "Chin-Ups", "Tricep Dips", "Diamond Push-Ups"],
  lowerA:    ["Reverse Lunges", "Glute Bridge", "Sissy Squat", "Mountain Climbers", "Plank"],
  upperB:    ["Diamond Push-Ups", "Chin-Ups", "Tricep Dips", "Pull-Ups", "Push-Ups"],
  lowerB:    ["Reverse Lunges", "Glute Bridge", "Sissy Squat", "Dead Bug", "Plank"],
  push:      ["Push-Ups", "Chest Dips", "Diamond Push-Ups", "Tricep Dips", "Plank", "Mountain Climbers"],
  pull:      ["Pull-Ups", "Chin-Ups", "Hyperextension", "Hanging Leg Raise", "Dead Bug"],
  legs:      ["Reverse Lunges", "Glute Bridge", "Sissy Squat", "Mountain Climbers", "Dead Bug", "Plank"],
};

const TEMPLATES_KETTLEBELL = {
  fullBody:  ["KB Goblet Squat", "KB Swing", "KB Floor Press", "KB Row", "KB Turkish Get-Up"],
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

// ── Auto-generate plans ──────────────────────────────────────────────────────

export function autoGeneratePlans(body: AutoGeneratePlansBody, userId?: number, deviceId?: string): { planIds: number[] } {
  const { frequency, experience, goal, equipment = "barbell" } = body;
  if (!frequency || !experience || !goal) {
    throw new AppError(400, "frequency, experience, goal required");
  }

  const setsReps =
    goal === "strength"
      ? { sets: 4, reps: 5 }
      : goal === "muscle"
        ? { sets: 3, reps: 10 }
        : { sets: 3, reps: 13 };

  const allowedEquip = ALLOWED_EQUIPMENT[equipment] ?? ALLOWED_EQUIPMENT["barbell"];
  const dislikedIds = deviceId ? getDislikedExerciseIds(deviceId) : [];
  const tpl = selectTemplates(equipment);

  // Prefix for plan names
  const prefix = equipment === "kettlebell" ? "KB " : "";

  const insertPlan = db.prepare("INSERT INTO plans (name, user_id) VALUES (?, ?)");
  const insertPE = db.prepare(
    `INSERT INTO plan_exercises
       (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const createdPlans: number[] = [];

  /**
   * Build plan exercises from a name list, resolving each name against the
   * equipment constraint.  Duplicates and disliked exercises are dropped.
   * If resolveExercise returns null the slot is silently skipped — no invalid
   * exercise is ever inserted.
   */
  const buildExercises = (names: string[]) => {
    const seen = new Set<number>();
    const rows: { id: number; sortOrder: number }[] = [];
    names.forEach((name, i) => {
      const resolved = resolveExercise(name, allowedEquip, dislikedIds);
      if (!resolved || seen.has(resolved.id)) return;
      seen.add(resolved.id);
      rows.push({ id: resolved.id, sortOrder: i });
    });
    return rows;
  };

  db.transaction(() => {
    const addPlan = (name: string, exerciseNames: string[]) => {
      const pid = insertPlan.run(`${prefix}${name}`, userId ?? null).lastInsertRowid as number;
      for (const ex of buildExercises(exerciseNames)) {
        insertPE.run(pid, ex.id, ex.sortOrder, setsReps.sets, setsReps.reps, 0);
      }
      createdPlans.push(pid);
    };

    if (frequency <= 3) {
      addPlan("Full Body", tpl.fullBody);
    } else if (frequency === 4) {
      addPlan("Upper A", tpl.upperA);
      addPlan("Lower A", tpl.lowerA);
      addPlan("Upper B", tpl.upperB);
      addPlan("Lower B", tpl.lowerB);
    } else {
      addPlan("Push", tpl.push);
      addPlan("Pull", tpl.pull);
      addPlan("Legs", tpl.legs);
    }
  })();

  return { planIds: createdPlans };
}
