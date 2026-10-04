/**
 * Server-side half of the exercise avoid-list: resolving free-text avoid
 * names against the catalog and merging them into generation's existing
 * exclusion mechanism.
 *
 * The AI-generation whitelist-removal itself (in tryAutoGeneratePlansWithAi)
 * can't be exercised directly in tests — that function short-circuits under
 * VITEST so no real model call happens. What CAN and must be tested directly
 * is makeAutoGenRuntime, the step just before it: this is where an avoid-name
 * becomes either a catalog id (merged into dislikedIds, which the template
 * path's SQL exclusion and resolveExercise already both honour) or a
 * canonical name (which the generation code removes from the AI's whitelist).
 * Get this step wrong and both downstream mechanisms silently do nothing.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { initDb } from "../db";
import { makeAutoGenRuntime } from "../services/planService";
import { upsertVote } from "../services/voteService";
import db from "../db";

beforeAll(() => {
  initDb();
});

const baseBody = {
  frequency: 3,
  experience: "intermediate",
  goal: "build_muscle",
  equipment: "barbell",
};

function catalogId(name: string): number {
  const row = db.prepare("SELECT id FROM exercises WHERE name = ?").get(name) as
    | { id: number }
    | undefined;
  if (!row) throw new Error(`fixture exercise not seeded: ${name}`);
  return row.id;
}

describe("makeAutoGenRuntime — avoid-list resolution", () => {
  it("resolves a confidently-matched avoid name into both dislikedIds and avoidedCanonicalNames", () => {
    const rt = makeAutoGenRuntime({ ...baseBody, avoidExercises: ["Barbell Row"] });
    expect(rt.dislikedIds).toContain(catalogId("Barbell Row"));
    expect(rt.avoidedCanonicalNames.has("barbell row")).toBe(true);
  });

  it("ignores an avoid name with no confident catalog match, without throwing", () => {
    const rt = makeAutoGenRuntime({
      ...baseBody,
      avoidExercises: ["Zzqx Nonexistent Movement 123"],
    });
    expect(rt.avoidedCanonicalNames.size).toBe(0);
  });

  it("does not affect generation when the avoid-list is empty", () => {
    const rt = makeAutoGenRuntime({ ...baseBody, avoidExercises: [] });
    expect(rt.avoidedCanonicalNames.size).toBe(0);
    expect(rt.dislikedIds).toEqual([]);
  });

  it("merges avoided exercises with the device's own disliked exercises, deduplicated", () => {
    const deviceId = `test-device-${Date.now()}`;
    const rowId = catalogId("Overhead Press");
    upsertVote(deviceId, rowId, -1);
    // Avoiding the SAME exercise the device already disliked must not double it.
    const rt = makeAutoGenRuntime(
      { ...baseBody, avoidExercises: ["Overhead Press"] },
      undefined,
      deviceId,
    );
    const occurrences = rt.dislikedIds.filter((id) => id === rowId).length;
    expect(occurrences).toBe(1);
  });

  it("resolves multiple avoid names independently", () => {
    const rt = makeAutoGenRuntime({
      ...baseBody,
      avoidExercises: ["Barbell Row", "Overhead Press"],
    });
    expect(rt.dislikedIds).toEqual(
      expect.arrayContaining([catalogId("Barbell Row"), catalogId("Overhead Press")]),
    );
    expect(rt.avoidedCanonicalNames.has("barbell row")).toBe(true);
    expect(rt.avoidedCanonicalNames.has("overhead press")).toBe(true);
  });

  it("rejects a malformed avoidExercises payload via the same schema as the rest of the request", () => {
    expect(() =>
      makeAutoGenRuntime({
        ...baseBody,
        // @ts-expect-error — deliberately wrong shape to prove validation fires
        avoidExercises: [123, 456],
      }),
    ).toThrow();
  });
});
