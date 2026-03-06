// server/index.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import * as fs from "fs";
import * as path2 from "path";

// server/db.ts
import Database from "better-sqlite3";
import path from "path";
var DB_PATH = process.env.DB_PATH ?? path.resolve(process.cwd(), "workout.db");
var db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      muscle_group TEXT NOT NULL,
      equipment TEXT DEFAULT 'barbell',
      is_custom INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plan_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      default_sets INTEGER DEFAULT 3,
      default_reps INTEGER DEFAULT 10,
      default_weight REAL DEFAULT 0,
      superset_group INTEGER,
      FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      started_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT,
      rpe INTEGER,
      notes TEXT,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_number INTEGER NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      is_drop_set INTEGER DEFAULT 0,
      parent_set_id INTEGER,
      logged_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id),
      FOREIGN KEY (parent_set_id) REFERENCES sets(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS exercise_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      rating TEXT CHECK(rating IN ('easy', 'right', 'hard')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

    CREATE TABLE IF NOT EXISTS body_weight (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_kg REAL NOT NULL,
      logged_date TEXT NOT NULL DEFAULT (date('now')),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS exercise_media_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_name TEXT NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_media_name ON exercise_media_cache(exercise_name);

    CREATE TABLE IF NOT EXISTS muscle_fatigue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      muscle_group TEXT NOT NULL,
      fatigue_score REAL NOT NULL,
      last_trained_at TEXT NOT NULL,
      session_id INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      keys_p256dh TEXT NOT NULL,
      keys_auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      notification_type TEXT NOT NULL,
      sent_date TEXT NOT NULL,
      UNIQUE(notification_type, sent_date)
    );
  `);
  seedExercises();
  migrateSupersetsDropSets();
  migrateAuth();
}
function migrateAuth() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  try {
    db.exec("ALTER TABLE plans ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
  } catch {
  }
  try {
    db.exec("ALTER TABLE sessions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
  } catch {
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)");
  } catch {
  }
}
function migrateSupersetsDropSets() {
  try {
    db.exec("ALTER TABLE plan_exercises ADD COLUMN superset_group INTEGER");
  } catch {
  }
  try {
    db.exec("ALTER TABLE sets ADD COLUMN is_drop_set INTEGER DEFAULT 0");
  } catch {
  }
  try {
    db.exec("ALTER TABLE sets ADD COLUMN parent_set_id INTEGER REFERENCES sets(id) ON DELETE SET NULL");
  } catch {
  }
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_muscle_fatigue_session_muscle ON muscle_fatigue(session_id, muscle_group)");
  } catch {
  }
}
function seedExercises() {
  const count = db.prepare("SELECT COUNT(*) as c FROM exercises").get();
  if (count.c > 0) {
    seedKettlebellExercises();
    return;
  }
  const exercises = [
    ["Barbell Bench Press", "Chest", "barbell"],
    ["Incline Barbell Bench Press", "Chest", "barbell"],
    ["Decline Barbell Bench Press", "Chest", "barbell"],
    ["Dumbbell Bench Press", "Chest", "dumbbell"],
    ["Incline Dumbbell Press", "Chest", "dumbbell"],
    ["Dumbbell Flyes", "Chest", "dumbbell"],
    ["Cable Flyes", "Chest", "cable"],
    ["Machine Chest Press", "Chest", "machine"],
    ["Pec Deck", "Chest", "machine"],
    ["Push-Ups", "Chest", "bodyweight"],
    ["Chest Dips", "Chest", "bodyweight"],
    ["Landmine Press", "Chest", "barbell"],
    ["Barbell Row", "Back", "barbell"],
    ["Dumbbell Row", "Back", "dumbbell"],
    ["Pendlay Row", "Back", "barbell"],
    ["T-Bar Row", "Back", "barbell"],
    ["Seated Cable Row", "Back", "cable"],
    ["Lat Pulldown", "Back", "cable"],
    ["Wide Grip Lat Pulldown", "Back", "cable"],
    ["Pull-Ups", "Back", "bodyweight"],
    ["Chin-Ups", "Back", "bodyweight"],
    ["Cable Pullover", "Back", "cable"],
    ["Straight Arm Pulldown", "Back", "cable"],
    ["Machine Row", "Back", "machine"],
    ["Meadows Row", "Back", "barbell"],
    ["Chest Supported Row", "Back", "dumbbell"],
    ["Overhead Press", "Shoulders", "barbell"],
    ["Dumbbell Shoulder Press", "Shoulders", "dumbbell"],
    ["Arnold Press", "Shoulders", "dumbbell"],
    ["Lateral Raise", "Shoulders", "dumbbell"],
    ["Cable Lateral Raise", "Shoulders", "cable"],
    ["Machine Lateral Raise", "Shoulders", "machine"],
    ["Front Raise", "Shoulders", "dumbbell"],
    ["Rear Delt Fly", "Shoulders", "dumbbell"],
    ["Face Pull", "Shoulders", "cable"],
    ["Upright Row", "Shoulders", "barbell"],
    ["Behind The Neck Press", "Shoulders", "barbell"],
    ["Machine Shoulder Press", "Shoulders", "machine"],
    ["Barbell Squat", "Legs", "barbell"],
    ["Front Squat", "Legs", "barbell"],
    ["Goblet Squat", "Legs", "dumbbell"],
    ["Hack Squat", "Legs", "machine"],
    ["Leg Press", "Legs", "machine"],
    ["Leg Extension", "Legs", "machine"],
    ["Leg Curl", "Legs", "machine"],
    ["Seated Leg Curl", "Legs", "machine"],
    ["Romanian Deadlift", "Legs", "barbell"],
    ["Stiff Leg Deadlift", "Legs", "barbell"],
    ["Sumo Deadlift", "Legs", "barbell"],
    ["Bulgarian Split Squat", "Legs", "dumbbell"],
    ["Walking Lunges", "Legs", "dumbbell"],
    ["Reverse Lunges", "Legs", "dumbbell"],
    ["Hip Thrust", "Legs", "barbell"],
    ["Glute Bridge", "Legs", "bodyweight"],
    ["Step Ups", "Legs", "dumbbell"],
    ["Sissy Squat", "Legs", "bodyweight"],
    ["Leg Press Calf Raise", "Legs", "machine"],
    ["Standing Calf Raise", "Legs", "machine"],
    ["Seated Calf Raise", "Legs", "machine"],
    ["Deadlift", "Back", "barbell"],
    ["Trap Bar Deadlift", "Back", "barbell"],
    ["Rack Pull", "Back", "barbell"],
    ["Good Morning", "Back", "barbell"],
    ["Hyperextension", "Back", "bodyweight"],
    ["Barbell Curl", "Biceps", "barbell"],
    ["Dumbbell Curl", "Biceps", "dumbbell"],
    ["Hammer Curl", "Biceps", "dumbbell"],
    ["Preacher Curl", "Biceps", "barbell"],
    ["Incline Dumbbell Curl", "Biceps", "dumbbell"],
    ["Cable Curl", "Biceps", "cable"],
    ["Concentration Curl", "Biceps", "dumbbell"],
    ["EZ-Bar Curl", "Biceps", "barbell"],
    ["Spider Curl", "Biceps", "dumbbell"],
    ["Bayesian Curl", "Biceps", "cable"],
    ["Reverse Curl", "Biceps", "barbell"],
    ["Tricep Pushdown", "Triceps", "cable"],
    ["Overhead Tricep Extension", "Triceps", "dumbbell"],
    ["Skull Crushers", "Triceps", "barbell"],
    ["Close Grip Bench Press", "Triceps", "barbell"],
    ["Tricep Dips", "Triceps", "bodyweight"],
    ["Tricep Kickback", "Triceps", "dumbbell"],
    ["Cable Overhead Extension", "Triceps", "cable"],
    ["Diamond Push-Ups", "Triceps", "bodyweight"],
    ["JM Press", "Triceps", "barbell"],
    ["Plank", "Core", "bodyweight"],
    ["Side Plank", "Core", "bodyweight"],
    ["Crunches", "Core", "bodyweight"],
    ["Russian Twist", "Core", "bodyweight"],
    ["Hanging Leg Raise", "Core", "bodyweight"],
    ["Cable Crunch", "Core", "cable"],
    ["Ab Wheel Rollout", "Core", "bodyweight"],
    ["Mountain Climbers", "Core", "bodyweight"],
    ["Dead Bug", "Core", "bodyweight"],
    ["Sit-Ups", "Core", "bodyweight"],
    ["Pallof Press", "Core", "cable"],
    ["Woodchoppers", "Core", "cable"],
    ["Decline Sit-Ups", "Core", "bodyweight"],
    ["Dragon Flag", "Core", "bodyweight"],
    ["Barbell Shrug", "Traps", "barbell"],
    ["Dumbbell Shrug", "Traps", "dumbbell"],
    ["Farmer's Walk", "Traps", "dumbbell"],
    ["Wrist Curl", "Forearms", "barbell"],
    ["Reverse Wrist Curl", "Forearms", "barbell"],
    ["Plate Pinch", "Forearms", "bodyweight"],
    ["KB Goblet Squat", "Legs", "kettlebell"],
    ["KB Swing", "Legs", "kettlebell"],
    ["KB Romanian Deadlift", "Legs", "kettlebell"],
    ["KB Lunges", "Legs", "kettlebell"],
    ["KB Bulgarian Split Squat", "Legs", "kettlebell"],
    ["KB Calf Raise", "Legs", "kettlebell"],
    ["KB Press", "Shoulders", "kettlebell"],
    ["KB Push Press", "Shoulders", "kettlebell"],
    ["KB Lateral Raise", "Shoulders", "kettlebell"],
    ["KB Halo", "Shoulders", "kettlebell"],
    ["KB Floor Press", "Chest", "kettlebell"],
    ["KB Squeeze Press", "Chest", "kettlebell"],
    ["KB Row", "Back", "kettlebell"],
    ["KB Renegade Row", "Back", "kettlebell"],
    ["KB High Pull", "Back", "kettlebell"],
    ["KB Clean", "Back", "kettlebell"],
    ["KB Snatch", "Back", "kettlebell"],
    ["KB Curl", "Biceps", "kettlebell"],
    ["KB Hammer Curl", "Biceps", "kettlebell"],
    ["KB Overhead Tricep Extension", "Triceps", "kettlebell"],
    ["KB Skull Crusher", "Triceps", "kettlebell"],
    ["KB Turkish Get-Up", "Core", "kettlebell"],
    ["KB Windmill", "Core", "kettlebell"],
    ["KB Russian Twist", "Core", "kettlebell"],
    ["KB Farmer's Walk", "Traps", "kettlebell"]
  ];
  const insert = db.prepare("INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, is_custom) VALUES (?, ?, ?, 0)");
  const tx = db.transaction(() => {
    for (const [name, group, equip] of exercises) {
      insert.run(name, group, equip);
    }
  });
  tx();
}
function seedKettlebellExercises() {
  try {
    db.exec("ALTER TABLE exercises ADD COLUMN equipment TEXT DEFAULT 'barbell'");
  } catch {
  }
  db.prepare("UPDATE exercises SET equipment = 'dumbbell' WHERE name LIKE '%Dumbbell%' OR name LIKE 'Incline Dumbbell%'").run();
  db.prepare("UPDATE exercises SET equipment = 'cable' WHERE name LIKE 'Cable%' OR name IN ('Lat Pulldown','Wide Grip Lat Pulldown','Straight Arm Pulldown','Bayesian Curl','Face Pull','Pallof Press','Woodchoppers','Tricep Pushdown','Seated Cable Row')").run();
  db.prepare("UPDATE exercises SET equipment = 'machine' WHERE name LIKE 'Machine%' OR name IN ('Pec Deck','Hack Squat','Leg Press','Leg Extension','Leg Curl','Seated Leg Curl','Standing Calf Raise','Seated Calf Raise','Leg Press Calf Raise')").run();
  db.prepare("UPDATE exercises SET equipment = 'bodyweight' WHERE name IN ('Push-Ups','Pull-Ups','Chin-Ups','Chest Dips','Tricep Dips','Diamond Push-Ups','Plank','Side Plank','Crunches','Russian Twist','Hanging Leg Raise','Ab Wheel Rollout','Mountain Climbers','Dead Bug','Sit-Ups','Decline Sit-Ups','Dragon Flag','Hyperextension','Glute Bridge','Sissy Squat','Plate Pinch')").run();
  db.prepare("UPDATE exercises SET equipment = 'dumbbell' WHERE name IN ('Arnold Press','Lateral Raise','Front Raise','Rear Delt Fly','Goblet Squat','Bulgarian Split Squat','Walking Lunges','Reverse Lunges','Step Ups','Hammer Curl','Concentration Curl','Spider Curl','Overhead Tricep Extension','Tricep Kickback','Chest Supported Row')").run();
  const kbExercises = [
    ["KB Goblet Squat", "Legs"],
    ["KB Swing", "Legs"],
    ["KB Romanian Deadlift", "Legs"],
    ["KB Lunges", "Legs"],
    ["KB Bulgarian Split Squat", "Legs"],
    ["KB Calf Raise", "Legs"],
    ["KB Press", "Shoulders"],
    ["KB Push Press", "Shoulders"],
    ["KB Lateral Raise", "Shoulders"],
    ["KB Halo", "Shoulders"],
    ["KB Floor Press", "Chest"],
    ["KB Squeeze Press", "Chest"],
    ["KB Row", "Back"],
    ["KB Renegade Row", "Back"],
    ["KB High Pull", "Back"],
    ["KB Clean", "Back"],
    ["KB Snatch", "Back"],
    ["KB Curl", "Biceps"],
    ["KB Hammer Curl", "Biceps"],
    ["KB Overhead Tricep Extension", "Triceps"],
    ["KB Skull Crusher", "Triceps"],
    ["KB Turkish Get-Up", "Core"],
    ["KB Windmill", "Core"],
    ["KB Russian Twist", "Core"],
    ["KB Farmer's Walk", "Traps"]
  ];
  const insert = db.prepare("INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, is_custom) VALUES (?, ?, 'kettlebell', 0)");
  const tx = db.transaction(() => {
    for (const [name, group] of kbExercises) {
      insert.run(name, group);
    }
  });
  tx();
}
var db_default = db;

// server/routes/auth.ts
import { Router } from "express";

// server/middleware/errorHandler.ts
var AppError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
  }
};
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  const cast = err;
  const status = cast.status ?? cast.statusCode ?? 500;
  const message = cast.message ?? "Internal Server Error";
  if (status >= 500) {
    console.error("Unhandled server error:", err);
  }
  res.status(status).json({ error: message });
}

// server/services/authService.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
var BCRYPT_ROUNDS = 10;
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return secret;
}
function toPublicUser(user) {
  return { id: user.id, username: user.username, email: user.email, created_at: user.created_at };
}
function signToken(user) {
  const payload = { sub: user.id, username: user.username };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}
async function signup(body) {
  const { username, email, password } = body;
  if (!username?.trim()) throw new AppError(400, "username is required");
  if (!email?.trim()) throw new AppError(400, "email is required");
  if (!password) throw new AppError(400, "password is required");
  if (password.length < 8) throw new AppError(400, "password must be at least 8 characters");
  const existing = db_default.prepare("SELECT id FROM users WHERE email = ? OR username = ?").get(email.toLowerCase(), username);
  if (existing) throw new AppError(409, "A user with that email or username already exists");
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = db_default.prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)").run(username.trim(), email.toLowerCase().trim(), password_hash);
  const user = db_default.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
  return { token: signToken(user), user: toPublicUser(user) };
}
async function login(body) {
  const { email, password } = body;
  if (!email?.trim()) throw new AppError(400, "email is required");
  if (!password) throw new AppError(400, "password is required");
  const user = db_default.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase().trim());
  const hashToCheck = user?.password_hash ?? "$2b$10$invalidhashpadding000000000000000000000000000000000000";
  const valid = await bcrypt.compare(password, hashToCheck);
  if (!user || !valid) throw new AppError(401, "Invalid email or password");
  return { token: signToken(user), user: toPublicUser(user) };
}
function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
}

// server/controllers/authController.ts
var signup2 = asyncHandler(async (req, res) => {
  const result = await signup(req.body);
  res.status(201).json(result);
});
var login2 = asyncHandler(async (req, res) => {
  const result = await login(req.body);
  res.json(result);
});
var me = asyncHandler(async (req, res) => {
  res.json(req.user);
});

// server/middleware/authMiddleware.ts
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
    }
  }
  next();
}
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization header missing or malformed" });
    return;
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch (err) {
    next(err);
  }
}

// server/routes/auth.ts
var router = Router();
router.post("/signup", signup2);
router.post("/login", login2);
router.get("/me", requireAuth, me);
var auth_default = router;

// server/routes/exercises.ts
import { Router as Router2 } from "express";

// server/services/exerciseService.ts
function listExercises(equipment) {
  if (equipment) {
    return db_default.prepare("SELECT * FROM exercises WHERE equipment = ? ORDER BY muscle_group, name").all(equipment);
  }
  return db_default.prepare("SELECT * FROM exercises ORDER BY muscle_group, name").all();
}
function createExercise(body) {
  const { name, muscle_group } = body;
  if (!name || !muscle_group) {
    throw new AppError(400, "name and muscle_group required");
  }
  const result = db_default.prepare("INSERT INTO exercises (name, muscle_group, is_custom) VALUES (?, ?, 1)").run(name, muscle_group);
  return { id: result.lastInsertRowid, name, muscle_group, equipment: "barbell", is_custom: 1 };
}

// server/controllers/exerciseController.ts
var list = asyncHandler(async (req, res) => {
  const equipment = req.query.equipment;
  res.json(listExercises(equipment));
});
var create = asyncHandler(async (req, res) => {
  const body = req.body;
  res.json(createExercise(body));
});

// server/routes/exercises.ts
var router2 = Router2();
router2.get("/", list);
router2.post("/", create);
var exercises_default = router2;

// server/routes/plans.ts
import { Router as Router3 } from "express";

// server/services/planService.ts
function fetchPlanExercises(planId) {
  return db_default.prepare(
    `SELECT pe.*, e.name, e.muscle_group
       FROM plan_exercises pe
       JOIN exercises e ON e.id = pe.exercise_id
       WHERE pe.plan_id = ?
       ORDER BY pe.sort_order`
  ).all(planId);
}
function listPlans(userId) {
  const plans = userId ? db_default.prepare("SELECT * FROM plans WHERE user_id = ? ORDER BY created_at DESC").all(userId) : db_default.prepare("SELECT * FROM plans ORDER BY created_at DESC").all();
  return plans.map((p) => ({ ...p, exercises: fetchPlanExercises(p.id) }));
}
function getPlan(id, userId) {
  const plan = db_default.prepare("SELECT * FROM plans WHERE id = ?").get(id);
  if (!plan) throw new AppError(404, "Plan not found");
  if (userId !== void 0 && plan.user_id !== null && plan.user_id !== userId) {
    throw new AppError(403, "Access denied");
  }
  return { ...plan, exercises: fetchPlanExercises(plan.id) };
}
function createPlan(body, userId) {
  const { name, exercises } = body;
  if (!name) throw new AppError(400, "name required");
  const insertPlan = db_default.prepare("INSERT INTO plans (name, user_id) VALUES (?, ?)");
  const insertExercise = db_default.prepare(
    `INSERT INTO plan_exercises
       (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight, superset_group)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const planId = db_default.transaction(() => {
    const result = insertPlan.run(name, userId ?? null);
    const pid = result.lastInsertRowid;
    if (Array.isArray(exercises)) {
      exercises.forEach((ex, i) => {
        insertExercise.run(
          pid,
          ex.exercise_id,
          i,
          ex.default_sets ?? 3,
          ex.default_reps ?? 10,
          ex.default_weight ?? 0,
          ex.superset_group ?? null
        );
      });
    }
    return pid;
  })();
  const plan = db_default.prepare("SELECT * FROM plans WHERE id = ?").get(planId);
  return { ...plan, exercises: fetchPlanExercises(planId) };
}
function updatePlan(id, body) {
  const { name, exercises } = body;
  const insertExercise = db_default.prepare(
    `INSERT INTO plan_exercises
       (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight, superset_group)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  db_default.transaction(() => {
    if (name) {
      db_default.prepare("UPDATE plans SET name = ? WHERE id = ?").run(name, id);
    }
    if (Array.isArray(exercises)) {
      db_default.prepare("DELETE FROM plan_exercises WHERE plan_id = ?").run(id);
      exercises.forEach((ex, i) => {
        insertExercise.run(
          id,
          ex.exercise_id,
          i,
          ex.default_sets ?? 3,
          ex.default_reps ?? 10,
          ex.default_weight ?? 0,
          ex.superset_group ?? null
        );
      });
    }
  })();
  const plan = db_default.prepare("SELECT * FROM plans WHERE id = ?").get(id);
  return { ...plan, exercises: fetchPlanExercises(id) };
}
function deletePlan(id) {
  db_default.prepare("DELETE FROM plans WHERE id = ?").run(id);
}
var KB_SWAP = {
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
  "Pull-Ups": "KB High Pull"
};
function autoGeneratePlans(body, userId) {
  const { frequency, experience, goal, equipment } = body;
  if (!frequency || !experience || !goal) {
    throw new AppError(400, "frequency, experience, goal required");
  }
  const setsReps = goal === "strength" ? { sets: 4, reps: 5 } : goal === "muscle" ? { sets: 3, reps: 10 } : { sets: 3, reps: 13 };
  const useKB = equipment === "kettlebell";
  const findExercise = (name) => {
    const resolved = useKB && KB_SWAP[name] ? KB_SWAP[name] : name;
    return db_default.prepare("SELECT id FROM exercises WHERE name = ?").get(resolved);
  };
  const buildPlanExercises = (names) => {
    const seen = /* @__PURE__ */ new Set();
    return names.map((n, i) => {
      const ex = findExercise(n);
      if (!ex || seen.has(ex.id)) return null;
      seen.add(ex.id);
      return {
        exercise_id: ex.id,
        sort_order: i,
        default_sets: setsReps.sets,
        default_reps: setsReps.reps,
        default_weight: 0
      };
    }).filter((x) => x !== null);
  };
  const insertPlan = db_default.prepare("INSERT INTO plans (name, user_id) VALUES (?, ?)");
  const insertPE = db_default.prepare(
    `INSERT INTO plan_exercises
       (plan_id, exercise_id, sort_order, default_sets, default_reps, default_weight)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const prefix = useKB ? "KB " : "";
  const createdPlans = [];
  db_default.transaction(() => {
    const addPlan = (name, exerciseNames) => {
      const pid = insertPlan.run(`${prefix}${name}`, userId ?? null).lastInsertRowid;
      for (const ex of buildPlanExercises(exerciseNames)) {
        insertPE.run(pid, ex.exercise_id, ex.sort_order, ex.default_sets, ex.default_reps, ex.default_weight);
      }
      createdPlans.push(pid);
    };
    if (frequency <= 3) {
      addPlan("Full Body", [
        "Barbell Squat",
        "Romanian Deadlift",
        "Barbell Bench Press",
        "Barbell Row",
        "Overhead Press",
        "Plank"
      ]);
    } else if (frequency === 4) {
      addPlan("Upper A", [
        "Barbell Bench Press",
        "Incline Dumbbell Press",
        "Barbell Row",
        "Lat Pulldown",
        "Overhead Press",
        "Barbell Curl",
        "Tricep Pushdown"
      ]);
      addPlan("Lower A", [
        "Barbell Squat",
        "Romanian Deadlift",
        "Leg Press",
        "Leg Curl",
        "Standing Calf Raise"
      ]);
      addPlan("Upper B", [
        "Dumbbell Bench Press",
        "Cable Flyes",
        "Dumbbell Row",
        "Pull-Ups",
        "Dumbbell Shoulder Press",
        "Hammer Curl",
        "Overhead Tricep Extension"
      ]);
      addPlan("Lower B", [
        "Bulgarian Split Squat",
        "Stiff Leg Deadlift",
        "Hack Squat",
        "Seated Leg Curl",
        "Seated Calf Raise"
      ]);
    } else {
      addPlan("Push", [
        "Barbell Bench Press",
        "Incline Dumbbell Press",
        "Cable Flyes",
        "Overhead Press",
        "Lateral Raise",
        "Tricep Pushdown",
        "Overhead Tricep Extension"
      ]);
      addPlan("Pull", [
        "Barbell Row",
        "Lat Pulldown",
        "Seated Cable Row",
        "Face Pull",
        "Barbell Curl",
        "Hammer Curl",
        "Barbell Shrug"
      ]);
      addPlan("Legs", [
        "Barbell Squat",
        "Romanian Deadlift",
        "Leg Press",
        "Leg Extension",
        "Leg Curl",
        "Standing Calf Raise",
        "Plank"
      ]);
    }
  })();
  return { planIds: createdPlans };
}

// server/controllers/planController.ts
var list2 = asyncHandler(async (req, res) => {
  res.json(listPlans(req.user?.sub));
});
var getOne = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  res.json(getPlan(id, req.user?.sub));
});
var create2 = asyncHandler(async (req, res) => {
  const body = req.body;
  res.json(createPlan(body, req.user?.sub));
});
var update = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = req.body;
  res.json(updatePlan(id, body));
});
var remove = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  deletePlan(id);
  res.json({ ok: true });
});
var autoGenerate = asyncHandler(async (req, res) => {
  const body = req.body;
  res.json(autoGeneratePlans(body, req.user?.sub));
});

// server/routes/plans.ts
var router3 = Router3();
router3.use(optionalAuth);
router3.post("/auto-generate", autoGenerate);
router3.get("/", list2);
router3.post("/", create2);
router3.get("/:id", getOne);
router3.put("/:id", update);
router3.delete("/:id", remove);
var plans_default = router3;

// server/routes/sessions.ts
import { Router as Router4 } from "express";

// server/services/recoveryService.ts
var EXERCISE_MUSCLE_MAP = {
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
  "Plate Pinch": { primary: ["Forearms"], secondary: [] }
};
function getMuscleScores(exerciseName, muscleGroup) {
  const mapping = EXERCISE_MUSCLE_MAP[exerciseName];
  if (mapping) {
    return [
      ...mapping.primary.map((m) => ({ muscle: m, score: 3 })),
      ...mapping.secondary.map((m) => ({ muscle: m, score: 1 }))
    ];
  }
  return [{ muscle: muscleGroup, score: 3 }];
}
function calculateAndStoreFatigue(sessionId) {
  const session = db_default.prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId);
  if (!session?.finished_at) return;
  const sets = db_default.prepare(
    `SELECT st.exercise_id, e.name, e.muscle_group, COUNT(*) as set_count
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       WHERE st.session_id = ?
       GROUP BY st.exercise_id`
  ).all(sessionId);
  const fatigueMap = {};
  for (const s of sets) {
    for (const { muscle, score } of getMuscleScores(s.name, s.muscle_group)) {
      fatigueMap[muscle] = (fatigueMap[muscle] ?? 0) + score * Math.min(s.set_count, 6);
    }
  }
  const insert = db_default.prepare(
    "INSERT INTO muscle_fatigue (muscle_group, fatigue_score, last_trained_at, session_id) VALUES (?, ?, ?, ?)"
  );
  db_default.transaction(() => {
    for (const [muscle, score] of Object.entries(fatigueMap)) {
      insert.run(muscle, score, session.finished_at, sessionId);
    }
  })();
}
var ALL_MUSCLES = [
  "Chest",
  "Back",
  "Shoulders",
  "Legs",
  "Biceps",
  "Triceps",
  "Core",
  "Traps",
  "Forearms"
];
var MAX_FATIGUE = 18;
function getRecovery() {
  const rows = db_default.prepare(
    "SELECT muscle_group, fatigue_score, last_trained_at FROM muscle_fatigue ORDER BY last_trained_at DESC"
  ).all();
  const muscleData = Object.fromEntries(
    ALL_MUSCLES.map((m) => [m, 0])
  );
  const now = Date.now();
  for (const row of rows) {
    const hoursAgo = (now - (/* @__PURE__ */ new Date(row.last_trained_at + "Z")).getTime()) / (1e3 * 60 * 60);
    const decayedScore = Math.max(0, row.fatigue_score - hoursAgo / 24);
    if (decayedScore > 0 && muscleData[row.muscle_group] !== void 0) {
      muscleData[row.muscle_group] += decayedScore;
    }
  }
  return ALL_MUSCLES.map((muscle) => {
    const fatigue = Math.min(muscleData[muscle], MAX_FATIGUE);
    return {
      muscle_group: muscle,
      recovery_percent: Math.round(Math.max(0, 1 - fatigue / MAX_FATIGUE) * 100),
      fatigue_score: Math.round(fatigue * 10) / 10
    };
  });
}

// server/services/sessionService.ts
function computeDuration(startedAt, finishedAt) {
  if (!finishedAt) return null;
  return Math.round(
    (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 6e4
  );
}
function listSessions(userId) {
  const sessions = userId ? db_default.prepare(
    `SELECT s.*, p.name as plan_name
           FROM sessions s
           JOIN plans p ON p.id = s.plan_id
           WHERE s.user_id = ?
           ORDER BY s.started_at DESC`
  ).all(userId) : db_default.prepare(
    `SELECT s.*, p.name as plan_name
           FROM sessions s
           JOIN plans p ON p.id = s.plan_id
           ORDER BY s.started_at DESC`
  ).all();
  return sessions.map((s) => {
    const sets = db_default.prepare(
      `SELECT st.*, e.name as exercise_name, e.muscle_group
         FROM sets st
         JOIN exercises e ON e.id = st.exercise_id
         WHERE st.session_id = ?
         ORDER BY st.exercise_id, st.set_number`
    ).all(s.id);
    const totalVolume = sets.reduce((sum, st) => sum + st.weight * st.reps, 0);
    return { ...s, sets, totalVolume, duration: computeDuration(s.started_at, s.finished_at) };
  });
}
function getSession(id) {
  const session = db_default.prepare(
    `SELECT s.*, p.name as plan_name
       FROM sessions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.id = ?`
  ).get(id);
  if (!session) throw new AppError(404, "Session not found");
  const sets = db_default.prepare(
    `SELECT st.*, e.name as exercise_name, e.muscle_group
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       WHERE st.session_id = ?
       ORDER BY st.exercise_id, st.set_number, st.is_drop_set`
  ).all(session.id);
  const feedback = db_default.prepare(
    `SELECT ef.*, e.name as exercise_name
       FROM exercise_feedback ef
       JOIN exercises e ON e.id = ef.exercise_id
       WHERE ef.session_id = ?`
  ).all(session.id);
  const totalVolume = sets.reduce((sum, st) => sum + st.weight * st.reps, 0);
  return {
    ...session,
    sets,
    feedback,
    totalVolume,
    duration: computeDuration(session.started_at, session.finished_at)
  };
}
function createSession(planId, userId) {
  if (!planId) throw new AppError(400, "plan_id required");
  const result = db_default.prepare("INSERT INTO sessions (plan_id, user_id) VALUES (?, ?)").run(planId, userId ?? null);
  return db_default.prepare("SELECT * FROM sessions WHERE id = ?").get(result.lastInsertRowid);
}
function getWorkoutHistory(userId) {
  return listSessions(userId);
}
function finishSession(id, body) {
  const { finished_at, rpe, notes } = body;
  const updates = [];
  const values = [];
  if (finished_at) {
    updates.push("finished_at = ?");
    values.push(finished_at);
  }
  if (rpe !== void 0) {
    updates.push("rpe = ?");
    values.push(rpe);
  }
  if (notes !== void 0) {
    updates.push("notes = ?");
    values.push(notes);
  }
  if (updates.length > 0) {
    db_default.prepare(`UPDATE sessions SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
  }
  if (finished_at) {
    const existing = db_default.prepare("SELECT id FROM muscle_fatigue WHERE session_id = ? LIMIT 1").get(id);
    if (!existing) {
      calculateAndStoreFatigue(id);
    }
  }
  return db_default.prepare("SELECT * FROM sessions WHERE id = ?").get(id);
}

// server/controllers/sessionController.ts
var list3 = asyncHandler(async (req, res) => {
  res.json(listSessions(req.user?.sub));
});
var getOne2 = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  res.json(getSession(id));
});
var create3 = asyncHandler(async (req, res) => {
  const { plan_id } = req.body;
  res.json(createSession(plan_id, req.user?.sub));
});
var history = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  res.json(getWorkoutHistory(userId));
});
var finish = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const body = req.body;
  res.json(finishSession(id, body));
});

// server/routes/sessions.ts
var router4 = Router4();
router4.get("/history", requireAuth, history);
router4.get("/", optionalAuth, list3);
router4.post("/", optionalAuth, create3);
router4.get("/:id", getOne2);
router4.put("/:id", finish);
var sessions_default = router4;

// server/routes/sets.ts
import { Router as Router5 } from "express";

// server/services/setService.ts
function logSet(body) {
  const { session_id, exercise_id, set_number, weight, reps, is_drop_set, parent_set_id } = body;
  if (session_id === void 0 || exercise_id === void 0 || set_number === void 0 || weight === void 0 || reps === void 0) {
    throw new AppError(400, "session_id, exercise_id, set_number, weight, reps required");
  }
  const result = db_default.prepare(
    `INSERT INTO sets
         (session_id, exercise_id, set_number, weight, reps, is_drop_set, parent_set_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    session_id,
    exercise_id,
    set_number,
    weight,
    reps,
    is_drop_set ? 1 : 0,
    parent_set_id ?? null
  );
  return db_default.prepare("SELECT * FROM sets WHERE id = ?").get(result.lastInsertRowid);
}
function deleteSet(id) {
  db_default.prepare("DELETE FROM sets WHERE id = ?").run(id);
}

// server/controllers/setController.ts
var logSet2 = asyncHandler(async (req, res) => {
  const body = req.body;
  res.json(logSet(body));
});
var remove2 = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  deleteSet(id);
  res.json({ ok: true });
});

// server/routes/sets.ts
var router5 = Router5();
router5.post("/", logSet2);
router5.delete("/:id", remove2);
var sets_default = router5;

// server/routes/feedback.ts
import { Router as Router6 } from "express";

// server/services/feedbackService.ts
function upsertFeedback(body) {
  const { session_id, exercise_id, rating } = body;
  if (!session_id || !exercise_id || !rating) {
    throw new AppError(400, "session_id, exercise_id, rating required");
  }
  const existing = db_default.prepare(
    "SELECT id FROM exercise_feedback WHERE session_id = ? AND exercise_id = ?"
  ).get(session_id, exercise_id);
  if (existing) {
    db_default.prepare("UPDATE exercise_feedback SET rating = ? WHERE id = ?").run(rating, existing.id);
  } else {
    db_default.prepare(
      "INSERT INTO exercise_feedback (session_id, exercise_id, rating) VALUES (?, ?, ?)"
    ).run(session_id, exercise_id, rating);
  }
}

// server/controllers/feedbackController.ts
var submit = asyncHandler(async (req, res) => {
  const body = req.body;
  upsertFeedback(body);
  res.json({ ok: true });
});

// server/routes/feedback.ts
var router6 = Router6();
router6.post("/", submit);
var feedback_default = router6;

// server/routes/recommendations.ts
import { Router as Router7 } from "express";

// server/services/recommendationService.ts
function getRecommendations(planId) {
  const planExercises = db_default.prepare(
    `SELECT pe.*, e.name, e.muscle_group
       FROM plan_exercises pe
       JOIN exercises e ON e.id = pe.exercise_id
       WHERE pe.plan_id = ?
       ORDER BY pe.sort_order`
  ).all(planId);
  const lastSession = db_default.prepare(
    `SELECT id, rpe FROM sessions
       WHERE plan_id = ? AND finished_at IS NOT NULL
       ORDER BY finished_at DESC LIMIT 1`
  ).get(planId);
  return planExercises.map((pe) => {
    let suggestedWeight = pe.default_weight;
    let suggestedReps = pe.default_reps;
    const suggestedSets = pe.default_sets;
    let reason = "No previous data";
    if (lastSession) {
      const lastSets2 = db_default.prepare(
        `SELECT weight, reps FROM sets
           WHERE session_id = ? AND exercise_id = ? AND is_drop_set = 0
           ORDER BY set_number`
      ).all(lastSession.id, pe.exercise_id);
      const feedback = db_default.prepare(
        "SELECT rating FROM exercise_feedback WHERE session_id = ? AND exercise_id = ?"
      ).get(lastSession.id, pe.exercise_id);
      if (lastSets2.length > 0) {
        const lastWeight = lastSets2[0].weight;
        const allRepsHit = lastSets2.every((s) => s.reps >= pe.default_reps);
        const rating = feedback?.rating;
        const rpe = lastSession.rpe ?? 5;
        if (rating === "easy" || allRepsHit && !rating) {
          suggestedWeight = lastWeight + 2.5;
          suggestedReps = pe.default_reps;
          reason = "Previous session felt easy \u2014 increase weight";
        } else if (rating === "right" && allRepsHit) {
          suggestedWeight = lastWeight;
          suggestedReps = Math.min(lastSets2[0].reps + 1, pe.default_reps + 5);
          reason = "All reps completed \u2014 add 1 rep (double progression)";
        } else if (rating === "right" && !allRepsHit) {
          suggestedWeight = lastWeight;
          suggestedReps = lastSets2[0].reps;
          reason = "Keep current weight \u2014 target same reps";
        } else if (rating === "hard" || rpe >= 9) {
          suggestedWeight = Math.max(0, lastWeight - 2.5);
          suggestedReps = pe.default_reps;
          reason = "Previous session was tough \u2014 reduce weight";
        } else {
          suggestedWeight = lastWeight;
          suggestedReps = lastSets2[0].reps;
          reason = "Maintain current performance";
        }
      }
    }
    return {
      exercise_id: pe.exercise_id,
      name: pe.name,
      muscle_group: pe.muscle_group,
      suggested_sets: suggestedSets,
      suggested_reps: suggestedReps,
      suggested_weight: suggestedWeight,
      reason
    };
  });
}
function acceptRecommendations(planId, recommendations) {
  if (!Array.isArray(recommendations)) {
    throw new AppError(400, "recommendations array required");
  }
  const update2 = db_default.prepare(
    `UPDATE plan_exercises
     SET default_weight = ?, default_reps = ?, default_sets = ?
     WHERE plan_id = ? AND exercise_id = ?`
  );
  db_default.transaction(() => {
    for (const rec of recommendations) {
      update2.run(rec.suggested_weight, rec.suggested_reps, rec.suggested_sets, planId, rec.exercise_id);
    }
  })();
}

// server/controllers/recommendationController.ts
var getForPlan = asyncHandler(async (req, res) => {
  const planId = parseInt(req.params.planId, 10);
  res.json(getRecommendations(planId));
});
var accept = asyncHandler(async (req, res) => {
  const planId = parseInt(req.params.planId, 10);
  const { recommendations } = req.body;
  acceptRecommendations(planId, recommendations);
  res.json({ ok: true });
});

// server/routes/recommendations.ts
var router7 = Router7();
router7.get("/:planId", getForPlan);
router7.post("/:planId/accept", accept);
var recommendations_default = router7;

// server/routes/stats.ts
import { Router as Router8 } from "express";

// server/services/statsService.ts
function getWeeklyVolume() {
  return db_default.prepare(
    `SELECT e.muscle_group, SUM(st.weight * st.reps) as volume
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       JOIN sessions s ON s.id = st.session_id
       WHERE s.started_at >= datetime('now', '-7 days')
       GROUP BY e.muscle_group
       ORDER BY volume DESC`
  ).all();
}
function getPRs() {
  return db_default.prepare(
    `SELECT e.id as exercise_id, e.name, e.muscle_group, MAX(st.weight) as max_weight, st.reps
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       WHERE st.weight = (SELECT MAX(st2.weight) FROM sets st2 WHERE st2.exercise_id = st.exercise_id)
       GROUP BY e.id
       ORDER BY e.name`
  ).all();
}
function getExerciseHistory(exerciseId) {
  return db_default.prepare(
    `SELECT s.id as session_id, s.started_at,
              SUM(st.weight * st.reps) as volume, COUNT(st.id) as total_sets
       FROM sets st
       JOIN sessions s ON s.id = st.session_id
       WHERE st.exercise_id = ?
       GROUP BY s.id
       ORDER BY s.started_at DESC
       LIMIT 10`
  ).all(exerciseId);
}
function getLastSets(exerciseId) {
  const lastSession = db_default.prepare(
    `SELECT s.id FROM sessions s
       JOIN sets st ON st.session_id = s.id
       WHERE st.exercise_id = ? AND s.finished_at IS NOT NULL
       ORDER BY s.started_at DESC LIMIT 1`
  ).get(exerciseId);
  if (!lastSession) return [];
  return db_default.prepare(
    "SELECT * FROM sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_number"
  ).all(lastSession.id, exerciseId);
}
function getRestAverage(exerciseId) {
  const rows = db_default.prepare(
    `SELECT logged_at FROM sets
       WHERE exercise_id = ?
       ORDER BY session_id DESC, set_number
       LIMIT 20`
  ).all(exerciseId);
  if (rows.length < 2) return { average: 90 };
  let totalRest = 0;
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const diff = (new Date(rows[i - 1].logged_at).getTime() - new Date(rows[i].logged_at).getTime()) / 1e3;
    if (diff > 0 && diff < 600) {
      totalRest += diff;
      count++;
    }
  }
  return { average: count > 0 ? Math.round(totalRest / count) : 90 };
}
function getTotals() {
  const totalWorkouts = db_default.prepare("SELECT COUNT(*) as c FROM sessions WHERE finished_at IS NOT NULL").get().c;
  const totalVolume = db_default.prepare(
    `SELECT COALESCE(SUM(st.weight * st.reps), 0) as v
         FROM sets st
         JOIN sessions s ON s.id = st.session_id
         WHERE s.finished_at IS NOT NULL`
  ).get().v;
  const weeks = db_default.prepare(
    `SELECT strftime('%Y-%W', s.started_at) as wk, COUNT(DISTINCT s.id) as cnt
       FROM sessions s WHERE s.finished_at IS NOT NULL
       GROUP BY wk ORDER BY wk DESC`
  ).all();
  let streak = 0;
  let longestStreak = 0;
  for (let i = 0; i < weeks.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const [py, pw] = weeks[i - 1].wk.split("-").map(Number);
      const [cy, cw] = weeks[i].wk.split("-").map(Number);
      const consecutive = py === cy && pw - cw === 1 || py - cy === 1 && cw >= 50 && pw <= 2;
      if (consecutive) {
        streak++;
      } else {
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }
  }
  longestStreak = Math.max(longestStreak, streak);
  return {
    totalWorkouts,
    totalVolume: Math.round(totalVolume),
    currentStreak: streak,
    longestStreak
  };
}
function getWeeklyHistory() {
  return db_default.prepare(
    `SELECT
         strftime('%Y-%W', s.started_at) as week,
         MIN(date(s.started_at)) as week_start,
         COALESCE(SUM(st.weight * st.reps), 0) as volume
       FROM sessions s
       LEFT JOIN sets st ON st.session_id = s.id
       WHERE s.finished_at IS NOT NULL AND s.started_at >= datetime('now', '-56 days')
       GROUP BY week
       ORDER BY week ASC`
  ).all();
}
function getConsistency() {
  return db_default.prepare(
    `SELECT date(s.started_at) as workout_date,
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
       ORDER BY workout_date ASC`
  ).all();
}
function getExerciseProgress(exerciseId) {
  const sessions = db_default.prepare(
    `SELECT s.id, s.started_at,
              MAX(st.weight) as best_weight,
              MAX(st.weight * (1 + st.reps / 30.0)) as estimated_1rm,
              SUM(st.weight * st.reps) as volume,
              MAX(st.reps) as best_reps
       FROM sets st
       JOIN sessions s ON s.id = st.session_id
       WHERE st.exercise_id = ? AND s.finished_at IS NOT NULL
       GROUP BY s.id
       ORDER BY s.started_at ASC`
  ).all(exerciseId);
  const prs2 = db_default.prepare(
    `SELECT MAX(st.weight) as max_weight,
              MAX(st.reps) as max_reps,
              MAX(st.weight * st.reps) as max_volume_set
       FROM sets st
       JOIN sessions s ON s.id = st.session_id
       WHERE st.exercise_id = ? AND s.finished_at IS NOT NULL`
  ).get(exerciseId);
  return { sessions, prs: prs2 };
}
function getMuscleVolume7d() {
  return db_default.prepare(
    `SELECT e.muscle_group, COUNT(DISTINCT st.id) as set_count, SUM(st.weight * st.reps) as volume
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       JOIN sessions s ON s.id = st.session_id
       WHERE s.finished_at IS NOT NULL AND s.started_at >= datetime('now', '-7 days')
       GROUP BY e.muscle_group`
  ).all();
}
function getLoggedExercises() {
  return db_default.prepare(
    `SELECT DISTINCT e.id, e.name, e.muscle_group,
              COUNT(st.id) as total_sets, MAX(s.started_at) as last_used
       FROM sets st
       JOIN exercises e ON e.id = st.exercise_id
       JOIN sessions s ON s.id = st.session_id
       WHERE s.finished_at IS NOT NULL
       GROUP BY e.id
       ORDER BY last_used DESC`
  ).all();
}

// server/controllers/statsController.ts
var weeklyVolume = asyncHandler(async (_req, res) => {
  res.json(getWeeklyVolume());
});
var prs = asyncHandler(async (_req, res) => {
  res.json(getPRs());
});
var exerciseHistory = asyncHandler(async (req, res) => {
  const exerciseId = parseInt(req.params.exerciseId, 10);
  res.json(getExerciseHistory(exerciseId));
});
var lastSets = asyncHandler(async (req, res) => {
  const exerciseId = parseInt(req.params.exerciseId, 10);
  res.json(getLastSets(exerciseId));
});
var restAverage = asyncHandler(async (req, res) => {
  const exerciseId = parseInt(req.params.exerciseId, 10);
  res.json(getRestAverage(exerciseId));
});
var totals = asyncHandler(async (_req, res) => {
  res.json(getTotals());
});
var weeklyHistory = asyncHandler(async (_req, res) => {
  res.json(getWeeklyHistory());
});
var consistency = asyncHandler(async (_req, res) => {
  res.json(getConsistency());
});
var exerciseProgress = asyncHandler(async (req, res) => {
  const exerciseId = parseInt(req.params.exerciseId, 10);
  res.json(getExerciseProgress(exerciseId));
});
var muscleVolume7d = asyncHandler(async (_req, res) => {
  res.json(getMuscleVolume7d());
});
var loggedExercises = asyncHandler(async (_req, res) => {
  res.json(getLoggedExercises());
});

// server/routes/stats.ts
var router8 = Router8();
router8.get("/weekly-volume", weeklyVolume);
router8.get("/prs", prs);
router8.get("/exercise-history/:exerciseId", exerciseHistory);
router8.get("/last-sets/:exerciseId", lastSets);
router8.get("/rest-average/:exerciseId", restAverage);
router8.get("/totals", totals);
router8.get("/weekly-history", weeklyHistory);
router8.get("/consistency", consistency);
router8.get("/exercise-progress/:exerciseId", exerciseProgress);
router8.get("/muscle-volume-7d", muscleVolume7d);
router8.get("/logged-exercises", loggedExercises);
var stats_default = router8;

// server/routes/bodyWeight.ts
import { Router as Router9 } from "express";

// server/services/bodyWeightService.ts
function listBodyWeight() {
  return db_default.prepare("SELECT * FROM body_weight ORDER BY logged_date DESC LIMIT 100").all();
}
function logBodyWeight(body) {
  const { weight_kg, logged_date, notes } = body;
  if (!weight_kg) throw new AppError(400, "weight_kg required");
  const date = logged_date ?? (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const result = db_default.prepare("INSERT INTO body_weight (weight_kg, logged_date, notes) VALUES (?, ?, ?)").run(weight_kg, date, notes ?? null);
  return db_default.prepare("SELECT * FROM body_weight WHERE id = ?").get(result.lastInsertRowid);
}

// server/controllers/bodyWeightController.ts
var list4 = asyncHandler(async (_req, res) => {
  res.json(listBodyWeight());
});
var create4 = asyncHandler(async (req, res) => {
  const body = req.body;
  res.json(logBodyWeight(body));
});

// server/routes/bodyWeight.ts
var router9 = Router9();
router9.get("/", list4);
router9.post("/", create4);
var bodyWeight_default = router9;

// server/routes/recovery.ts
import { Router as Router10 } from "express";

// server/controllers/recoveryController.ts
var getRecovery2 = asyncHandler(async (_req, res) => {
  res.json(getRecovery());
});

// server/routes/recovery.ts
var router10 = Router10();
router10.get("/", getRecovery2);
var recovery_default = router10;

// server/routes/muscleWiki.ts
import { Router as Router11 } from "express";

// server/services/muscleWikiService.ts
var MUSCLEWIKI_BASE = "https://musclewiki.com/newapi/exercise/exercises/";
var CACHE_TTL_DAYS = 7;
async function searchMuscleWiki(name) {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const cached = db_default.prepare(
    `SELECT data FROM exercise_media_cache
       WHERE exercise_name = ? AND fetched_at > datetime('now', '-${CACHE_TTL_DAYS} days')`
  ).get(trimmed);
  if (cached) return JSON.parse(cached.data);
  const resp = await fetch(
    `${MUSCLEWIKI_BASE}?format=json&limit=5&name=${encodeURIComponent(trimmed)}`
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  const results = (data.results ?? []).map((ex) => ({
    id: ex.id,
    name: ex.name,
    category: ex.category?.name ?? "",
    difficulty: ex.difficulty?.name ?? "",
    muscles_primary: (ex.muscles_primary ?? []).map((m) => m.name),
    muscles_secondary: (ex.muscles_secondary ?? []).map((m) => m.name),
    video_url: ex.male_images?.[0]?.og_image ?? ex.female_images?.[0]?.og_image ?? "",
    video_mp4: ex.male_images?.[0]?.branded_video ?? "",
    body_map_front: ex.body_map_images?.[0]?.image ?? "",
    body_map_back: ex.body_map_images?.[1]?.image ?? "",
    correct_steps: (ex.correct_steps ?? []).map(
      (s) => typeof s === "string" ? s : s.text ?? ""
    ),
    description: ex.description ?? ""
  }));
  db_default.prepare(
    "INSERT OR REPLACE INTO exercise_media_cache (exercise_name, data, fetched_at) VALUES (?, ?, datetime('now'))"
  ).run(trimmed, JSON.stringify(results));
  return results;
}

// server/controllers/muscleWikiController.ts
var search = asyncHandler(async (req, res) => {
  const name = req.query.name ?? "";
  res.json(await searchMuscleWiki(name));
});

// server/routes/muscleWiki.ts
var router11 = Router11();
router11.get("/search", search);
var muscleWiki_default = router11;

// server/routes/push.ts
import { Router as Router12 } from "express";

// server/services/pushService.ts
import webpush from "web-push";
var VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
var VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:workoutapp@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}
function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}
function subscribe(body) {
  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new AppError(400, "endpoint and keys (p256dh, auth) required");
  }
  db_default.prepare(
    "INSERT OR REPLACE INTO push_subscriptions (endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?)"
  ).run(endpoint, keys.p256dh, keys.auth);
}
function unsubscribe(endpoint) {
  if (!endpoint) throw new AppError(400, "endpoint required");
  db_default.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}
function wasNotificationSentToday(type) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  return !!db_default.prepare(
    "SELECT id FROM notification_log WHERE notification_type = ? AND sent_date = ?"
  ).get(type, today);
}
function markNotificationSent(type) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  db_default.prepare(
    "INSERT OR IGNORE INTO notification_log (notification_type, sent_date) VALUES (?, ?)"
  ).run(type, today);
}
function sendPushToAll(payload) {
  const subscriptions = db_default.prepare("SELECT * FROM push_subscriptions").all();
  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
    };
    webpush.sendNotification(pushSubscription, payload).catch(
      (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          db_default.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(sub.endpoint);
        }
      }
    );
  }
}
function checkInactivity() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const lastSession = db_default.prepare(
      "SELECT finished_at FROM sessions WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1"
    ).get();
    if (!lastSession) return;
    const daysSince = (Date.now() - new Date(lastSession.finished_at).getTime()) / (1e3 * 60 * 60 * 24);
    if (daysSince >= 3 && !wasNotificationSentToday("inactivity")) {
      markNotificationSent("inactivity");
      sendPushToAll(
        JSON.stringify({
          title: "Time to Train!",
          body: `It's been ${Math.floor(daysSince)} days since your last workout. Ready to get back at it?`,
          url: "/"
        })
      );
    }
  } catch (err) {
    console.error("Inactivity notification error:", err);
  }
}
function checkWeeklySummary() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const now = /* @__PURE__ */ new Date();
    if (now.getDay() !== 0 || now.getHours() !== 9) return;
    if (wasNotificationSentToday("weekly_summary")) return;
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3).toISOString();
    const sessionCount = db_default.prepare(
      "SELECT COUNT(*) as count FROM sessions WHERE finished_at IS NOT NULL AND finished_at >= ?"
    ).get(weekAgo).count;
    const volumeRow = db_default.prepare(
      `SELECT SUM(st.weight * st.reps) as totalVolume
         FROM sets st
         JOIN sessions s ON s.id = st.session_id
         WHERE s.finished_at IS NOT NULL AND s.finished_at >= ?`
    ).get(weekAgo);
    const totalVolume = Math.round(volumeRow.totalVolume ?? 0);
    markNotificationSent("weekly_summary");
    sendPushToAll(
      JSON.stringify({
        title: "Weekly Summary",
        body: `This week: ${sessionCount} workout${sessionCount !== 1 ? "s" : ""}, ${totalVolume.toLocaleString()} kg total volume. Keep it up!`,
        url: "/progress"
      })
    );
  } catch (err) {
    console.error("Weekly summary notification error:", err);
  }
}
function startPushScheduler() {
  setInterval(checkInactivity, 6 * 60 * 60 * 1e3);
  setInterval(checkWeeklySummary, 60 * 60 * 1e3);
}

// server/controllers/pushController.ts
var vapidPublic = asyncHandler(async (_req, res) => {
  res.json({ publicKey: getVapidPublicKey() });
});
var subscribe2 = asyncHandler(async (req, res) => {
  const body = req.body;
  subscribe(body);
  res.json({ ok: true });
});
var unsubscribe2 = asyncHandler(async (req, res) => {
  const { endpoint } = req.body;
  unsubscribe(endpoint);
  res.json({ ok: true });
});

// server/routes/push.ts
var router12 = Router12();
router12.get("/vapid-public", vapidPublic);
router12.post("/subscribe", subscribe2);
router12.delete("/unsubscribe", unsubscribe2);
var push_default = router12;

// server/routes/index.ts
function registerRoutes(app2) {
  app2.use("/api/auth", auth_default);
  app2.use("/api/exercises", exercises_default);
  app2.use("/api/plans", plans_default);
  app2.use("/api/sessions", sessions_default);
  app2.use("/api/sets", sets_default);
  app2.use("/api/exercise-feedback", feedback_default);
  app2.use("/api/recommendations", recommendations_default);
  app2.use("/api/stats", stats_default);
  app2.use("/api/body-weight", bodyWeight_default);
  app2.use("/api/recovery", recovery_default);
  app2.use("/api/musclewiki", muscleWiki_default);
  app2.use("/api/push", push_default);
  startPushScheduler();
}

// server/index.ts
var app = express();
var log = console.log;
var isProd = process.env.NODE_ENV === "production";
function setupCors(app2) {
  const allowedOrigins = [
    /\.replit\.dev$/,
    /\.repl\.co$/,
    /^http:\/\/localhost(:\d+)?$/
  ];
  app2.use((req, res, next) => {
    const origin = req.header("origin");
    if (origin && allowedOrigins.some((p) => p.test(origin))) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
}
(async () => {
  initDb();
  log("Database initialized");
  setupCors(app);
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (req.path.startsWith("/api") || req.path === "/") {
        log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
      }
    });
    next();
  });
  registerRoutes(app);
  app.use(errorHandler);
  const port = parseInt(process.env.PORT ?? "5000", 10);
  if (isProd) {
    const distPath = path2.resolve(process.cwd(), "dist/public");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("/{*splat}", (_req, res) => {
        res.sendFile(path2.resolve(distPath, "index.html"));
      });
    } else {
      log("WARNING: dist/public not found \u2014 no static files to serve");
    }
    app.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port}`);
    });
    const proxyPort = 8081;
    if (proxyPort !== port) {
      const proxyServer = app.listen(proxyPort, "0.0.0.0", () => {
        log(`Server also listening on port ${proxyPort} (proxy)`);
      });
      proxyServer.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          log(`Port ${proxyPort} already in use \u2014 skipping proxy listener`);
        } else {
          throw err;
        }
      });
    }
  } else {
    const { createServer: createHttpServer } = await import("http");
    const httpServer = createHttpServer(app);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: { server: httpServer }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
    httpServer.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port}`);
    });
    const proxyPort = 8081;
    if (proxyPort !== port) {
      const httpServer2 = createHttpServer(app);
      httpServer2.listen(proxyPort, "0.0.0.0", () => {
        log(`Server also listening on port ${proxyPort} (proxy)`);
      });
      httpServer2.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          log(`Port ${proxyPort} already in use \u2014 skipping proxy listener`);
        } else {
          throw err;
        }
      });
    }
  }
})();
