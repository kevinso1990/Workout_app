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
  if (count.c > 0) {
    seedKettlebellExercises();
    return;
  }

  const exercises: [string, string, string][] = [
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
    ["KB Farmer's Walk", "Traps", "kettlebell"],
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
  const kbExercises: [string, string][] = [
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
    ["KB Farmer's Walk", "Traps"],
  ];

  const insert = db.prepare("INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, is_custom) VALUES (?, ?, 'kettlebell', 0)");
  const tx = db.transaction(() => {
    for (const [name, group] of kbExercises) {
      insert.run(name, group);
    }
  });
  tx();

  try {
    db.exec("ALTER TABLE exercises ADD COLUMN equipment TEXT DEFAULT 'barbell'");
  } catch {}

  const updateMap: Record<string, string> = {
    dumbbell: "Dumbbell%",
    cable: "Cable%",
    machine: "Machine%",
    bodyweight: "Push-Ups,Pull-Ups,Chin-Ups,Chest Dips,Tricep Dips,Diamond Push-Ups,Plank,Side Plank,Crunches,Russian Twist,Hanging Leg Raise,Ab Wheel Rollout,Mountain Climbers,Dead Bug,Sit-Ups,Decline Sit-Ups,Dragon Flag,Hyperextension,Glute Bridge,Sissy Squat,Plate Pinch",
  };
  db.prepare("UPDATE exercises SET equipment = 'dumbbell' WHERE name LIKE 'Dumbbell%' OR name LIKE 'Incline Dumbbell%' OR name LIKE '%Dumbbell%'").run();
  db.prepare("UPDATE exercises SET equipment = 'cable' WHERE name LIKE 'Cable%' OR name LIKE 'Lat Pulldown' OR name LIKE 'Wide Grip Lat Pulldown' OR name LIKE 'Straight Arm Pulldown' OR name LIKE 'Bayesian Curl' OR name LIKE 'Face Pull' OR name LIKE 'Pallof Press' OR name LIKE 'Woodchoppers' OR name LIKE 'Tricep Pushdown' OR name LIKE 'Cable%' OR name LIKE 'Seated Cable Row'").run();
  db.prepare("UPDATE exercises SET equipment = 'machine' WHERE name LIKE 'Machine%' OR name LIKE 'Pec Deck' OR name LIKE 'Hack Squat' OR name LIKE 'Leg Press%' OR name LIKE 'Leg Extension' OR name LIKE 'Leg Curl' OR name LIKE 'Seated Leg Curl' OR name LIKE 'Standing Calf Raise' OR name LIKE 'Seated Calf Raise'").run();
  db.prepare("UPDATE exercises SET equipment = 'bodyweight' WHERE name IN ('Push-Ups','Pull-Ups','Chin-Ups','Chest Dips','Tricep Dips','Diamond Push-Ups','Plank','Side Plank','Crunches','Russian Twist','Hanging Leg Raise','Ab Wheel Rollout','Mountain Climbers','Dead Bug','Sit-Ups','Decline Sit-Ups','Dragon Flag','Hyperextension','Glute Bridge','Sissy Squat','Plate Pinch')").run();
  db.prepare("UPDATE exercises SET equipment = 'kettlebell' WHERE name LIKE 'KB %'").run();
  db.prepare("UPDATE exercises SET equipment = 'dumbbell' WHERE name IN ('Arnold Press','Lateral Raise','Front Raise','Rear Delt Fly','Goblet Squat','Bulgarian Split Squat','Walking Lunges','Reverse Lunges','Step Ups','Hammer Curl','Concentration Curl','Spider Curl','Overhead Tricep Extension','Tricep Kickback','Chest Supported Row')").run();
}

export default db;
