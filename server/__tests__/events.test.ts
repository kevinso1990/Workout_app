/**
 * Anonymous product events: only whitelisted names are stored, and the
 * STRATEGY.md metrics come out of them. DB_PATH=":memory:" via vitest.config.ts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";

import db, { initDb } from "../db";
import eventsRouter from "../routes/events";
import { computeProductMetrics } from "../services/productMetrics";

const app = express();
app.use(express.json());
app.use("/api", eventsRouter);

beforeAll(() => initDb());

describe("POST /api/events", () => {
  it("stores whitelisted events and drops the rest", async () => {
    const res = await request(app)
      .post("/api/events")
      .send({
        anonId: "abc12345-test",
        platform: "ios",
        appVersion: "1.1.0",
        events: [
          { name: "first_open", ts: new Date().toISOString() },
          { name: "workout_completed", ts: new Date().toISOString(), props: { sets: 12, note: { x: 1 } } },
          { name: "email_entered", ts: new Date().toISOString() },
        ],
      });
    expect(res.status).toBe(204);
    const rows = db
      .prepare("SELECT name, props FROM events WHERE anon_id = ? ORDER BY id")
      .all("abc12345-test") as { name: string; props: string | null }[];
    expect(rows.map((r) => r.name)).toEqual(["first_open", "workout_completed"]);
    expect(JSON.parse(rows[1].props!)).toEqual({ sets: 12 });
  });

  it("rejects a malformed id", async () => {
    const res = await request(app).post("/api/events").send({ anonId: "x", events: [] });
    expect(res.status).toBe(400);
  });
});

describe("computeProductMetrics", () => {
  const NOW = new Date("2026-12-31T12:00:00Z");
  const at = (daysAgo: number, hours = 0) =>
    new Date(NOW.getTime() - daysAgo * 86400000 + hours * 3600000).toISOString();

  it("computes the four bets", () => {
    const events = [
      // a: installed 40 days ago, imported within an hour, 2 workouts in week 4, bought Pro.
      { anonId: "a", name: "first_open", ts: at(40) },
      { anonId: "a", name: "import_succeeded", ts: at(40, 1) },
      { anonId: "a", name: "first_set_logged", ts: at(40, 0.02) },
      { anonId: "a", name: "workout_completed", ts: at(40 - 22) },
      { anonId: "a", name: "workout_completed", ts: at(40 - 24) },
      { anonId: "a", name: "pro_purchased", ts: at(35) },
      // b: installed 35 days ago, imported after 2 days, gone by week 4.
      { anonId: "b", name: "first_open", ts: at(35) },
      { anonId: "b", name: "import_succeeded", ts: at(33) },
      { anonId: "b", name: "first_set_logged", ts: at(35, 0.1) },
      // c: installed yesterday, three workouts this week.
      { anonId: "c", name: "first_open", ts: at(1) },
      { anonId: "c", name: "workout_completed", ts: at(1, 2) },
      { anonId: "c", name: "workout_completed", ts: at(0.5) },
      { anonId: "c", name: "workout_completed", ts: at(0.2) },
    ];
    const m = computeProductMetrics(events, NOW);
    expect(m.installs).toBe(3);
    expect(m.importIn24h).toMatchObject({ hits: 1, of: 3 });
    expect(m.week4Active).toMatchObject({ hits: 1, of: 2, rate: 0.5 });
    expect(m.proIn30d).toMatchObject({ hits: 1, of: 2 });
    expect(m.workoutsPerActiveWeek).toBe(2.5); // a: 2 in one week, c: 3
    expect(m.medianSecondsToFirstSet).toBeCloseTo((0.02 * 3600 + 0.1 * 3600) / 2);
  });

  it("reports nothing to measure rather than 0 %", () => {
    const m = computeProductMetrics([], NOW);
    expect(m.week4Active.rate).toBeNull();
    expect(m.workoutsPerActiveWeek).toBeNull();
  });
});
