/**
 * Integration tests for auth endpoints.
 *
 * DB_PATH=":memory:" and JWT_SECRET are injected by vitest.config.ts,
 * so no mocking is needed — each test file gets its own in-memory database.
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

// ── Shared state ──────────────────────────────────────────────────────────────
const ALICE = { username: "alice", email: "alice@example.com", password: "password123" };
let token = "";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auth/signup", () => {
  it("creates a new user and returns a token", async () => {
    const res = await request(app).post("/api/auth/signup").send(ALICE);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toMatchObject({ username: "alice", email: "alice@example.com" });
    expect(res.body.user).not.toHaveProperty("password_hash");
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await request(app).post("/api/auth/signup").send(ALICE);
    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty("error");
  });

  it("rejects a password shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ username: "bob", email: "bob@example.com", password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects missing username", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "x@x.com", password: "password123" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("returns a token for valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: ALICE.password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    token = res.body.token as string;
  });

  it("rejects a wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: ALICE.email, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown email with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns user info for a valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("username", "alice");
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with an invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer totally.invalid.token");
    expect(res.status).toBe(401);
  });
});
