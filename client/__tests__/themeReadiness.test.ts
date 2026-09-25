/**
 * Burn-down for the light-mode conversion.
 *
 * `Colors.light` and `HEVY` are the DARK palette as literal constants. A screen
 * reading colours from them renders dark no matter what the theme setting says,
 * and — worse — a screen that mixes them with `theme.*` renders a light
 * background under dark-palette text, or the reverse. Mixed screens are the
 * dangerous state, not the unconverted ones.
 *
 * Converting means reading colours through useTheme() instead. Colours written
 * inside StyleSheet.create() cannot be converted in place at all: that call is
 * evaluated once at module load, long before a theme exists, so those have to
 * move to inline style overrides or a stylesheet factory.
 *
 * This test does not demand the work be finished. It pins the CURRENT counts so
 * the number can only go down, which is what stops a long refactor from
 * quietly going backwards while screens are being touched for other reasons.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const CLIENT_ROOT = join(__dirname, "..");
const SCAN_DIRS = ["screens", "components", "navigation"];

/**
 * Ratchet. Lower these as screens are converted; never raise them.
 * A raise means new dark-only colour was added to the app.
 */
const MAX_STATIC_REFS = 465;
const MAX_FILES_WITH_STATIC_REFS = 43;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const STATIC_COLOUR = /\b(?:Colors\.light|Colors\.dark|HEVY)\.[a-zA-Z]/g;

function scan() {
  const files = SCAN_DIRS.flatMap((d) => walk(join(CLIENT_ROOT, d)));
  let total = 0;
  const perFile: { file: string; count: number }[] = [];
  for (const f of files) {
    const n = (readFileSync(f, "utf-8").match(STATIC_COLOUR) ?? []).length;
    if (n > 0) perFile.push({ file: relative(CLIENT_ROOT, f), count: n });
    total += n;
  }
  perFile.sort((a, b) => b.count - a.count);
  return { total, perFile, scanned: files.length };
}

describe("light-mode conversion burn-down", () => {
  const { total, perFile, scanned } = scan();

  it("scanned a meaningful number of files", () => {
    expect(scanned).toBeGreaterThan(30);
  });

  it(`uses no more than ${MAX_STATIC_REFS} dark-palette constants`, () => {
    expect(
      total,
      `${total} references to the dark palette remain across ${perFile.length} files.\n` +
        `Largest: ${perFile
          .slice(0, 5)
          .map((f) => `${f.file} (${f.count})`)
          .join(", ")}\n` +
        `If this went UP, new dark-only colour was added — read it from useTheme() instead.\n` +
        `If it went DOWN, lower MAX_STATIC_REFS to the new number to lock the progress in.`,
    ).toBeLessThanOrEqual(MAX_STATIC_REFS);
  });

  it(`confines them to at most ${MAX_FILES_WITH_STATIC_REFS} files`, () => {
    expect(perFile.length).toBeLessThanOrEqual(MAX_FILES_WITH_STATIC_REFS);
  });
});

describe("the light palette is a real second palette", () => {
  it("does not share values with the dark one", async () => {
    const { Palettes } = await import("../constants/palettes");
    // The regression this guards is the original bug: Colors.light and
    // Colors.dark were literally the same object, so the theme switch could
    // never do anything.
    expect(Palettes.light).not.toBe(Palettes.dark);
    expect(Palettes.light.backgroundRoot).not.toBe(Palettes.dark.backgroundRoot);
    expect(Palettes.light.text).not.toBe(Palettes.dark.text);
    expect(Palettes.light.primary).not.toBe(Palettes.dark.primary);
  });

  it("keeps the plate colours identical — they encode load, not theme", async () => {
    const { Palettes } = await import("../constants/palettes");
    expect(Palettes.light.plateLight).toBe(Palettes.dark.plateLight);
    expect(Palettes.light.plateMedium).toBe(Palettes.dark.plateMedium);
    expect(Palettes.light.plateHeavy).toBe(Palettes.dark.plateHeavy);
  });

  it("puts readable text on the primary surface in both themes", async () => {
    const { Palettes } = await import("../constants/palettes");
    // onChalk is whatever sits on a primary-filled button. If it matched the
    // primary fill, that button would be invisible — the exact bug class this
    // codebase has shipped repeatedly.
    expect(Palettes.dark.onChalk).not.toBe(Palettes.dark.primary);
    expect(Palettes.light.onChalk).not.toBe(Palettes.light.primary);
  });
});
