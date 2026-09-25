/**
 * The light-mode conversion must not change how the app looks in DARK mode.
 *
 * Converting a screen means rewriting `HEVY.surface` as `c.ironElevated2`,
 * `HEVY.textPrimary` as `c.chalk`, and so on — a mechanical redirect from a
 * literal constant to the active palette. That redirect is only invisible in
 * dark mode if the two sides hold the SAME value. If they drift apart, every
 * converted screen silently shifts while every unconverted one stays put, and
 * the app ends up with two slightly different darks side by side.
 *
 * This is not hypothetical: the hairlines were already off by 0.01 alpha
 * (HEVY 0.10/0.16 vs palette 0.09/0.17) when the first five screens were
 * converted, so those screens did move, just too little to notice by eye.
 *
 * Each pair below is a redirect the conversion performs. Keeping them equal is
 * what makes "dark is untouched" a true statement rather than an assumption.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Palettes } from "../constants/palettes";

/**
 * hevyLayout.ts imports react-native, which this runner cannot parse, so the
 * constants are read out of the source text instead of imported. palettes.ts
 * is deliberately react-native-free precisely so it CAN be imported here.
 */
function readHevyColours(): Record<string, string> {
  const src = readFileSync(
    join(__dirname, "..", "constants", "hevyLayout.ts"),
    "utf-8",
  );
  const out: Record<string, string> = {};
  for (const m of src.matchAll(
    /^\s{2}([a-zA-Z][a-zA-Z0-9]*):\s*"(#[0-9a-fA-F]{3,8}|rgba\([^)]*\))"/gm,
  )) {
    out[m[1]] = m[2];
  }
  return out;
}

const HEVY = readHevyColours();

/** HEVY colour key -> the dark-palette key the conversion redirects it to. */
const REDIRECTS = {
  textPrimary: "chalk",
  textSecondary: "chalkDim",
  textMuted: "chalkFaint",
  surface: "ironElevated2",
  canvas: "iron",
  control: "ironElevated3",
  hairline: "hairline",
  separator: "hairlineStrong",
} as const;

describe("converting a screen leaves dark mode byte-identical", () => {
  for (const [hevyKey, paletteKey] of Object.entries(REDIRECTS)) {
    it(`HEVY.${hevyKey} equals the dark palette's ${paletteKey}`, () => {
      const from = HEVY[hevyKey];
      const to = (Palettes.dark as Record<string, unknown>)[paletteKey];
      expect(from, `HEVY.${hevyKey} is not defined`).toBeDefined();
      expect(to, `Palettes.dark.${paletteKey} is not defined`).toBeDefined();
      expect(
        to,
        `Converting HEVY.${hevyKey} -> c.${paletteKey} would change dark mode ` +
          `(${String(from)} becomes ${String(to)}). Make them equal, or stop ` +
          `treating this redirect as cosmetic-free.`,
      ).toBe(from);
    });
  }

  it("covers every colour key HEVY actually exposes", () => {
    // HEVY mixes colour with spacing (pad, radiusCard). Only colours may be
    // redirected at the palette — rewriting a spacing key broke the build the
    // first time this conversion was attempted. This asserts the colour list
    // above stays complete, so a newly added HEVY colour cannot slip through
    // unconverted and unnoticed.
    // The reader above matches only colour literals, so spacing keys (pad,
    // radiusCard) never appear. Rewriting one of those broke the build the
    // first time this conversion was attempted.
    const colourKeys = Object.keys(HEVY).sort();
    expect(colourKeys.length).toBeGreaterThan(5);
    expect(colourKeys).toEqual(Object.keys(REDIRECTS).sort());
  });
});
