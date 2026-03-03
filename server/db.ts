import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "workout.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      muscle_group TEXT NOT NULL,
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
      logged_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
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
  `);

  seedExercises();
}

function seedExercises() {
  const count = db.prepare("SELECT COUNT(*) as c FROM exercises").get() as { c: number };
  if (count.c > 0) return;

  const exercises: [string, string][] = [
    ["Barbell Bench Press", "Chest"],
    ["Incline Barbell Bench Press", "Chest"],
    ["Decline Barbell Bench Press", "Chest"],
    ["Dumbbell Bench Press", "Chest"],
    ["Incline Dumbbell Press", "Chest"],
    ["Dumbbell Flyes", "Chest"],
    ["Cable Flyes", "Chest"],
    ["Machine Chest Press", "Chest"],
    ["Pec Deck", "Chest"],
    ["Push-Ups", "Chest"],
    ["Chest Dips", "Chest"],
    ["Landmine Press", "Chest"],

    ["Barbell Row", "Back"],
    ["Dumbbell Row", "Back"],
    ["Pendlay Row", "Back"],
    ["T-Bar Row", "Back"],
    ["Seated Cable Row", "Back"],
    ["Lat Pulldown", "Back"],
    ["Wide Grip Lat Pulldown", "Back"],
    ["Pull-Ups", "Back"],
    ["Chin-Ups", "Back"],
    ["Cable Pullover", "Back"],
    ["Straight Arm Pulldown", "Back"],
    ["Machine Row", "Back"],
    ["Meadows Row", "Back"],
    ["Chest Supported Row", "Back"],

    ["Overhead Press", "Shoulders"],
    ["Dumbbell Shoulder Press", "Shoulders"],
    ["Arnold Press", "Shoulders"],
    ["Lateral Raise", "Shoulders"],
    ["Cable Lateral Raise", "Shoulders"],
    ["Machine Lateral Raise", "Shoulders"],
    ["Front Raise", "Shoulders"],
    ["Rear Delt Fly", "Shoulders"],
    ["Face Pull", "Shoulders"],
    ["Upright Row", "Shoulders"],
    ["Behind The Neck Press", "Shoulders"],
    ["Machine Shoulder Press", "Shoulders"],

    ["Barbell Squat", "Legs"],
    ["Front Squat", "Legs"],
    ["Goblet Squat", "Legs"],
    ["Hack Squat", "Legs"],
    ["Leg Press", "Legs"],
    ["Leg Extension", "Legs"],
    ["Leg Curl", "Legs"],
    ["Seated Leg Curl", "Legs"],
    ["Romanian Deadlift", "Legs"],
    ["Stiff Leg Deadlift", "Legs"],
    ["Sumo Deadlift", "Legs"],
    ["Bulgarian Split Squat", "Legs"],
    ["Walking Lunges", "Legs"],
    ["Reverse Lunges", "Legs"],
    ["Hip Thrust", "Legs"],
    ["Glute Bridge", "Legs"],
    ["Step Ups", "Legs"],
    ["Sissy Squat", "Legs"],
    ["Leg Press Calf Raise", "Legs"],
    ["Standing Calf Raise", "Legs"],
    ["Seated Calf Raise", "Legs"],

    ["Deadlift", "Back"],
    ["Trap Bar Deadlift", "Back"],
    ["Rack Pull", "Back"],
    ["Good Morning", "Back"],
    ["Hyperextension", "Back"],

    ["Barbell Curl", "Biceps"],
    ["Dumbbell Curl", "Biceps"],
    ["Hammer Curl", "Biceps"],
    ["Preacher Curl", "Biceps"],
    ["Incline Dumbbell Curl", "Biceps"],
    ["Cable Curl", "Biceps"],
    ["Concentration Curl", "Biceps"],
    ["EZ-Bar Curl", "Biceps"],
    ["Spider Curl", "Biceps"],
    ["Bayesian Curl", "Biceps"],
    ["Reverse Curl", "Biceps"],

    ["Tricep Pushdown", "Triceps"],
    ["Overhead Tricep Extension", "Triceps"],
    ["Skull Crushers", "Triceps"],
    ["Close Grip Bench Press", "Triceps"],
    ["Tricep Dips", "Triceps"],
    ["Tricep Kickback", "Triceps"],
    ["Cable Overhead Extension", "Triceps"],
    ["Diamond Push-Ups", "Triceps"],
    ["JM Press", "Triceps"],

    ["Plank", "Core"],
    ["Side Plank", "Core"],
    ["Crunches", "Core"],
    ["Russian Twist", "Core"],
    ["Hanging Leg Raise", "Core"],
    ["Cable Crunch", "Core"],
    ["Ab Wheel Rollout", "Core"],
    ["Mountain Climbers", "Core"],
    ["Dead Bug", "Core"],
    ["Sit-Ups", "Core"],
    ["Pallof Press", "Core"],
    ["Woodchoppers", "Core"],
    ["Decline Sit-Ups", "Core"],
    ["Dragon Flag", "Core"],

    ["Barbell Shrug", "Traps"],
    ["Dumbbell Shrug", "Traps"],
    ["Farmer's Walk", "Traps"],

    ["Wrist Curl", "Forearms"],
    ["Reverse Wrist Curl", "Forearms"],
    ["Plate Pinch", "Forearms"],
  ];

  const insert = db.prepare("INSERT OR IGNORE INTO exercises (name, muscle_group, is_custom) VALUES (?, ?, 0)");
  const tx = db.transaction(() => {
    for (const [name, group] of exercises) {
      insert.run(name, group);
    }
  });
  tx();
}

export default db;
