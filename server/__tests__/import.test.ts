/**
 * Import-workout endpoint tests.
 *
 * The route uses Claude (primary) / Gemini (fallback), so we never call the real model in tests
 * — we verify (a) the input-validation contract, (b) the spreadsheet parser
 * helper, and (c) the auth posture (guests must be allowed since the native
 * onboarding flow doesn't mint a JWT).
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import * as XLSX from "xlsx";
import { initDb } from "../db";
import { registerRoutes } from "../routes/index";
import { errorHandler } from "../middleware/errorHandler";
import { spreadsheetToText } from "../routes/importWorkout";

const app = express();
// Photos + PDFs are sent base64-encoded inside JSON, so the route can balloon
// past the default 100kb body limit. Match the production server config.
app.use(express.json({ limit: "20mb" }));
initDb();
registerRoutes(app);
app.use(errorHandler);

describe("POST /api/import-workout — input validation", () => {
  it("rejects an empty body with 400", async () => {
    const res = await request(app).post("/api/import-workout").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no images/i);
  });

  it("does not require auth (guest-friendly endpoint)", async () => {
    // No Authorization header — must not 401. We expect a non-401 response,
    // even if the AI backend fails downstream (no key in test env).
    const res = await request(app).post("/api/import-workout").send({});
    expect(res.status).not.toBe(401);
  });

  it("rejects an unparseable spreadsheet payload with 400", async () => {
    const res = await request(app)
      .post("/api/import-workout")
      .send({ spreadsheet: { base64: "not-a-real-spreadsheet" } });
    // Either the xlsx parser throws (400) OR the parser returns no rows (also 400).
    expect(res.status).toBe(400);
  });
});

describe("spreadsheetToText helper", () => {
  it("renders each sheet as a labelled CSV block", () => {
    const wb = XLSX.utils.book_new();
    const sheetA = XLSX.utils.aoa_to_sheet([
      ["Day", "Exercise", "Sets", "Reps"],
      ["Day 1", "Squat", 3, 5],
      ["Day 1", "Bench Press", 3, 5],
    ]);
    const sheetB = XLSX.utils.aoa_to_sheet([
      ["Day", "Exercise", "Sets", "Reps"],
      ["Day 2", "Deadlift", 1, 5],
    ]);
    XLSX.utils.book_append_sheet(wb, sheetA, "Workout A");
    XLSX.utils.book_append_sheet(wb, sheetB, "Workout B");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const text = spreadsheetToText(buf.toString("base64"));

    expect(text).toContain("### Sheet: Workout A");
    expect(text).toContain("Squat");
    expect(text).toContain("Bench Press");
    expect(text).toContain("### Sheet: Workout B");
    expect(text).toContain("Deadlift");
  });

  it("handles a CSV-style single-sheet workbook", () => {
    const csv = "Day,Exercise,Sets,Reps\nMonday,Overhead Press,4,8\n";
    const wb = XLSX.read(csv, { type: "string" });
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const text = spreadsheetToText(buf.toString("base64"));
    expect(text).toContain("Overhead Press");
  });
});

describe("autoGenerate full body — frequency 2 produces A + B", () => {
  // Guard the planService change from T004 with a tiny smoke test so the
  // "same workout twice" regression can't sneak back in. We exercise the real
  // route end-to-end: mint a guest, request auto-generation, then list plans.

  async function bootstrapGuest(): Promise<{ token: string; deviceId: string }> {
    const deviceId = `import-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await request(app)
      .post("/api/auth/guest")
      .set("x-device-id", deviceId)
      .send({});
    expect(res.status).toBe(200);
    return { token: res.body.token as string, deviceId };
  }

  it("returns two distinct sessions for 2x/week full body", async () => {
    const { token, deviceId } = await bootstrapGuest();
    const gen = await request(app)
      .post("/api/plans/auto-generate")
      .set("Authorization", `Bearer ${token}`)
      .set("x-device-id", deviceId)
      .send({ frequency: 2, experience: "beginner", goal: "build_muscle", equipment: "barbell" });
    expect(gen.status).toBe(200);

    const list = await request(app)
      .get("/api/plans")
      .set("Authorization", `Bearer ${token}`)
      .set("x-device-id", deviceId);
    expect(list.status).toBe(200);
    const names = (list.body as Array<{ name: string }>).map((p) => p.name);
    expect(names).toContain("Full Body A");
    expect(names).toContain("Full Body B");

    const planA = (list.body as Array<{ name: string; exercises: Array<{ name: string }> }>).find(
      (p) => p.name === "Full Body A",
    )!;
    const planB = (list.body as Array<{ name: string; exercises: Array<{ name: string }> }>).find(
      (p) => p.name === "Full Body B",
    )!;
    const exA = new Set(planA.exercises.map((e) => e.name));
    const exB = new Set(planB.exercises.map((e) => e.name));
    // Sessions must differ on at least a couple of exercises — the whole point
    // of A/B is movement-pattern variety across the week.
    const overlap = [...exA].filter((n) => exB.has(n));
    expect(overlap.length).toBeLessThan(exA.size);
  });

  it("falls back to a single Full Body for frequency 1", async () => {
    const { token, deviceId } = await bootstrapGuest();
    const gen = await request(app)
      .post("/api/plans/auto-generate")
      .set("Authorization", `Bearer ${token}`)
      .set("x-device-id", deviceId)
      .send({ frequency: 1, experience: "beginner", goal: "build_muscle", equipment: "barbell" });
    expect(gen.status).toBe(200);

    const list = await request(app)
      .get("/api/plans")
      .set("Authorization", `Bearer ${token}`)
      .set("x-device-id", deviceId);
    const names = (list.body as Array<{ name: string }>).map((p) => p.name);
    expect(names).toContain("Full Body");
    expect(names).not.toContain("Full Body A");
  });
});
