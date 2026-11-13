import { describe, expect, it } from "vitest";

import { EXERCISE_IMAGE_IDS } from "../exerciseImageIds";
import catalog from "../../server/data/freeExerciseDbCatalog.json";

const folders = new Set(
  (catalog as { gif_url: string | null }[])
    .map((r) => r.gif_url?.split("/").at(-2))
    .filter((f): f is string => !!f),
);
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const byKey = new Map([...folders].map((f) => [key(f), f]));

describe("EXERCISE_IMAGE_IDS", () => {
  it("only points at folders that exist upstream", () => {
    const missing = Object.entries(EXERCISE_IMAGE_IDS).filter(([, f]) => !folders.has(f));
    expect(missing).toEqual([]);
  });

  it("uses an exercise's own folder when there is one", () => {
    // Plank showed Dead Bug and Good Morning a deadlift although both have
    // their own images.
    const elsewhere = Object.entries(EXERCISE_IMAGE_IDS).filter(([name, f]) => {
      const own = byKey.get(key(name));
      return own && own !== f;
    });
    expect(elsewhere).toEqual([]);
  });
});
