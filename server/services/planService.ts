import db from "../db";
import { AppError } from "../middleware/errorHandler";
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
    : (db.prepare("SELECT * FROM plans ORDER BY created_at DESC").all() as Plan[]);
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

// ── Auto-generate plans ──────────────────────────────────────────────────────

const KB_SWAP: Record<string, string> = {
  "Barbell Squat": "KB Goblet Squat",
  "Front Squat": "KB Goblet Squat",
  "Romanian Deadlift": "KB Romanian Deadlift",
  "Stiff Leg Deadlift": "KB Romanian Deadlift",
  "Barbell Bench Press": "KB Floor Press",
  "Dumbbell Bench Press": "KB Floor Press",
  "Incline Dumbbell Press": "KB Squeeze Press",
  "Barbell Row": "KB Row",
  "Dumbbell Row": "KB Row",
  "Overhead Press": "KB Press",
  "Dumbbell Shoulder Press": "KB Press",
  "Lateral Raise": "KB Lateral Raise",
  "Barbell Curl": "KB Curl",
  "Hammer Curl": "KB Hammer Curl",
  "Tricep Pushdown": "KB Overhead Tricep Extension",
  "Overhead Tricep Extension": "KB Overhead Tricep Extension",
  "Cable Flyes": "KB Squeeze Press",
  "Bulgarian Split Squat": "KB Bulgarian Split Squat",
  "Barbell Shrug": "KB Farmer's Walk",
  "Leg Press": "KB Lunges",
  "Leg Curl": "KB Swing",
  "Leg Extension": "KB Goblet Squat",
  "Hack Squat": "KB Goblet Squat",
  "Seated Leg Curl": "KB Swing",
  "Standing Calf Raise": "KB Calf Raise",
  "Seated Calf Raise": "KB Calf Raise",
  "Face Pull": "KB High Pull",
  "Lat Pulldown": "KB Row",
  "Seated Cable Row": "KB Renegade Row",
  "Pull-Ups": "KB High Pull",
};

export function autoGeneratePlans(body: AutoGeneratePlansBody, userId?: number): { planIds: number[] } {
  const { frequency, experience, goal, equipment } = body;
  if (!frequency || !experience || !goal) {
    throw new AppError(400, "frequency, experience, goal required");
  }

  const setsReps =
    goal === "strength"
      ? { sets: 4, reps: 5 }
      : goal === "muscle"
        ? { sets: 3, reps: 10 }
        : { sets: 3, reps: 13 };

  const useKB = equipment === "kettlebell";

  const findExercise = (name: string): { id: number } | undefined => {
    const resolved = useKB && KB_SWAP[name] ? KB_SWAP[name] : name;
    return db.prepare("SELECT id FROM exercises WHERE name = ?").get(resolved) as
      | { id: number }
      | undefined;
  };

  const buildPlanExercises = (names: string[]) => {
    const seen = new Set<number>();
    return names
      .map((n, i) => {
        const ex = findExercise(n);
        if (!ex || seen.has(ex.id)) return null;
        seen.add(ex.id);
        return {
          exercise_id: ex.id,
          sort_order: i,
          default_sets: setsReps.sets,
          default_reps: setsReps.reps,
          default_weight: 0,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  };

  const insertPlan = db.prepare("INSERT INTO plans (name, user_id) VALUES (?, ?)");
  const insertPE = db.prepare(
    `INSERT INTO plan_exercises
       (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const prefix = useKB ? "KB " : "";
  const createdPlans: number[] = [];

  db.transaction(() => {
    const addPlan = (name: string, exerciseNames: string[]) => {
      const pid = insertPlan.run(`${prefix}${name}`, userId ?? null).lastInsertRowid as number;
      for (const ex of buildPlanExercises(exerciseNames)) {
        insertPE.run(pid, ex.exercise_id, ex.sort_order, ex.default_sets, ex.default_reps, ex.default_weight);
      }
      createdPlans.push(pid);
    };

    if (frequency <= 3) {
      addPlan("Full Body", [
        "Barbell Squat", "Romanian Deadlift", "Barbell Bench Press",
        "Barbell Row", "Overhead Press", "Plank",
      ]);
    } else if (frequency === 4) {
      addPlan("Upper A", [
        "Barbell Bench Press", "Incline Dumbbell Press", "Barbell Row",
        "Lat Pulldown", "Overhead Press", "Barbell Curl", "Tricep Pushdown",
      ]);
      addPlan("Lower A", [
        "Barbell Squat", "Romanian Deadlift", "Leg Press",
        "Leg Curl", "Standing Calf Raise",
      ]);
      addPlan("Upper B", [
        "Dumbbell Bench Press", "Cable Flyes", "Dumbbell Row",
        "Pull-Ups", "Dumbbell Shoulder Press", "Hammer Curl", "Overhead Tricep Extension",
      ]);
      addPlan("Lower B", [
        "Bulgarian Split Squat", "Stiff Leg Deadlift", "Hack Squat",
        "Seated Leg Curl", "Seated Calf Raise",
      ]);
    } else {
      addPlan("Push", [
        "Barbell Bench Press", "Incline Dumbbell Press", "Cable Flyes",
        "Overhead Press", "Lateral Raise", "Tricep Pushdown", "Overhead Tricep Extension",
      ]);
      addPlan("Pull", [
        "Barbell Row", "Lat Pulldown", "Seated Cable Row",
        "Face Pull", "Barbell Curl", "Hammer Curl", "Barbell Shrug",
      ]);
      addPlan("Legs", [
        "Barbell Squat", "Romanian Deadlift", "Leg Press",
        "Leg Extension", "Leg Curl", "Standing Calf Raise", "Plank",
      ]);
    }
  })();

  return { planIds: createdPlans };
}
