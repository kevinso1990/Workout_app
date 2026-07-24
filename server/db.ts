import Database from "better-sqlite3";
import path from "path";

// Allow tests to inject ":memory:" via DB_PATH env var
const DB_PATH = process.env.DB_PATH ?? path.resolve(process.cwd(), "workout.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
// Wait up to 5s for a lock instead of immediately throwing SQLITE_BUSY.
// Essential when multiple concurrent requests hit the same WAL DB.
db.pragma("busy_timeout = 5000");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      muscle_group TEXT NOT NULL,
      equipment TEXT DEFAULT 'barbell',
      is_custom INTEGER DEFAULT 0
    );

    -- Localized exercise labels. The canonical English name stays in
    -- exercises.name (used for matching/history/imports); this table only
    -- supplies the rendered label per language.
    CREATE TABLE IF NOT EXISTS exercise_translations (
      exercise_id INTEGER NOT NULL,
      lang TEXT NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (exercise_id, lang),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
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
  migrateVotes();
  migrateSplitRefresh();
  migrateSubscriptions();
  migrateIndices();
  migrateMobileWorkoutSync();
  migrateLocalSyncIds();
  migrateExerciseCatalogExpansion();
  migrateHybridAthlete();
}

/** Links native AsyncStorage plan/session ids to structured SQLite rows. */
function migrateLocalSyncIds() {
  try {
    db.exec("ALTER TABLE plans ADD COLUMN local_plan_id TEXT");
  } catch {}
  try {
    db.exec("ALTER TABLE sessions ADD COLUMN local_session_id TEXT");
  } catch {}
  try {
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_user_local_plan ON plans(user_id, local_plan_id) WHERE local_plan_id IS NOT NULL",
    );
  } catch {}
  try {
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_local_session ON sessions(local_session_id) WHERE local_session_id IS NOT NULL",
    );
  } catch {}
}

/** Cardio / hybrid athlete sessions — sport metadata on sessions table. */
function migrateHybridAthlete() {
  const cols = db.prepare("PRAGMA table_info(sessions)").all() as { name: string }[];
  const has = (name: string) => cols.some((c) => c.name === name);

  if (!has("workout_type")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN workout_type TEXT NOT NULL DEFAULT 'strength'`);
  }
  if (!has("sport_type")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN sport_type TEXT`);
  }
  if (!has("duration_minutes")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN duration_minutes INTEGER`);
  }
  if (!has("distance_km")) {
    db.exec(`ALTER TABLE sessions ADD COLUMN distance_km REAL`);
  }

  const existing = db
    .prepare("SELECT id FROM plans WHERE name = ? LIMIT 1")
    .get("__cardio_system__") as { id: number } | undefined;
  if (!existing) {
    db.prepare("INSERT INTO plans (name) VALUES (?)").run("__cardio_system__");
  }
}

/**
 * Idempotent catalog top-up (INSERT OR IGNORE) that runs on EVERY startup.
 *
 * The original `seedExercises()` only fires on a brand-new (empty) DB, so
 * production databases seeded long ago never received newer basics. This
 * migration guarantees common dumbbell / kettlebell / trap-bar / bodyweight
 * variations exist so the PDF importer's name-matcher can map real plans.
 *
 * Kettlebell movements are added under BOTH the short "KB ..." names (used by
 * the generator) and the fully spelled "Kettlebell ..." names (what users and
 * PDFs actually write) so the importer matches either form exactly.
 */
function migrateExerciseCatalogExpansion() {
  const additions: [string, string, string][] = [
    // ── Dumbbell variations ─────────────────────────────────────────────
    ["Dumbbell Lunges", "Legs", "dumbbell"],
    ["Dumbbell Reverse Lunge", "Legs", "dumbbell"],
    ["Dumbbell Walking Lunge", "Legs", "dumbbell"],
    ["Dumbbell Romanian Deadlift", "Legs", "dumbbell"],
    ["Dumbbell Step Up", "Legs", "dumbbell"],
    ["Dumbbell Bulgarian Split Squat", "Legs", "dumbbell"],
    ["Dumbbell Squat", "Legs", "dumbbell"],
    ["Dumbbell Floor Press", "Chest", "dumbbell"],
    ["Dumbbell Pullover", "Back", "dumbbell"],
    ["Dumbbell Thruster", "Shoulders", "dumbbell"],
    ["Dumbbell Push Press", "Shoulders", "dumbbell"],
    ["Dumbbell Deadlift", "Legs", "dumbbell"],
    ["Dumbbell Calf Raise", "Legs", "dumbbell"],

    // ── Trap-bar / hex-bar ──────────────────────────────────────────────
    ["Trap Bar Deadlift", "Back", "barbell"],
    ["Trap Bar Squat", "Legs", "barbell"],
    ["Hex Bar Deadlift", "Back", "barbell"],

    // ── Reverse / lunge family ──────────────────────────────────────────
    ["Reverse Lunge", "Legs", "dumbbell"],
    ["Barbell Reverse Lunge", "Legs", "barbell"],
    ["Lunges", "Legs", "dumbbell"],
    ["Curtsy Lunge", "Legs", "dumbbell"],

    // ── Kettlebell — fully spelled names (PDF/user wording) ─────────────
    ["Kettlebell Swing", "Legs", "kettlebell"],
    ["Kettlebell Goblet Squat", "Legs", "kettlebell"],
    ["Kettlebell Front Squat", "Legs", "kettlebell"],
    ["Kettlebell Romanian Deadlift", "Legs", "kettlebell"],
    ["Kettlebell Deadlift", "Legs", "kettlebell"],
    ["Kettlebell Lunge", "Legs", "kettlebell"],
    ["Kettlebell Reverse Lunge", "Legs", "kettlebell"],
    ["Kettlebell Bulgarian Split Squat", "Legs", "kettlebell"],
    ["Kettlebell Press", "Shoulders", "kettlebell"],
    ["Kettlebell Push Press", "Shoulders", "kettlebell"],
    ["Kettlebell Lateral Raise", "Shoulders", "kettlebell"],
    ["Kettlebell Halo", "Shoulders", "kettlebell"],
    ["Kettlebell Floor Press", "Chest", "kettlebell"],
    ["Kettlebell Row", "Back", "kettlebell"],
    ["Kettlebell Renegade Row", "Back", "kettlebell"],
    ["Kettlebell High Pull", "Back", "kettlebell"],
    ["Kettlebell Clean", "Back", "kettlebell"],
    ["Kettlebell Clean and Press", "Shoulders", "kettlebell"],
    ["Kettlebell Snatch", "Back", "kettlebell"],
    ["Kettlebell Thruster", "Shoulders", "kettlebell"],
    ["Kettlebell Curl", "Biceps", "kettlebell"],
    ["Kettlebell Turkish Get-Up", "Core", "kettlebell"],
    ["Kettlebell Windmill", "Core", "kettlebell"],
    ["Kettlebell Russian Twist", "Core", "kettlebell"],
    ["Kettlebell Farmer's Walk", "Traps", "kettlebell"],

    // ── Bodyweight / calisthenics ───────────────────────────────────────
    ["Pike Push-Ups", "Shoulders", "bodyweight"],
    ["Wide Grip Push-Ups", "Chest", "bodyweight"],
    ["Incline Push-Ups", "Chest", "bodyweight"],
    ["Decline Push-Ups", "Chest", "bodyweight"],
    ["Pseudo Planche Push-Ups", "Chest", "bodyweight"],
    ["Pistol Squat", "Legs", "bodyweight"],
    ["Bodyweight Squat", "Legs", "bodyweight"],
    ["Jump Squat", "Legs", "bodyweight"],
    ["Box Jump", "Legs", "bodyweight"],
    ["Bodyweight Lunges", "Legs", "bodyweight"],
    ["Bodyweight Reverse Lunge", "Legs", "bodyweight"],
    ["Inverted Row", "Back", "bodyweight"],
    ["Australian Pull-Ups", "Back", "bodyweight"],
    ["Nordic Hamstring Curl", "Legs", "bodyweight"],
    ["Glute Ham Raise", "Legs", "bodyweight"],
    ["Calf Raise", "Legs", "bodyweight"],
    ["Superman", "Back", "bodyweight"],
    ["Bird Dog", "Core", "bodyweight"],
    ["Hollow Hold", "Core", "bodyweight"],
    ["Flutter Kicks", "Core", "bodyweight"],
    ["Leg Raises", "Core", "bodyweight"],
    ["Lying Leg Raises", "Core", "bodyweight"],
    ["Bicycle Crunches", "Core", "bodyweight"],
    ["V-Ups", "Core", "bodyweight"],
    ["L-Sit", "Core", "bodyweight"],
    ["Wall Sit", "Legs", "bodyweight"],
    ["Bear Crawl", "Core", "bodyweight"],
    ["Jumping Jacks", "Full Body", "bodyweight"],
    ["High Knees", "Full Body", "bodyweight"],
    ["Burpees", "Full Body", "bodyweight"],

    // ── Unilateral / positional variations (kneeling, single-arm, seated) ─
    ["Single-Arm Kettlebell Shoulder Press", "Shoulders", "kettlebell"],
    ["Kneeling Single-Arm Kettlebell Press", "Shoulders", "kettlebell"],
    ["Half-Kneeling Kettlebell Press", "Shoulders", "kettlebell"],
    ["Tall Kneeling Kettlebell Press", "Shoulders", "kettlebell"],
    ["Seated Kettlebell Shoulder Press", "Shoulders", "kettlebell"],
    ["Kettlebell Bottoms-Up Press", "Shoulders", "kettlebell"],
    ["Single-Arm Kettlebell Swing", "Legs", "kettlebell"],
    ["Single-Arm Kettlebell Clean", "Back", "kettlebell"],
    ["Single-Arm Kettlebell Clean and Press", "Shoulders", "kettlebell"],
    ["Single-Arm Kettlebell Row", "Back", "kettlebell"],
    ["Double Kettlebell Front Squat", "Legs", "kettlebell"],
    ["Kettlebell Goblet Reverse Lunge", "Legs", "kettlebell"],
    ["Kettlebell Suitcase Carry", "Core", "kettlebell"],
    ["Single-Arm Dumbbell Shoulder Press", "Shoulders", "dumbbell"],
    ["Kneeling Dumbbell Shoulder Press", "Shoulders", "dumbbell"],
    ["Half-Kneeling Dumbbell Press", "Shoulders", "dumbbell"],
    ["Tall Kneeling Dumbbell Press", "Shoulders", "dumbbell"],
    ["Seated Dumbbell Shoulder Press", "Shoulders", "dumbbell"],
    ["Single-Arm Dumbbell Row", "Back", "dumbbell"],
    ["Single-Arm Dumbbell Floor Press", "Chest", "dumbbell"],
    ["Half-Kneeling Landmine Press", "Shoulders", "barbell"],
    ["Tall Kneeling Landmine Press", "Shoulders", "barbell"],
    ["Single-Arm Landmine Row", "Back", "barbell"],

    // ── Conditioning / full body ────────────────────────────────────────
    ["Thrusters", "Full Body", "barbell"],
    ["Clean and Press", "Full Body", "barbell"],
    ["Power Clean", "Full Body", "barbell"],
    ["Battle Ropes", "Full Body", "other"],
    ["Wall Balls", "Full Body", "other"],
    ["Sled Push", "Legs", "other"],
  ];

  const insert = db.prepare(
    "INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, is_custom) VALUES (?, ?, ?, 0)",
  );
  const tx = db.transaction(() => {
    for (const [name, group, equip] of additions) {
      insert.run(name, group, equip);
    }
  });
  tx();
}

/** Offline-first mobile exports (JSON) for background sync from the native app. */
function migrateMobileWorkoutSync() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mobile_workout_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      local_session_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      synced_at TEXT DEFAULT (datetime('now')),
      UNIQUE(local_session_id)
    );
  `);
  try {
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_mobile_sync_user ON mobile_workout_sync(user_id)",
    );
  } catch {}
}

/**
 * Adds performance indices that were missing from the original schema.
 * All are CREATE IF NOT EXISTS — safe to run on every startup.
 *
 * sets.session_id        — fetched on every session detail load and fatigue calc
 * plan_exercises.plan_id — fetched on every plan load / active workout start
 */
function migrateIndices() {
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_sets_session ON sets(session_id)"); } catch {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_plan_exercises_plan ON plan_exercises(plan_id)"); } catch {}
}

function migrateVotes() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercise_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      exercise_id INTEGER NOT NULL,
      vote INTEGER NOT NULL CHECK(vote IN (-1, 1)),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(device_id, exercise_id),
      FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE
    );
  `);
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_votes_device ON exercise_votes(device_id)"); } catch {}
}

function migrateSplitRefresh() {
  // Tracks when we last prompted a user to refresh their split (per device)
  db.exec(`
    CREATE TABLE IF NOT EXISTS split_refresh_snooze (
      device_id TEXT PRIMARY KEY,
      snoozed_until TEXT NOT NULL
    );
  `);
}

function migrateSubscriptions() {
  // Add subscription columns to existing users table (safe: try/catch each ALTER)
  try { db.exec("ALTER TABLE users ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN subscription_provider TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN subscription_expires_at TEXT"); } catch {}

  // Tracks validated receipts/tokens from Apple and Google
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('apple', 'google')),
      original_transaction_id TEXT NOT NULL,
      product_id TEXT,
      expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'cancelled', 'refunded')),
      raw_response TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, provider, original_transaction_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_receipts_user ON subscription_receipts(user_id)"); } catch {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_receipts_txn ON subscription_receipts(original_transaction_id)"); } catch {}
}

function migrateAuth() {
  // users table — original shape (preserved for rows that may already exist)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // OAuth columns — added to existing users table for the Google/Apple-only model
  try { db.exec("ALTER TABLE users ADD COLUMN name TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN provider TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN provider_id TEXT"); } catch {}

  // Legacy DBs may have been created with `username TEXT NOT NULL UNIQUE` and
  // `password_hash TEXT NOT NULL`. Now that auth is OAuth-only, both columns are
  // optional. SQLite can't ALTER a column's NOT NULL in place, so we detect the
  // condition and rebuild the table once. Idempotent: subsequent boots skip it.
  const usersDdl = (
    db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as
      | { sql: string }
      | undefined
  )?.sql ?? "";
  const needsRebuild =
    /username\s+TEXT\s+NOT\s+NULL/i.test(usersDdl) ||
    /password_hash\s+TEXT\s+NOT\s+NULL/i.test(usersDdl);
  if (needsRebuild) {
    // Only copy columns that actually exist on the legacy table — older DBs
    // may predate subscription_*, name, avatar_url, provider, provider_id.
    const legacyCols = new Set(
      (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name),
    );
    const allCols = [
      "id", "username", "email", "password_hash", "created_at",
      "subscription_tier", "subscription_provider", "subscription_expires_at",
      "name", "avatar_url", "provider", "provider_id",
    ];
    const copyCols = allCols.filter((c) => legacyCols.has(c));

    db.exec("BEGIN");
    try {
      db.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          subscription_tier TEXT NOT NULL DEFAULT 'free',
          subscription_provider TEXT,
          subscription_expires_at TEXT,
          name TEXT,
          avatar_url TEXT,
          provider TEXT,
          provider_id TEXT
        );
      `);
      db.exec(
        `INSERT INTO users_new (${copyCols.join(", ")})
         SELECT ${copyCols.join(", ")} FROM users;`,
      );
      db.exec("DROP TABLE users");
      db.exec("ALTER TABLE users_new RENAME TO users");
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }

  // Each (provider, provider_id) tuple maps to exactly one user
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_provider_pid ON users(provider, provider_id)");
  } catch {}

  // user_id on every domain table so queries can scope to the owner.
  // All nullable so legacy rows from before auth still load.
  try { db.exec("ALTER TABLE plans ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"); } catch {}
  try { db.exec("ALTER TABLE sessions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"); } catch {}
  try { db.exec("ALTER TABLE sets ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"); } catch {}
  try { db.exec("ALTER TABLE body_weight ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"); } catch {}
  try { db.exec("ALTER TABLE exercise_feedback ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"); } catch {}
  try { db.exec("ALTER TABLE muscle_fatigue ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"); } catch {}

  // Indices on every user_id column — scoping every query is the most common access pattern
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_plans_user ON plans(user_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_sets_user ON sets(user_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_body_weight_user ON body_weight(user_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_exercise_feedback_user ON exercise_feedback(user_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_muscle_fatigue_user ON muscle_fatigue(user_id)");
  } catch {}
}

function migrateSupersetsDropSets() {
  try {
    db.exec("ALTER TABLE plan_exercises ADD COLUMN superset_group INTEGER");
  } catch {}
  try {
    db.exec("ALTER TABLE sets ADD COLUMN is_drop_set INTEGER DEFAULT 0");
  } catch {}
  try {
    db.exec("ALTER TABLE sets ADD COLUMN parent_set_id INTEGER REFERENCES sets(id) ON DELETE SET NULL");
  } catch {}
  try {
    db.exec("ALTER TABLE sets ADD COLUMN rir INTEGER");
  } catch {}
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_muscle_fatigue_session_muscle ON muscle_fatigue(session_id, muscle_group)");
  } catch {}
  try {
    db.exec("ALTER TABLE exercises ADD COLUMN gif_url TEXT");
  } catch {}
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
    ["Dead Hang", "Back", "bodyweight"],
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
    ["Kettlebell Shoulder Press", "Shoulders", "kettlebell"],
    ["Kettlebell Front Rack Squat", "Legs", "kettlebell"],
    ["Kettlebell Single-Arm Row", "Back", "kettlebell"],
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
  } catch {}

  db.prepare("UPDATE exercises SET equipment = 'dumbbell' WHERE name LIKE '%Dumbbell%' OR name LIKE 'Incline Dumbbell%'").run();
  db.prepare("UPDATE exercises SET equipment = 'cable' WHERE name LIKE 'Cable%' OR name IN ('Lat Pulldown','Wide Grip Lat Pulldown','Straight Arm Pulldown','Bayesian Curl','Face Pull','Pallof Press','Woodchoppers','Tricep Pushdown','Seated Cable Row')").run();
  db.prepare("UPDATE exercises SET equipment = 'machine' WHERE name LIKE 'Machine%' OR name IN ('Pec Deck','Hack Squat','Leg Press','Leg Extension','Leg Curl','Seated Leg Curl','Standing Calf Raise','Seated Calf Raise','Leg Press Calf Raise')").run();
  db.prepare("UPDATE exercises SET equipment = 'bodyweight' WHERE name IN ('Push-Ups','Pull-Ups','Chin-Ups','Chest Dips','Tricep Dips','Diamond Push-Ups','Plank','Side Plank','Crunches','Russian Twist','Hanging Leg Raise','Ab Wheel Rollout','Mountain Climbers','Dead Bug','Sit-Ups','Decline Sit-Ups','Dragon Flag','Hyperextension','Glute Bridge','Sissy Squat','Plate Pinch')").run();
  db.prepare("UPDATE exercises SET equipment = 'dumbbell' WHERE name IN ('Arnold Press','Lateral Raise','Front Raise','Rear Delt Fly','Goblet Squat','Bulgarian Split Squat','Walking Lunges','Reverse Lunges','Step Ups','Hammer Curl','Concentration Curl','Spider Curl','Overhead Tricep Extension','Tricep Kickback','Chest Supported Row')").run();

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
    ["Kettlebell Shoulder Press", "Shoulders"],
    ["Kettlebell Front Rack Squat", "Legs"],
    ["Kettlebell Single-Arm Row", "Back"],
  ];

  const insert = db.prepare("INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, is_custom) VALUES (?, ?, 'kettlebell', 0)");
  const tx = db.transaction(() => {
    for (const [name, group] of kbExercises) {
      insert.run(name, group);
    }
  });
  tx();
}

export default db;
