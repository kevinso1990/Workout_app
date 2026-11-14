/**
 * Rows keep the gif_url an older image mapping wrote. correctMappedImages has
 * to move them to the current mapping without touching an exercise that
 * already shows its own free-exercise-db folder.
 *
 * DB_PATH=":memory:" is injected by vitest.config.ts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import db, { initDb } from "../db";
import { correctMappedImages } from "../services/gifPrefetchService";

const CDN = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
const rows = () =>
  db.prepare("SELECT id, name FROM exercises").all() as { id: number; name: string }[];
const image = (name: string) =>
  (db.prepare("SELECT gif_url FROM exercises WHERE name = ?").get(name) as { gif_url: string | null })
    .gif_url;
const setImage = (name: string, url: string | null) => {
  db.prepare(
    "INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, is_custom) VALUES (?, 'Core', 'None', 0)",
  ).run(name);
  db.prepare("UPDATE exercises SET gif_url = ? WHERE name = ?").run(url, name);
};

beforeAll(() => {
  initDb();
  setImage("Plank", `${CDN}/Dead_Bug/0.jpg`);
  setImage("Good Morning", `${CDN}/Barbell_Deadlift/0.jpg`);
  setImage("KB Halo", `${CDN}/Advanced_Kettlebell_Windmill/0.jpg`);
  setImage("Australian Pull-Ups", null);
  setImage("Thigh Abductor", `${CDN}/Thigh_Abductor/0.jpg`);
  correctMappedImages(rows());
});

describe("correctMappedImages", () => {
  it("replaces another movement's image with the mapped one", () => {
    expect(image("Plank")).toBe(`${CDN}/Plank/1.jpg`);
    expect(image("Good Morning")).toBe(`${CDN}/Good_Morning/0.jpg`);
  });

  it("clears a retired image that has no replacement", () => {
    expect(image("KB Halo")).toBeNull();
  });

  it("fills a missing image from the mapping", () => {
    expect(image("Australian Pull-Ups")).toBe(`${CDN}/Inverted_Row/0.jpg`);
  });

  it("keeps an exercise's own folder and is idempotent", () => {
    expect(image("Thigh Abductor")).toBe(`${CDN}/Thigh_Abductor/0.jpg`);
    expect(correctMappedImages(rows())).toBe(0);
  });
});
