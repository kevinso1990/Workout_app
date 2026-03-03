import type { Express, Request, Response } from "express";
import db from "./db";
// @ts-ignore
import webpush from "web-push";

const MUSCLEWIKI_BASE = "https://musclewiki.com/newapi/exercise/exercises/";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:workoutapp@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

const EXERCISE_MUSCLE_MAP: Record<string, { primary: string[]; secondary: string[] }> = {
  "Barbell Bench Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Incline Barbell Bench Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Decline Barbell Bench Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Dumbbell Bench Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Incline Dumbbell Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Dumbbell Flyes": { primary: ["Chest"], secondary: [] },
  "Cable Flyes": { primary: ["Chest"], secondary: [] },
  "Machine Chest Press": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Pec Deck": { primary: ["Chest"], secondary: [] },
  "Push-Ups": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Chest Dips": { primary: ["Chest"], secondary: ["Triceps", "Shoulders"] },
  "Landmine Press": { primary: ["Chest"], secondary: ["Shoulders"] },
  "KB Floor Press": { primary: ["Chest"], secondary: ["Triceps"] },
  "KB Squeeze Press": { primary: ["Chest"], secondary: ["Triceps"] },

  "Barbell Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Dumbbell Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Pendlay Row": { primary: ["Back"], secondary: ["Biceps"] },
  "T-Bar Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Seated Cable Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Lat Pulldown": { primary: ["Back"], secondary: ["Biceps"] },
  "Wide Grip Lat Pulldown": { primary: ["Back"], secondary: ["Biceps"] },
  "Pull-Ups": { primary: ["Back"], secondary: ["Biceps"] },
  "Chin-Ups": { primary: ["Back"], secondary: ["Biceps"] },
  "Cable Pullover": { primary: ["Back"], secondary: [] },
  "Straight Arm Pulldown": { primary: ["Back"], secondary: [] },
  "Machine Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Meadows Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Chest Supported Row": { primary: ["Back"], secondary: ["Biceps"] },
  "Deadlift": { primary: ["Back", "Legs"], secondary: ["Core"] },
  "Trap Bar Deadlift": { primary: ["Back", "Legs"], secondary: ["Core"] },
  "Rack Pull": { primary: ["Back"], secondary: ["Core"] },
  "Good Morning": { primary: ["Back"], secondary: ["Legs"] },
  "Hyperextension": { primary: ["Back"], secondary: ["Legs"] },
  "KB Row": { primary: ["Back"], secondary: ["Biceps"] },
  "KB Renegade Row": { primary: ["Back"], secondary: ["Core", "Biceps"] },
  "KB High Pull": { primary: ["Back"], secondary: ["Shoulders"] },
  "KB Clean": { primary: ["Back"], secondary: ["Shoulders", "Legs"] },
  "KB Snatch": { primary: ["Back"], secondary: ["Shoulders", "Legs"] },

  "Overhead Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "Dumbbell Shoulder Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "Arnold Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "Lateral Raise": { primary: ["Shoulders"], secondary: [] },
  "Cable Lateral Raise": { primary: ["Shoulders"], secondary: [] },
  "Machine Lateral Raise": { primary: ["Shoulders"], secondary: [] },
  "Front Raise": { primary: ["Shoulders"], secondary: [] },
  "Rear Delt Fly": { primary: ["Shoulders"], secondary: [] },
  "Face Pull": { primary: ["Shoulders"], secondary: ["Back"] },
  "Upright Row": { primary: ["Shoulders"], secondary: ["Traps"] },
  "Behind The Neck Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "Machine Shoulder Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "KB Press": { primary: ["Shoulders"], secondary: ["Triceps"] },
  "KB Push Press": { primary: ["Shoulders"], secondary: ["Triceps", "Legs"] },
  "KB Lateral Raise": { primary: ["Shoulders"], secondary: [] },
  "KB Halo": { primary: ["Shoulders"], secondary: ["Core"] },

  "Barbell Squat": { primary: ["Legs"], secondary: ["Core"] },
  "Front Squat": { primary: ["Legs"], secondary: ["Core"] },
  "Goblet Squat": { primary: ["Legs"], secondary: ["Core"] },
  "Hack Squat": { primary: ["Legs"], secondary: [] },
  "Leg Press": { primary: ["Legs"], secondary: [] },
  "Leg Extension": { primary: ["Legs"], secondary: [] },
  "Leg Curl": { primary: ["Legs"], secondary: [] },
  "Seated Leg Curl": { primary: ["Legs"], secondary: [] },
  "Romanian Deadlift": { primary: ["Legs"], secondary: ["Back"] },
  "Stiff Leg Deadlift": { primary: ["Legs"], secondary: ["Back"] },
  "Sumo Deadlift": { primary: ["Legs"], secondary: ["Back", "Core"] },
  "Bulgarian Split Squat": { primary: ["Legs"], secondary: [] },
  "Walking Lunges": { primary: ["Legs"], secondary: [] },
  "Reverse Lunges": { primary: ["Legs"], secondary: [] },
  "Hip Thrust": { primary: ["Legs"], secondary: [] },
  "Glute Bridge": { primary: ["Legs"], secondary: [] },
  "Step Ups": { primary: ["Legs"], secondary: [] },
  "Sissy Squat": { primary: ["Legs"], secondary: [] },
  "Leg Press Calf Raise": { primary: ["Legs"], secondary: [] },
  "Standing Calf Raise": { primary: ["Legs"], secondary: [] },
  "Seated Calf Raise": { primary: ["Legs"], secondary: [] },
  "KB Goblet Squat": { primary: ["Legs"], secondary: ["Core"] },
  "KB Swing": { primary: ["Legs"], secondary: ["Back", "Core"] },
  "KB Romanian Deadlift": { primary: ["Legs"], secondary: ["Back"] },
  "KB Lunges": { primary: ["Legs"], secondary: [] },
  "KB Bulgarian Split Squat": { primary: ["Legs"], secondary: [] },
  "KB Calf Raise": { primary: ["Legs"], secondary: [] },

  "Barbell Curl": { primary: ["Biceps"], secondary: [] },
  "Dumbbell Curl": { primary: ["Biceps"], secondary: [] },
  "Hammer Curl": { primary: ["Biceps"], secondary: ["Forearms"] },
  "Preacher Curl": { primary: ["Biceps"], secondary: [] },
  "Incline Dumbbell Curl": { primary: ["Biceps"], secondary: [] },
  "Cable Curl": { primary: ["Biceps"], secondary: [] },
  "Concentration Curl": { primary: ["Biceps"], secondary: [] },
  "EZ-Bar Curl": { primary: ["Biceps"], secondary: [] },
  "Spider Curl": { primary: ["Biceps"], secondary: [] },
  "Bayesian Curl": { primary: ["Biceps"], secondary: [] },
  "Reverse Curl": { primary: ["Biceps"], secondary: ["Forearms"] },
  "KB Curl": { primary: ["Biceps"], secondary: [] },
  "KB Hammer Curl": { primary: ["Biceps"], secondary: ["Forearms"] },

  "Tricep Pushdown": { primary: ["Triceps"], secondary: [] },
  "Overhead Tricep Extension": { primary: ["Triceps"], secondary: [] },
  "Skull Crushers": { primary: ["Triceps"], secondary: [] },
  "Close Grip Bench Press": { primary: ["Triceps"], secondary: ["Chest"] },
  "Tricep Dips": { primary: ["Triceps"], secondary: ["Chest", "Shoulders"] },
  "Tricep Kickback": { primary: ["Triceps"], secondary: [] },
  "Cable Overhead Extension": { primary: ["Triceps"], secondary: [] },
  "Diamond Push-Ups": { primary: ["Triceps"], secondary: ["Chest"] },
  "JM Press": { primary: ["Triceps"], secondary: ["Chest"] },
  "KB Overhead Tricep Extension": { primary: ["Triceps"], secondary: [] },
  "KB Skull Crusher": { primary: ["Triceps"], secondary: [] },

  "Plank": { primary: ["Core"], secondary: [] },
  "Side Plank": { primary: ["Core"], secondary: [] },
  "Crunches": { primary: ["Core"], secondary: [] },
  "Russian Twist": { primary: ["Core"], secondary: [] },
  "Hanging Leg Raise": { primary: ["Core"], secondary: [] },
  "Cable Crunch": { primary: ["Core"], secondary: [] },
  "Ab Wheel Rollout": { primary: ["Core"], secondary: [] },
  "Mountain Climbers": { primary: ["Core"], secondary: [] },
  "Dead Bug": { primary: ["Core"], secondary: [] },
  "Sit-Ups": { primary: ["Core"], secondary: [] },
  "Pallof Press": { primary: ["Core"], secondary: [] },
  "Woodchoppers": { primary: ["Core"], secondary: [] },
  "Decline Sit-Ups": { primary: ["Core"], secondary: [] },
  "Dragon Flag": { primary: ["Core"], secondary: [] },
  "KB Turkish Get-Up": { primary: ["Core"], secondary: ["Shoulders", "Legs"] },
  "KB Windmill": { primary: ["Core"], secondary: ["Shoulders"] },
  "KB Russian Twist": { primary: ["Core"], secondary: [] },

  "Barbell Shrug": { primary: ["Traps"], secondary: [] },
  "Dumbbell Shrug": { primary: ["Traps"], secondary: [] },
  "Farmer's Walk": { primary: ["Traps"], secondary: ["Forearms"] },
  "KB Farmer's Walk": { primary: ["Traps"], secondary: ["Forearms"] },

  "Wrist Curl": { primary: ["Forearms"], secondary: [] },
  "Reverse Wrist Curl": { primary: ["Forearms"], secondary: [] },
  "Plate Pinch": { primary: ["Forearms"], secondary: [] },
};

function getMuscleScores(exerciseName: string, muscleGroup: string): { muscle: string; score: number }[] {
  const mapping = EXERCISE_MUSCLE_MAP[exerciseName];
  if (mapping) {
    const scores: { muscle: string; score: number }[] = [];
    for (const m of mapping.primary) scores.push({ muscle: m, score: 3 });
    for (const m of mapping.secondary) scores.push({ muscle: m, score: 1 });
    return scores;
  }
  return [{ muscle: muscleGroup, score: 3 }];
}

function calculateAndStoreFatigue(sessionId: number) {
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as any;
  if (!session || !session.finished_at) return;

  const sets = db.prepare(`
    SELECT st.exercise_id, e.name, e.muscle_group, COUNT(*) as set_count
    FROM sets st
    JOIN exercises e ON e.id = st.exercise_id
    WHERE st.session_id = ?
    GROUP BY st.exercise_id
  `).all(sessionId) as any[];

  const fatigueMap: Record<string, number> = {};

  for (const s of sets) {
    const scores = getMuscleScores(s.name, s.muscle_group);
    for (const { muscle, score } of scores) {
      fatigueMap[muscle] = (fatigueMap[muscle] || 0) + score * Math.min(s.set_count, 6);
    }
  }

  const insert = db.prepare(
    "INSERT INTO muscle_fatigue (muscle_group, fatigue_score, last_trained_at, session_id) VALUES (?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    for (const [muscle, score] of Object.entries(fatigueMap)) {
      insert.run(muscle, score, session.finished_at, sessionId);
    }
  });
  tx();
}

export async function registerRoutes(app: Express): Promise<void> {

  // ── Exercises ──────────────────────────────────────────────
  app.get("/api/exercises", (req: Request, res: Response) => {
    const equipment = req.query.equipment as string;
    if (equipment) {
      const rows = db.prepare("SELECT * FROM exercises WHERE equipment = ? ORDER BY muscle_group, name").all(equipment);
      return res.json(rows);
    }
    const rows = db.prepare("SELECT * FROM exercises ORDER BY muscle_group, name").all();
    res.json(rows);
  });

  app.post("/api/exercises", (req: Request, res: Response) => {
    const { name, muscle_group } = req.body;
    if (!name || !muscle_group) return res.status(400).json({ error: "name and muscle_group required" });
    const result = db.prepare("INSERT INTO exercises (name, muscle_group, is_custom) VALUES (?, ?, 1)").run(name, muscle_group);
    res.json({ id: result.lastInsertRowid, name, muscle_group, is_custom: 1 });
  });

  // ── Plans ──────────────────────────────────────────────────
  app.get("/api/plans", (_req: Request, res: Response) => {
    const plans = db.prepare("SELECT * FROM plans ORDER BY created_at DESC").all() as any[];
    const result = plans.map(p => {
      const exercises = db.prepare(`
        SELECT pe.*, e.name, e.muscle_group
        FROM plan_exercises pe
        JOIN exercises e ON e.id = pe.exercise_id
        WHERE pe.plan_id = ?
        ORDER BY pe.sort_order
      `).all(p.id);
      return { ...p, exercises };
    });
    res.json(result);
  });

  app.get("/api/plans/:id", (req: Request, res: Response) => {
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(req.params.id) as any;
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    const exercises = db.prepare(`
      SELECT pe.*, e.name, e.muscle_group
      FROM plan_exercises pe
      JOIN exercises e ON e.id = pe.exercise_id
      WHERE pe.plan_id = ?
      ORDER BY pe.sort_order
    `).all(plan.id);
    res.json({ ...plan, exercises });
  });

  app.post("/api/plans", (req: Request, res: Response) => {
    const { name, exercises } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const insertPlan = db.prepare("INSERT INTO plans (name) VALUES (?)");
    const insertExercise = db.prepare(
      "INSERT INTO plan_exercises (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight, superset_group) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    const tx = db.transaction(() => {
      const result = insertPlan.run(name);
      const planId = result.lastInsertRowid;
      if (exercises && Array.isArray(exercises)) {
        exercises.forEach((ex: any, i: number) => {
          insertExercise.run(planId, ex.exercise_id, i, ex.default_sets || 3, ex.default_reps || 10, ex.default_weight || 0, ex.superset_group ?? null);
        });
      }
      return planId;
    });

    const planId = tx();
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(planId);
    const planExercises = db.prepare(`
      SELECT pe.*, e.name, e.muscle_group
      FROM plan_exercises pe
      JOIN exercises e ON e.id = pe.exercise_id
      WHERE pe.plan_id = ?
      ORDER BY pe.sort_order
    `).all(planId as number);
    res.json({ ...plan, exercises: planExercises });
  });

  app.put("/api/plans/:id", (req: Request, res: Response) => {
    const { name, exercises } = req.body;
    const planId = parseInt(req.params.id);

    const tx = db.transaction(() => {
      if (name) {
        db.prepare("UPDATE plans SET name = ? WHERE id = ?").run(name, planId);
      }
      if (exercises && Array.isArray(exercises)) {
        db.prepare("DELETE FROM plan_exercises WHERE plan_id = ?").run(planId);
        const insertExercise = db.prepare(
          "INSERT INTO plan_exercises (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight, superset_group) VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        exercises.forEach((ex: any, i: number) => {
          insertExercise.run(planId, ex.exercise_id, i, ex.default_sets || 3, ex.default_reps || 10, ex.default_weight || 0, ex.superset_group ?? null);
        });
      }
    });

    tx();
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(planId);
    const planExercises = db.prepare(`
      SELECT pe.*, e.name, e.muscle_group
      FROM plan_exercises pe
      JOIN exercises e ON e.id = pe.exercise_id
      WHERE pe.plan_id = ?
      ORDER BY pe.sort_order
    `).all(planId);
    res.json({ ...plan, exercises: planExercises });
  });

  app.delete("/api/plans/:id", (req: Request, res: Response) => {
    db.prepare("DELETE FROM plans WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  // ── Sessions ───────────────────────────────────────────────
  app.get("/api/sessions", (_req: Request, res: Response) => {
    const sessions = db.prepare(`
      SELECT s.*, p.name as plan_name
      FROM sessions s
      JOIN plans p ON p.id = s.plan_id
      ORDER BY s.started_at DESC
    `).all() as any[];

    const result = sessions.map(s => {
      const sets = db.prepare(`
        SELECT st.*, e.name as exercise_name, e.muscle_group
        FROM sets st
        JOIN exercises e ON e.id = st.exercise_id
        WHERE st.session_id = ?
        ORDER BY st.exercise_id, st.set_number
      `).all(s.id);
      const totalVolume = (sets as any[]).reduce((sum: number, st: any) => sum + st.weight * st.reps, 0);
      const duration = s.finished_at
        ? Math.round((new Date(s.finished_at).getTime() - new Date(s.started_at).getTime()) / 60000)
        : null;
      return { ...s, sets, totalVolume, duration };
    });
    res.json(result);
  });

  app.get("/api/sessions/:id", (req: Request, res: Response) => {
    const session = db.prepare(`
      SELECT s.*, p.name as plan_name
      FROM sessions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.id = ?
    `).get(req.params.id) as any;
    if (!session) return res.status(404).json({ error: "Session not found" });

    const sets = db.prepare(`
      SELECT st.*, e.name as exercise_name, e.muscle_group
      FROM sets st
      JOIN exercises e ON e.id = st.exercise_id
      WHERE st.session_id = ?
      ORDER BY st.exercise_id, st.set_number, st.is_drop_set
    `).all(session.id);

    const feedback = db.prepare(`
      SELECT ef.*, e.name as exercise_name
      FROM exercise_feedback ef
      JOIN exercises e ON e.id = ef.exercise_id
      WHERE ef.session_id = ?
    `).all(session.id);

    const totalVolume = (sets as any[]).reduce((sum: number, st: any) => sum + st.weight * st.reps, 0);
    const duration = session.finished_at
      ? Math.round((new Date(session.finished_at).getTime() - new Date(session.started_at).getTime()) / 60000)
      : null;

    res.json({ ...session, sets, feedback, totalVolume, duration });
  });

  app.post("/api/sessions", (req: Request, res: Response) => {
    const { plan_id } = req.body;
    if (!plan_id) return res.status(400).json({ error: "plan_id required" });
    const result = db.prepare("INSERT INTO sessions (plan_id) VALUES (?)").run(plan_id);
    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(result.lastInsertRowid);
    res.json(session);
  });

  app.put("/api/sessions/:id", (req: Request, res: Response) => {
    const { finished_at, rpe, notes } = req.body;
    const updates: string[] = [];
    const values: any[] = [];

    if (finished_at) { updates.push("finished_at = ?"); values.push(finished_at); }
    if (rpe !== undefined) { updates.push("rpe = ?"); values.push(rpe); }
    if (notes !== undefined) { updates.push("notes = ?"); values.push(notes); }

    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    }

    if (finished_at) {
      calculateAndStoreFatigue(parseInt(req.params.id));
    }

    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
    res.json(session);
  });

  // ── Sets ───────────────────────────────────────────────────
  app.post("/api/sets", (req: Request, res: Response) => {
    const { session_id, exercise_id, set_number, weight, reps, is_drop_set, parent_set_id } = req.body;
    if (!session_id || !exercise_id || set_number === undefined || weight === undefined || reps === undefined) {
      return res.status(400).json({ error: "session_id, exercise_id, set_number, weight, reps required" });
    }
    const result = db.prepare(
      "INSERT INTO sets (session_id, exercise_id, set_number, weight, reps, is_drop_set, parent_set_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(session_id, exercise_id, set_number, weight, reps, is_drop_set ? 1 : 0, parent_set_id || null);
    const set = db.prepare("SELECT * FROM sets WHERE id = ?").get(result.lastInsertRowid);
    res.json(set);
  });

  app.delete("/api/sets/:id", (req: Request, res: Response) => {
    db.prepare("DELETE FROM sets WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  // ── Exercise Feedback ──────────────────────────────────────
  app.post("/api/exercise-feedback", (req: Request, res: Response) => {
    const { session_id, exercise_id, rating } = req.body;
    if (!session_id || !exercise_id || !rating) {
      return res.status(400).json({ error: "session_id, exercise_id, rating required" });
    }
    const existing = db.prepare(
      "SELECT id FROM exercise_feedback WHERE session_id = ? AND exercise_id = ?"
    ).get(session_id, exercise_id) as any;
    if (existing) {
      db.prepare("UPDATE exercise_feedback SET rating = ? WHERE id = ?").run(rating, existing.id);
    } else {
      db.prepare(
        "INSERT INTO exercise_feedback (session_id, exercise_id, rating) VALUES (?, ?, ?)"
      ).run(session_id, exercise_id, rating);
    }
    res.json({ ok: true });
  });

  // ── Recommendations ────────────────────────────────────────
  app.get("/api/recommendations/:planId", (req: Request, res: Response) => {
    const planId = parseInt(req.params.planId);
    const planExercises = db.prepare(`
      SELECT pe.*, e.name, e.muscle_group
      FROM plan_exercises pe
      JOIN exercises e ON e.id = pe.exercise_id
      WHERE pe.plan_id = ?
      ORDER BY pe.sort_order
    `).all(planId) as any[];

    const lastSession = db.prepare(`
      SELECT id, rpe FROM sessions WHERE plan_id = ? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1
    `).get(planId) as any;

    const recommendations = planExercises.map(pe => {
      let suggestedWeight = pe.default_weight;
      let suggestedReps = pe.default_reps;
      let suggestedSets = pe.default_sets;
      let reason = "No previous data";

      if (lastSession) {
        const lastSets = db.prepare(
          "SELECT weight, reps FROM sets WHERE session_id = ? AND exercise_id = ? AND is_drop_set = 0 ORDER BY set_number"
        ).all(lastSession.id, pe.exercise_id) as any[];

        const feedback = db.prepare(
          "SELECT rating FROM exercise_feedback WHERE session_id = ? AND exercise_id = ?"
        ).get(lastSession.id, pe.exercise_id) as any;

        if (lastSets.length > 0) {
          const lastWeight = lastSets[0].weight;
          const allRepsHit = lastSets.every((s: any) => s.reps >= pe.default_reps);
          const rating = feedback?.rating;
          const rpe = lastSession.rpe || 5;

          if (rating === "easy" || (allRepsHit && !rating)) {
            suggestedWeight = lastWeight + 2.5;
            suggestedReps = pe.default_reps;
            reason = "Previous session felt easy — increase weight";
          } else if (rating === "right" && allRepsHit) {
            suggestedWeight = lastWeight;
            suggestedReps = Math.min(lastSets[0].reps + 1, pe.default_reps + 5);
            reason = "All reps completed — add 1 rep (double progression)";
          } else if (rating === "right" && !allRepsHit) {
            suggestedWeight = lastWeight;
            suggestedReps = lastSets[0].reps;
            reason = "Keep current weight — target same reps";
          } else if (rating === "hard" || rpe >= 9) {
            suggestedWeight = Math.max(0, lastWeight - 2.5);
            suggestedReps = pe.default_reps;
            reason = "Previous session was tough — reduce weight";
          } else {
            suggestedWeight = lastWeight;
            suggestedReps = lastSets[0].reps;
            reason = "Maintain current performance";
          }
          suggestedSets = pe.default_sets;
        }
      }

      return {
        exercise_id: pe.exercise_id,
        name: pe.name,
        muscle_group: pe.muscle_group,
        suggested_sets: suggestedSets,
        suggested_reps: suggestedReps,
        suggested_weight: suggestedWeight,
        reason,
      };
    });

    res.json(recommendations);
  });

  app.post("/api/recommendations/:planId/accept", (req: Request, res: Response) => {
    const planId = parseInt(req.params.planId);
    const { recommendations } = req.body;
    if (!recommendations || !Array.isArray(recommendations)) {
      return res.status(400).json({ error: "recommendations array required" });
    }

    const update = db.prepare(
      "UPDATE plan_exercises SET default_weight = ?, default_reps = ?, default_sets = ? WHERE plan_id = ? AND exercise_id = ?"
    );
    const tx = db.transaction(() => {
      for (const rec of recommendations) {
        update.run(rec.suggested_weight, rec.suggested_reps, rec.suggested_sets, planId, rec.exercise_id);
      }
    });
    tx();
    res.json({ ok: true });
  });

  // ── Stats ──────────────────────────────────────────────────
  app.get("/api/stats/weekly-volume", (_req: Request, res: Response) => {
    const rows = db.prepare(`
      SELECT e.muscle_group, SUM(st.weight * st.reps) as volume
      FROM sets st
      JOIN exercises e ON e.id = st.exercise_id
      JOIN sessions s ON s.id = st.session_id
      WHERE s.started_at >= datetime('now', '-7 days')
      GROUP BY e.muscle_group
      ORDER BY volume DESC
    `).all();
    res.json(rows);
  });

  app.get("/api/stats/prs", (_req: Request, res: Response) => {
    const rows = db.prepare(`
      SELECT e.id as exercise_id, e.name, e.muscle_group, MAX(st.weight) as max_weight, st.reps
      FROM sets st
      JOIN exercises e ON e.id = st.exercise_id
      WHERE st.weight = (SELECT MAX(st2.weight) FROM sets st2 WHERE st2.exercise_id = st.exercise_id)
      GROUP BY e.id
      ORDER BY e.name
    `).all();
    res.json(rows);
  });

  app.get("/api/stats/exercise-history/:exerciseId", (req: Request, res: Response) => {
    const rows = db.prepare(`
      SELECT s.id as session_id, s.started_at, SUM(st.weight * st.reps) as volume, COUNT(st.id) as total_sets
      FROM sets st
      JOIN sessions s ON s.id = st.session_id
      WHERE st.exercise_id = ?
      GROUP BY s.id
      ORDER BY s.started_at DESC
      LIMIT 10
    `).all(req.params.exerciseId);
    res.json(rows);
  });

  app.get("/api/stats/last-sets/:exerciseId", (req: Request, res: Response) => {
    const lastSession = db.prepare(`
      SELECT s.id FROM sessions s
      JOIN sets st ON st.session_id = s.id
      WHERE st.exercise_id = ? AND s.finished_at IS NOT NULL
      ORDER BY s.started_at DESC LIMIT 1
    `).get(req.params.exerciseId) as any;

    if (!lastSession) return res.json([]);

    const sets = db.prepare(
      "SELECT * FROM sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_number"
    ).all(lastSession.id, req.params.exerciseId);
    res.json(sets);
  });

  app.get("/api/stats/rest-average/:exerciseId", (req: Request, res: Response) => {
    const rows = db.prepare(`
      SELECT logged_at FROM sets
      WHERE exercise_id = ?
      ORDER BY session_id DESC, set_number
      LIMIT 20
    `).all(req.params.exerciseId) as any[];

    if (rows.length < 2) return res.json({ average: 90 });

    let totalRest = 0;
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      const diff = (new Date(rows[i - 1].logged_at).getTime() - new Date(rows[i].logged_at).getTime()) / 1000;
      if (diff > 0 && diff < 600) {
        totalRest += diff;
        count++;
      }
    }

    res.json({ average: count > 0 ? Math.round(totalRest / count) : 90 });
  });

  // ── MuscleWiki Proxy ─────────────────────────────────────
  app.get("/api/musclewiki/search", async (req: Request, res: Response) => {
    const name = (req.query.name as string || "").trim();
    if (!name) return res.json([]);

    const cached = db.prepare(
      "SELECT data FROM exercise_media_cache WHERE exercise_name = ? AND fetched_at > datetime('now', '-7 days')"
    ).get(name) as any;
    if (cached) return res.json(JSON.parse(cached.data));

    try {
      const resp = await fetch(`${MUSCLEWIKI_BASE}?format=json&limit=5&name=${encodeURIComponent(name)}`);
      if (!resp.ok) return res.json([]);
      const data = await resp.json();
      const results = (data.results || []).map((ex: any) => ({
        id: ex.id,
        name: ex.name,
        category: ex.category?.name || "",
        difficulty: ex.difficulty?.name || "",
        muscles_primary: (ex.muscles_primary || []).map((m: any) => m.name),
        muscles_secondary: (ex.muscles_secondary || []).map((m: any) => m.name),
        video_url: ex.male_images?.[0]?.og_image || ex.female_images?.[0]?.og_image || "",
        video_mp4: ex.male_images?.[0]?.branded_video || "",
        body_map_front: ex.body_map_images?.[0]?.image || "",
        body_map_back: ex.body_map_images?.[1]?.image || "",
        correct_steps: (ex.correct_steps || []).map((s: any) => s.text || s),
        description: ex.description || "",
      }));

      db.prepare(
        "INSERT OR REPLACE INTO exercise_media_cache (exercise_name, data, fetched_at) VALUES (?, ?, datetime('now'))"
      ).run(name, JSON.stringify(results));

      res.json(results);
    } catch (err) {
      console.error("MuscleWiki fetch error:", err);
      res.json([]);
    }
  });

  // ── Body Weight ──────────────────────────────────────────
  app.get("/api/body-weight", (_req: Request, res: Response) => {
    const rows = db.prepare("SELECT * FROM body_weight ORDER BY logged_date DESC LIMIT 100").all();
    res.json(rows);
  });

  app.post("/api/body-weight", (req: Request, res: Response) => {
    const { weight_kg, logged_date, notes } = req.body;
    if (!weight_kg) return res.status(400).json({ error: "weight_kg required" });
    const result = db.prepare(
      "INSERT INTO body_weight (weight_kg, logged_date, notes) VALUES (?, ?, ?)"
    ).run(weight_kg, logged_date || new Date().toISOString().split("T")[0], notes || null);
    const row = db.prepare("SELECT * FROM body_weight WHERE id = ?").get(result.lastInsertRowid);
    res.json(row);
  });

  // ── Progress Stats ───────────────────────────────────────
  app.get("/api/stats/totals", (_req: Request, res: Response) => {
    const totalWorkouts = (db.prepare(
      "SELECT COUNT(*) as c FROM sessions WHERE finished_at IS NOT NULL"
    ).get() as any).c;

    const totalVolume = (db.prepare(
      "SELECT COALESCE(SUM(st.weight * st.reps), 0) as v FROM sets st JOIN sessions s ON s.id = st.session_id WHERE s.finished_at IS NOT NULL"
    ).get() as any).v;

    const weeks = db.prepare(`
      SELECT strftime('%Y-%W', s.started_at) as wk, COUNT(DISTINCT s.id) as cnt
      FROM sessions s WHERE s.finished_at IS NOT NULL
      GROUP BY wk ORDER BY wk DESC
    `).all() as any[];

    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 0;
    const now = new Date();
    const currentWeek = `${now.getFullYear()}-${String(Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000)).padStart(2, "0")}`;

    for (let i = 0; i < weeks.length; i++) {
      if (i === 0) {
        streak = 1;
      } else {
        const prev = weeks[i - 1].wk;
        const curr = weeks[i].wk;
        const [py, pw] = prev.split("-").map(Number);
        const [cy, cw] = curr.split("-").map(Number);
        if ((py === cy && pw - cw === 1) || (py - cy === 1 && cw >= 50 && pw <= 2)) {
          streak++;
        } else {
          if (streak > longestStreak) longestStreak = streak;
          streak = 1;
        }
      }
    }
    if (streak > longestStreak) longestStreak = streak;
    currentStreak = streak;

    res.json({ totalWorkouts, totalVolume: Math.round(totalVolume), currentStreak, longestStreak });
  });

  app.get("/api/stats/weekly-history", (_req: Request, res: Response) => {
    const rows = db.prepare(`
      SELECT
        strftime('%Y-%W', s.started_at) as week,
        MIN(date(s.started_at)) as week_start,
        COALESCE(SUM(st.weight * st.reps), 0) as volume
      FROM sessions s
      LEFT JOIN sets st ON st.session_id = s.id
      WHERE s.finished_at IS NOT NULL AND s.started_at >= datetime('now', '-56 days')
      GROUP BY week
      ORDER BY week ASC
    `).all();
    res.json(rows);
  });

  app.get("/api/stats/consistency", (_req: Request, res: Response) => {
    const rows = db.prepare(`
      SELECT date(s.started_at) as workout_date,
             COUNT(*) as sessions,
             CASE WHEN EXISTS(
               SELECT 1 FROM sets st
               JOIN sessions s2 ON s2.id = st.session_id
               WHERE date(s2.started_at) = date(s.started_at)
               AND st.weight = (SELECT MAX(st2.weight) FROM sets st2 WHERE st2.exercise_id = st.exercise_id)
               AND NOT EXISTS(SELECT 1 FROM sets st3
                 JOIN sessions s3 ON s3.id = st3.session_id
                 WHERE st3.exercise_id = st.exercise_id AND st3.weight >= st.weight AND s3.started_at < s.started_at)
             ) THEN 1 ELSE 0 END as has_pr
      FROM sessions s
      WHERE s.finished_at IS NOT NULL AND s.started_at >= datetime('now', '-180 days')
      GROUP BY workout_date
      ORDER BY workout_date ASC
    `).all();
    res.json(rows);
  });

  app.get("/api/stats/exercise-progress/:exerciseId", (req: Request, res: Response) => {
    const exerciseId = parseInt(req.params.exerciseId);
    const sessions = db.prepare(`
      SELECT s.id, s.started_at,
             MAX(st.weight) as best_weight,
             MAX(st.weight * (1 + st.reps / 30.0)) as estimated_1rm,
             SUM(st.weight * st.reps) as volume,
             MAX(st.reps) as best_reps
      FROM sets st
      JOIN sessions s ON s.id = st.session_id
      WHERE st.exercise_id = ? AND s.finished_at IS NOT NULL
      GROUP BY s.id
      ORDER BY s.started_at ASC
    `).all(exerciseId);

    const prs = db.prepare(`
      SELECT MAX(st.weight) as max_weight,
             MAX(st.reps) as max_reps,
             MAX(st.weight * st.reps) as max_volume_set
      FROM sets st
      JOIN sessions s ON s.id = st.session_id
      WHERE st.exercise_id = ? AND s.finished_at IS NOT NULL
    `).get(exerciseId);

    res.json({ sessions, prs });
  });

  app.get("/api/stats/muscle-volume-7d", (_req: Request, res: Response) => {
    const rows = db.prepare(`
      SELECT e.muscle_group, COUNT(DISTINCT st.id) as set_count, SUM(st.weight * st.reps) as volume
      FROM sets st
      JOIN exercises e ON e.id = st.exercise_id
      JOIN sessions s ON s.id = st.session_id
      WHERE s.finished_at IS NOT NULL AND s.started_at >= datetime('now', '-7 days')
      GROUP BY e.muscle_group
    `).all();
    res.json(rows);
  });

  // ── Auto-Generate Plans ──────────────────────────────────
  app.post("/api/plans/auto-generate", (req: Request, res: Response) => {
    const { frequency, experience, goal, equipment } = req.body;
    if (!frequency || !experience || !goal) {
      return res.status(400).json({ error: "frequency, experience, goal required" });
    }

    const setsReps = goal === "strength"
      ? { sets: 4, reps: 5 }
      : goal === "muscle"
        ? { sets: 3, reps: 10 }
        : { sets: 3, reps: 13 };

    const kbSwap: Record<string, string> = {
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

    const useKB = equipment === "kettlebell";

    function findExercise(name: string): any {
      const resolvedName = useKB && kbSwap[name] ? kbSwap[name] : name;
      return db.prepare("SELECT id FROM exercises WHERE name = ?").get(resolvedName);
    }

    function buildPlanExercises(names: string[]) {
      const seen = new Set<number>();
      return names.map((n, i) => {
        const ex = findExercise(n);
        if (!ex || seen.has(ex.id)) return null;
        seen.add(ex.id);
        return { exercise_id: ex.id, sort_order: i, default_sets: setsReps.sets, default_reps: setsReps.reps, default_weight: 0 };
      }).filter(Boolean);
    }

    const insertPlan = db.prepare("INSERT INTO plans (name) VALUES (?)");
    const insertPE = db.prepare(
      "INSERT INTO plan_exercises (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight) VALUES (?, ?, ?, ?, ?, ?)"
    );

    const createdPlans: number[] = [];
    const prefix = useKB ? "KB " : "";

    const tx = db.transaction(() => {
      if (frequency <= 3) {
        const result = insertPlan.run(`${prefix}Full Body`);
        const planId = result.lastInsertRowid as number;
        const exercises = buildPlanExercises([
          "Barbell Squat", "Romanian Deadlift", "Barbell Bench Press",
          "Barbell Row", "Overhead Press", "Plank"
        ]);
        exercises.forEach((ex: any) => insertPE.run(planId, ex.exercise_id, ex.sort_order, ex.default_sets, ex.default_reps, ex.default_weight));
        createdPlans.push(planId);
      } else if (frequency === 4) {
        const upperA = insertPlan.run(`${prefix}Upper A`);
        const upperAId = upperA.lastInsertRowid as number;
        buildPlanExercises([
          "Barbell Bench Press", "Incline Dumbbell Press", "Barbell Row",
          "Lat Pulldown", "Overhead Press", "Barbell Curl", "Tricep Pushdown"
        ]).forEach((ex: any) => insertPE.run(upperAId, ex.exercise_id, ex.sort_order, ex.default_sets, ex.default_reps, ex.default_weight));
        createdPlans.push(upperAId);

        const lowerA = insertPlan.run(`${prefix}Lower A`);
        const lowerAId = lowerA.lastInsertRowid as number;
        buildPlanExercises([
          "Barbell Squat", "Romanian Deadlift", "Leg Press",
          "Leg Curl", "Standing Calf Raise"
        ]).forEach((ex: any) => insertPE.run(lowerAId, ex.exercise_id, ex.sort_order, ex.default_sets, ex.default_reps, ex.default_weight));
        createdPlans.push(lowerAId);

        const upperB = insertPlan.run(`${prefix}Upper B`);
        const upperBId = upperB.lastInsertRowid as number;
        buildPlanExercises([
          "Dumbbell Bench Press", "Cable Flyes", "Dumbbell Row",
          "Pull-Ups", "Dumbbell Shoulder Press", "Hammer Curl", "Overhead Tricep Extension"
        ]).forEach((ex: any) => insertPE.run(upperBId, ex.exercise_id, ex.sort_order, ex.default_sets, ex.default_reps, ex.default_weight));
        createdPlans.push(upperBId);

        const lowerB = insertPlan.run(`${prefix}Lower B`);
        const lowerBId = lowerB.lastInsertRowid as number;
        buildPlanExercises([
          "Bulgarian Split Squat", "Stiff Leg Deadlift", "Hack Squat",
          "Seated Leg Curl", "Seated Calf Raise"
        ]).forEach((ex: any) => insertPE.run(lowerBId, ex.exercise_id, ex.sort_order, ex.default_sets, ex.default_reps, ex.default_weight));
        createdPlans.push(lowerBId);
      } else {
        const push = insertPlan.run(`${prefix}Push`);
        const pushId = push.lastInsertRowid as number;
        buildPlanExercises([
          "Barbell Bench Press", "Incline Dumbbell Press", "Cable Flyes",
          "Overhead Press", "Lateral Raise", "Tricep Pushdown", "Overhead Tricep Extension"
        ]).forEach((ex: any) => insertPE.run(pushId, ex.exercise_id, ex.sort_order, ex.default_sets, ex.default_reps, ex.default_weight));
        createdPlans.push(pushId);

        const pull = insertPlan.run(`${prefix}Pull`);
        const pullId = pull.lastInsertRowid as number;
        buildPlanExercises([
          "Barbell Row", "Lat Pulldown", "Seated Cable Row",
          "Face Pull", "Barbell Curl", "Hammer Curl", "Barbell Shrug"
        ]).forEach((ex: any) => insertPE.run(pullId, ex.exercise_id, ex.sort_order, ex.default_sets, ex.default_reps, ex.default_weight));
        createdPlans.push(pullId);

        const legs = insertPlan.run(`${prefix}Legs`);
        const legsId = legs.lastInsertRowid as number;
        buildPlanExercises([
          "Barbell Squat", "Romanian Deadlift", "Leg Press",
          "Leg Extension", "Leg Curl", "Standing Calf Raise", "Plank"
        ]).forEach((ex: any) => insertPE.run(legsId, ex.exercise_id, ex.sort_order, ex.default_sets, ex.default_reps, ex.default_weight));
        createdPlans.push(legsId);
      }
    });

    tx();
    res.json({ planIds: createdPlans });
  });

  // ── Recovery / Fatigue ──────────────────────────────────
  app.get("/api/recovery", (_req: Request, res: Response) => {
    const ALL_MUSCLES = ["Chest", "Back", "Shoulders", "Legs", "Biceps", "Triceps", "Core", "Traps", "Forearms"];

    const rows = db.prepare(`
      SELECT muscle_group, fatigue_score, last_trained_at
      FROM muscle_fatigue
      ORDER BY last_trained_at DESC
    `).all() as { muscle_group: string; fatigue_score: number; last_trained_at: string }[];

    const muscleData: Record<string, { totalFatigue: number }> = {};
    for (const m of ALL_MUSCLES) {
      muscleData[m] = { totalFatigue: 0 };
    }

    const now = Date.now();
    for (const row of rows) {
      const hoursAgo = (now - new Date(row.last_trained_at + "Z").getTime()) / (1000 * 60 * 60);
      const decayedScore = Math.max(0, row.fatigue_score - (hoursAgo / 24));
      if (decayedScore > 0 && muscleData[row.muscle_group] !== undefined) {
        muscleData[row.muscle_group].totalFatigue += decayedScore;
      }
    }

    const MAX_FATIGUE = 18;
    const result = ALL_MUSCLES.map(muscle => {
      const fatigue = Math.min(muscleData[muscle].totalFatigue, MAX_FATIGUE);
      const recovery = Math.round(Math.max(0, (1 - fatigue / MAX_FATIGUE)) * 100);
      return {
        muscle_group: muscle,
        recovery_percent: recovery,
        fatigue_score: Math.round(fatigue * 10) / 10,
      };
    });

    res.json(result);
  });

  // ── Logged Exercises List (for progress search) ──────────
  app.get("/api/stats/logged-exercises", (_req: Request, res: Response) => {
    const rows = db.prepare(`
      SELECT DISTINCT e.id, e.name, e.muscle_group, COUNT(st.id) as total_sets, MAX(s.started_at) as last_used
      FROM sets st
      JOIN exercises e ON e.id = st.exercise_id
      JOIN sessions s ON s.id = st.session_id
      WHERE s.finished_at IS NOT NULL
      GROUP BY e.id
      ORDER BY last_used DESC
    `).all();
    res.json(rows);
  });

  // ── Push Notifications ──────────────────────────────────
  app.get("/api/push/vapid-public", (_req: Request, res: Response) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  app.post("/api/push/subscribe", (req: Request, res: Response) => {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: "endpoint and keys (p256dh, auth) required" });
    }
    db.prepare(
      "INSERT OR REPLACE INTO push_subscriptions (endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?)"
    ).run(endpoint, keys.p256dh, keys.auth);
    res.json({ ok: true });
  });

  app.delete("/api/push/unsubscribe", (req: Request, res: Response) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "endpoint required" });
    db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
    res.json({ ok: true });
  });

  function sendPushToAll(payload: string) {
    const subscriptions = db.prepare("SELECT * FROM push_subscriptions").all() as any[];
    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
      };
      webpush.sendNotification(pushSubscription, payload).catch((err: any) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(sub.endpoint);
        }
      });
    }
  }

  // ── Inactivity Notification Scheduler (every 6 hours) ───
  setInterval(() => {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

    try {
      const lastSession = db.prepare(
        "SELECT finished_at FROM sessions WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1"
      ).get() as any;

      if (!lastSession) return;

      const lastFinished = new Date(lastSession.finished_at);
      const now = new Date();
      const daysSince = (now.getTime() - lastFinished.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince >= 3) {
        sendPushToAll(JSON.stringify({
          title: "Time to Train!",
          body: `It's been ${Math.floor(daysSince)} days since your last workout. Ready to get back at it?`,
          url: "/",
        }));
      }
    } catch (err) {
      console.error("Inactivity notification error:", err);
    }
  }, 6 * 60 * 60 * 1000);

  // ── Weekly Summary (check every hour, send on Sunday at ~9am) ───
  setInterval(() => {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

    try {
      const now = new Date();
      if (now.getDay() !== 0 || now.getHours() !== 9) return;

      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const sessions = db.prepare(
        "SELECT COUNT(*) as count FROM sessions WHERE finished_at IS NOT NULL AND finished_at >= ?"
      ).get(weekAgo) as any;

      const sets = db.prepare(`
        SELECT SUM(st.weight * st.reps) as totalVolume
        FROM sets st
        JOIN sessions s ON s.id = st.session_id
        WHERE s.finished_at IS NOT NULL AND s.finished_at >= ?
      `).get(weekAgo) as any;

      const workoutCount = sessions?.count || 0;
      const totalVolume = Math.round(sets?.totalVolume || 0);

      if (workoutCount > 0) {
        sendPushToAll(JSON.stringify({
          title: "Weekly Summary",
          body: `This week: ${workoutCount} workout${workoutCount > 1 ? "s" : ""}, ${totalVolume.toLocaleString()} kg total volume. Keep it up!`,
          url: "/history",
        }));
      } else {
        sendPushToAll(JSON.stringify({
          title: "Weekly Summary",
          body: "No workouts this week. Start fresh tomorrow — every rep counts!",
          url: "/",
        }));
      }
    } catch (err) {
      console.error("Weekly summary notification error:", err);
    }
  }, 60 * 60 * 1000);

  // ── Workout Reminder (check every 30 min, suggest based on usual time) ───
  setInterval(() => {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();

      const recentSessions = db.prepare(`
        SELECT started_at FROM sessions
        WHERE finished_at IS NOT NULL
        ORDER BY started_at DESC
        LIMIT 20
      `).all() as any[];

      if (recentSessions.length < 3) return;

      const dayCounts: Record<number, number> = {};
      const hourCounts: Record<number, number> = {};

      for (const s of recentSessions) {
        const d = new Date(s.started_at);
        const day = d.getDay();
        const hour = d.getHours();
        dayCounts[day] = (dayCounts[day] || 0) + 1;
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }

      const isUsualDay = dayCounts[currentDay] && dayCounts[currentDay] >= 2;
      if (!isUsualDay) return;

      const usualHour = Object.entries(hourCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([h]) => parseInt(h))[0];

      const reminderHour = Math.max(0, usualHour - 1);
      if (currentHour !== reminderHour) return;

      const todaySessions = db.prepare(`
        SELECT COUNT(*) as count FROM sessions
        WHERE date(started_at) = date('now')
      `).get() as any;
      if (todaySessions?.count > 0) return;

      sendPushToAll(JSON.stringify({
        title: "Workout Reminder",
        body: "Your usual workout time is coming up. Ready to train?",
        url: "/",
      }));
    } catch (err) {
      console.error("Workout reminder notification error:", err);
    }
  }, 30 * 60 * 1000);

}
