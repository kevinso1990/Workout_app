/**
 * Integration tests for native → server structured session ingest.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import db, { initDb } from "../db";
import { registerRoutes } from "../routes/index";
import { errorHandler } from "../middleware/errorHandler";
import {
  ingestMobileSession,
  __testSimulatePartialIngestFailure,
} from "../services/mobileSessionIngestService";

const app = express();
app.use(express.json());
initDb();
registerRoutes(app);
app.use(errorHandler);

const STRENGTH_PAYLOAD = {
  id: "local-session-ingest-1",
  planId: "local-plan-ingest-abc",
  planName: "Push Pull Legs",
  dayName: "Push",
  completedAt: "2026-06-01T12:00:00.000Z",
  duration: 45,
  exercises: [{ id: "ex1", name: "Barbell Bench Press" }],
  exerciseProgress: [
    {
      exerciseId: "ex1",
      sets: [
        { weight: "60", reps: "10", completed: true, rating: "green" },
        { weight: "60", reps: "8", completed: true, rating: "yellow" },
      ],
    },
  ],
};

function ensureTestUser(userId: number): void {
  db.prepare(
    `INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, 'test')`,
  ).run(userId, `user${userId}@example.com`);
}

describe("mobileSessionIngestService", () => {
  beforeAll(() => {
    ensureTestUser(42);
    ensureTestUser(77);
    ensureTestUser(99);
  });
  it("ingests a strength session into structured tables (idempotent)", () => {
    const userId = 42;
    const first = ingestMobileSession(userId, STRENGTH_PAYLOAD);
    const second = ingestMobileSession(userId, STRENGTH_PAYLOAD);

    expect(first).toBeTypeOf("number");
    expect(second).toBe(first);

    const setCount = db
      .prepare("SELECT COUNT(*) as c FROM sets WHERE session_id = ?")
      .get(first!) as { c: number };
    expect(setCount.c).toBe(2);
  });

  it("rolls back on mid-ingest failure — no orphan session row", () => {
    const userId = 99;
    const payload = {
      ...STRENGTH_PAYLOAD,
      id: "partial-fail-session",
      planId: "partial-fail-plan",
    };

    expect(() => __testSimulatePartialIngestFailure(userId, payload)).toThrow();

    const sessionRow = db
      .prepare(
        "SELECT id FROM sessions WHERE local_session_id = ? LIMIT 1",
      )
      .get("partial-fail-session");
    expect(sessionRow).toBeUndefined();

    const sessionId = ingestMobileSession(userId, payload);
    expect(sessionId).toBeGreaterThan(0);

    const after = db
      .prepare("SELECT COUNT(*) as c FROM sets WHERE session_id = ?")
      .get(sessionId) as { c: number };
    expect(after.c).toBe(2);
  });

  it("repairs a session row that exists with zero sets", () => {
    const userId = 77;
    const payload = {
      ...STRENGTH_PAYLOAD,
      id: "repair-zero-sets",
      planId: "repair-plan",
    };

    db.prepare(
      `INSERT INTO plans (name, user_id, local_plan_id) VALUES ('Repair', ?, ?)`,
    ).run(userId, payload.planId);
    const plan = db
      .prepare("SELECT id FROM plans WHERE local_plan_id = ?")
      .get(payload.planId) as { id: number };

    const ins = db
      .prepare(
        `INSERT INTO sessions (plan_id, user_id, started_at, finished_at, local_session_id, workout_type)
         VALUES (?, ?, datetime('now'), ?, ?, 'strength')`,
      )
      .run(plan.id, userId, payload.completedAt, payload.id);
    const orphanSessionId = Number(ins.lastInsertRowid);

    const before = db
      .prepare("SELECT COUNT(*) as c FROM sets WHERE session_id = ?")
      .get(orphanSessionId) as { c: number };
    expect(before.c).toBe(0);

    const repairedId = ingestMobileSession(userId, payload);
    expect(repairedId).toBe(orphanSessionId);

    const after = db
      .prepare("SELECT COUNT(*) as c FROM sets WHERE session_id = ?")
      .get(orphanSessionId) as { c: number };
    expect(after.c).toBe(2);
  });
});

describe("POST /api/sessions/sync-local structured ingest", () => {
  let token: string;

  beforeAll(async () => {
    const guest = await request(app)
      .post("/api/auth/guest")
      .set("x-device-id", "ingest-test-device")
      .send();
    token = guest.body.token as string;
  });

  it("returns ingestComplete true and persists sets", async () => {
    const res = await request(app)
      .post("/api/sessions/sync-local")
      .set("Authorization", `Bearer ${token}`)
      .set("x-device-id", "ingest-test-device")
      .send({
        session: {
          id: "sync-route-session-2",
          planId: "sync-route-plan-2",
          planName: "Test Plan",
          dayName: "Day A",
          completedAt: "2026-06-02T10:00:00.000Z",
          duration: 30,
          exercises: [{ id: "e1", name: "Barbell Squat" }],
          exerciseProgress: [
            {
              exerciseId: "e1",
              sets: [{ weight: "100", reps: "5", completed: true }],
            },
          ],
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.ingestComplete).toBe(true);
    expect(res.body.serverSessionId).toBeGreaterThan(0);

    const row = db
      .prepare(
        "SELECT id FROM sessions WHERE local_session_id = ? LIMIT 1",
      )
      .get("sync-route-session-2") as { id: number } | undefined;
    expect(row?.id).toBeGreaterThan(0);

    const sets = db
      .prepare("SELECT COUNT(*) as c FROM sets WHERE session_id = ?")
      .get(row!.id) as { c: number };
    expect(sets.c).toBe(1);
  });
});
