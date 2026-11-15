/**
 * Cues for exercises without any are written by the AI once per name and
 * language, then served from the database. DB_PATH=":memory:" is injected by
 * vitest.config.ts.
 */
import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express from "express";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("../services/gemini", () => ({ geminiGenerateContent: generate }));

import { initDb } from "../db";
import exerciseCuesRouter from "../routes/exerciseCues";

const app = express();
app.use(express.json());
app.use("/api", exerciseCuesRouter);

beforeAll(() => initDb());

describe("POST /api/exercise-cues", () => {
  it("asks the AI once, then answers from the database", async () => {
    generate.mockResolvedValueOnce(
      JSON.stringify({ known: true, cues: ["Setz dich in den 90/90-Sitz.", "Drück die Kettlebell hoch."] }),
    );
    const first = await request(app)
      .post("/api/exercise-cues")
      .send({ name: "KB Shin Box Rotation → Press", muscleGroup: "Core", language: "de" });
    expect(first.body.cues).toHaveLength(2);

    const again = await request(app)
      .post("/api/exercise-cues")
      .send({ name: "  kb shin box rotation → press ", language: "de" });
    expect(again.body.cues).toEqual(first.body.cues);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("remembers an exercise the AI doesn't know, without cues", async () => {
    generate.mockResolvedValueOnce(JSON.stringify({ known: false, cues: ["made up"] }));
    const res = await request(app)
      .post("/api/exercise-cues")
      .send({ name: "Zorbulator Flex 3000", language: "en" });
    expect(res.body.cues).toEqual([]);
    await request(app).post("/api/exercise-cues").send({ name: "Zorbulator Flex 3000", language: "en" });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("stores nothing when the AI fails", async () => {
    generate.mockRejectedValueOnce(new Error("503"));
    const res = await request(app).post("/api/exercise-cues").send({ name: "Hip Airplanes", language: "de" });
    expect(res.status).toBe(503);
    generate.mockResolvedValueOnce(JSON.stringify({ known: true, cues: ["Steh auf einem Bein."] }));
    const retry = await request(app).post("/api/exercise-cues").send({ name: "Hip Airplanes", language: "de" });
    expect(retry.body.cues).toEqual(["Steh auf einem Bein."]);
  });

  it("rejects a missing name", async () => {
    const res = await request(app).post("/api/exercise-cues").send({ language: "de" });
    expect(res.status).toBe(400);
  });
});
