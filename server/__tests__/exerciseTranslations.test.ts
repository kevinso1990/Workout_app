/**
 * Regression guard for the German exercise-name pipeline.
 *
 * A previous change dropped the exercise_translations JOIN and the name_de
 * field from /api/exercises/catalog, so exercise names silently stopped
 * switching to German for months even though all translations were in the DB.
 * This test fails loudly if either the JOIN or the API field goes missing again.
 *
 * DB_PATH=":memory:" is injected by vitest.config.ts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import db from "../db";
import { initDb } from "../db";
import { registerRoutes } from "../routes/index";
import { errorHandler } from "../middleware/errorHandler";

const app = express();
app.use(express.json());

let translatedName = "";
let translatedGerman = "Kreuzheben-Testlabel";

beforeAll(() => {
  initDb();
  registerRoutes(app);
  app.use(errorHandler);

  // Seed a German translation for whatever exercise happens to be first.
  const first = db
    .prepare("SELECT id, name FROM exercises ORDER BY id LIMIT 1")
    .get() as { id: number; name: string } | undefined;
  if (!first) throw new Error("no seeded exercises to translate");
  translatedName = first.name;
  db.prepare(
    "INSERT OR REPLACE INTO exercise_translations (exercise_id, lang, name) VALUES (?, 'de', ?)",
  ).run(first.id, translatedGerman);
});

describe("GET /api/exercises/catalog — German names", () => {
  it("includes a name_de field on every row", async () => {
    const res = await request(app).get("/api/exercises/catalog");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // The field must be present (null is allowed), never absent.
    for (const row of res.body.slice(0, 20)) {
      expect(row).toHaveProperty("name_de");
    }
  });

  it("returns the German label for a translated exercise", async () => {
    const res = await request(app).get("/api/exercises/catalog");
    const row = res.body.find(
      (r: { name: string }) => r.name === translatedName,
    );
    expect(row).toBeTruthy();
    expect(row.name_de).toBe(translatedGerman);
    // The canonical English name stays intact for matching/history.
    expect(row.name).toBe(translatedName);
  });

  it("returns null name_de for untranslated exercises (LEFT JOIN, not INNER)", async () => {
    const res = await request(app).get("/api/exercises/catalog");
    const untranslated = res.body.find(
      (r: { name: string; name_de: string | null }) =>
        r.name !== translatedName && r.name_de === null,
    );
    // At least one exercise has no German translation and still comes through.
    expect(untranslated).toBeTruthy();
  });
});
