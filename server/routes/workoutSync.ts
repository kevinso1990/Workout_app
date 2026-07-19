import { Router, type Request, type Response } from "express";
import db from "../db";

/**
 * Anonymous, password-free cloud backup for the web/native client.
 *
 * A client generates a random `userId` (UUID) on first launch and stores it
 * locally. We key all backup data by that id — no accounts, no passwords.
 * This is a pragmatic safety net against local storage being cleared, NOT a
 * full multi-user auth system.
 *
 * Table is created here (self-contained) so this route can be dropped in
 * without touching the shared schema migrations.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS device_cloud_sync (
    user_id TEXT PRIMARY KEY,
    workout_history TEXT NOT NULL DEFAULT '[]',
    snapshot TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

const router = Router();

// Accept UUIDs and similar opaque client ids; reject anything weird.
const VALID_ID = /^[A-Za-z0-9_-]{8,128}$/;

type SyncRow = {
  workout_history: string;
  snapshot: string | null;
  updated_at: string;
};

/**
 * POST /api/workouts/sync
 * Body: { userId, workoutHistory: [], currentPlan?: any }
 * Upserts the full backup for this device id.
 */
router.post("/sync", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    userId?: unknown;
    workoutHistory?: unknown;
    currentPlan?: unknown;
  };
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";

  if (!VALID_ID.test(userId)) {
    res.status(400).json({ error: "valid userId required" });
    return;
  }
  if (!Array.isArray(body.workoutHistory)) {
    res.status(400).json({ error: "workoutHistory must be an array" });
    return;
  }

  let historyJson: string;
  let snapshotJson: string | null;
  try {
    historyJson = JSON.stringify(body.workoutHistory);
    snapshotJson =
      body.currentPlan != null ? JSON.stringify(body.currentPlan) : null;
  } catch {
    res.status(400).json({ error: "payload not serialisable" });
    return;
  }

  // Guard against absurd payloads (≈5 MB) to protect the DB.
  if (historyJson.length + (snapshotJson?.length ?? 0) > 5_000_000) {
    res.status(413).json({ error: "backup too large" });
    return;
  }

  db.prepare(
    `INSERT INTO device_cloud_sync (user_id, workout_history, snapshot, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       workout_history = excluded.workout_history,
       snapshot        = excluded.snapshot,
       updated_at      = datetime('now')`,
  ).run(userId, historyJson, snapshotJson);

  res.json({
    ok: true,
    count: body.workoutHistory.length,
    updatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/workouts/sync/:userId
 * Returns the stored backup so a client with empty local storage can restore.
 */
router.get("/sync/:userId", (req: Request, res: Response) => {
  const userId =
    typeof req.params.userId === "string" ? req.params.userId.trim() : "";
  if (!VALID_ID.test(userId)) {
    res.status(400).json({ error: "valid userId required" });
    return;
  }

  const row = db
    .prepare(
      "SELECT workout_history, snapshot, updated_at FROM device_cloud_sync WHERE user_id = ?",
    )
    .get(userId) as SyncRow | undefined;

  if (!row) {
    res.json({ found: false, workoutHistory: [], currentPlan: null });
    return;
  }

  let workoutHistory: unknown = [];
  let currentPlan: unknown = null;
  try {
    workoutHistory = JSON.parse(row.workout_history);
  } catch {
    workoutHistory = [];
  }
  try {
    currentPlan = row.snapshot ? JSON.parse(row.snapshot) : null;
  } catch {
    currentPlan = null;
  }

  res.json({
    found: true,
    workoutHistory,
    currentPlan,
    updatedAt: row.updated_at,
  });
});

export default router;
