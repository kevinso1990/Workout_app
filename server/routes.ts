import type { Express, Request, Response } from "express";
import db from "./db";

export async function registerRoutes(app: Express): Promise<void> {

  // ── Exercises ──────────────────────────────────────────────
  app.get("/api/exercises", (_req: Request, res: Response) => {
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
      "INSERT INTO plan_exercises (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight) VALUES (?, ?, ?, ?, ?, ?)"
    );

    const tx = db.transaction(() => {
      const result = insertPlan.run(name);
      const planId = result.lastInsertRowid;
      if (exercises && Array.isArray(exercises)) {
        exercises.forEach((ex: any, i: number) => {
          insertExercise.run(planId, ex.exercise_id, i, ex.default_sets || 3, ex.default_reps || 10, ex.default_weight || 0);
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
          "INSERT INTO plan_exercises (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight) VALUES (?, ?, ?, ?, ?, ?)"
        );
        exercises.forEach((ex: any, i: number) => {
          insertExercise.run(planId, ex.exercise_id, i, ex.default_sets || 3, ex.default_reps || 10, ex.default_weight || 0);
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
      ORDER BY st.exercise_id, st.set_number
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

    const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(req.params.id);
    res.json(session);
  });

  // ── Sets ───────────────────────────────────────────────────
  app.post("/api/sets", (req: Request, res: Response) => {
    const { session_id, exercise_id, set_number, weight, reps } = req.body;
    if (!session_id || !exercise_id || set_number === undefined || weight === undefined || reps === undefined) {
      return res.status(400).json({ error: "session_id, exercise_id, set_number, weight, reps required" });
    }
    const result = db.prepare(
      "INSERT INTO sets (session_id, exercise_id, set_number, weight, reps) VALUES (?, ?, ?, ?, ?)"
    ).run(session_id, exercise_id, set_number, weight, reps);
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
          "SELECT weight, reps FROM sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_number"
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

}
