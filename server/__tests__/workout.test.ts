/**
 * Integration tests for the end-to-end workout flow:
 *   signup → create plan → start session → log sets → finish → history
 *
 * DB_PATH=":memory:" is injected by vitest.config.ts — no mocking needed.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { initDb } from "../db";
import { registerRoutes } from "../routes/index";
import { errorHandler } from "../middleware/errorHandler";

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
initDb();
registerRoutes(app);
app.use(errorHandler);

// ── Shared state (populated as tests run in order) ────────────────────────────
let token = "";
let planId = 0;
let sessionId = 0;
let exerciseId = 0;

// ── 1. Signup ──────────────────────────────────────────────────────────────────
describe("1. Signup", () => {
  it("creates an account and returns a JWT", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      username: "trainer",
      email: "trainer@gym.com",
      password: "securepass1",
    });
    expect(res.status).toBe(201);
    token = res.body.token as string;
    expect(token).toBeTruthy();
  });
});

// ── 2. Exercises ───────────────────────────────────────────────────────────────
describe("2. Fetch exercises", () => {
  it("returns the seeded exercise catalogue", async () => {
    const res = await request(app).get("/api/exercises");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    exerciseId = res.body[0].id as number;
  });
});

// ── 3. Create plan ─────────────────────────────────────────────────────────────
describe("3. Create a workout plan", () => {
  it("creates a plan owned by the authenticated user", async () => {
    const res = await request(app)
      .post("/api/plans")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Push Day",
        exercises: [
          { exercise_id: exerciseId, default_sets: 3, default_reps: 10, default_weight: 60 },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Push Day");
    expect(res.body.exercises).toHaveLength(1);
    planId = res.body.id as number;
  });

  it("lists only this user's plans when authenticated", async () => {
    const res = await request(app)
      .get("/api/plans")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe("Push Day");
  });
});

// ── 4. Start session ───────────────────────────────────────────────────────────
describe("4. Start a workout session", () => {
  it("creates a session linked to the plan", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan_id: planId });
    expect(res.status).toBe(200);
    expect(res.body.plan_id).toBe(planId);
    sessionId = res.body.id as number;
  });
});

// ── 5. Log sets ────────────────────────────────────────────────────────────────
describe("5. Log sets", () => {
  it("logs three sets successfully", async () => {
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post("/api/sets")
        .set("Authorization", `Bearer ${token}`)
        .send({ session_id: sessionId, exercise_id: exerciseId, set_number: i, weight: 60, reps: 10 });
      expect(res.status).toBe(200);
      expect(res.body.set_number).toBe(i);
    }
  });

  it("rejects a set with missing required fields with 400", async () => {
    const res = await request(app)
      .post("/api/sets")
      .set("Authorization", `Bearer ${token}`)
      .send({ session_id: sessionId }); // missing exercise_id, weight, reps
    expect(res.status).toBe(400);
  });
});

// ── 6. Finish session ──────────────────────────────────────────────────────────
describe("6. Finish the session", () => {
  it("marks the session complete with RPE and notes", async () => {
    const res = await request(app)
      .put(`/api/sessions/${sessionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ finished_at: new Date().toISOString(), rpe: 7, notes: "Felt strong" });
    expect(res.status).toBe(200);
    expect(res.body.finished_at).toBeTruthy();
    expect(res.body.rpe).toBe(7);
  });
});

// ── 7. Workout history ─────────────────────────────────────────────────────────
describe("7. Workout history", () => {
  it("returns the finished session with sets and computed volume", async () => {
    const res = await request(app)
      .get("/api/sessions/history")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    const session = res.body.find((s: { id: number }) => s.id === sessionId);
    expect(session).toBeDefined();
    expect(session.sets).toHaveLength(3);
    expect(session.totalVolume).toBe(60 * 10 * 3); // 1800 kg
    expect(session.duration).toBeGreaterThanOrEqual(0);
  });

  it("rejects unauthenticated history requests with 401", async () => {
    const res = await request(app).get("/api/sessions/history");
    expect(res.status).toBe(401);
  });
});
