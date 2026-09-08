/**
 * Guard against the "invisible control" bug class.
 *
 * In the Chalk & Iron design system the PRIMARY action colour IS chalk
 * (`Colors.light.primary === "#ECE9E1"`, i.e. near-white). Any foreground
 * written as a hardcoded white literal on top of a chalk/primary surface is
 * therefore invisible — white on white. This has now shipped twice: first
 * across the whole onboarding flow, then on the "+" FAB for adding a plan,
 * the plan-adaptation and split-refresh banner CTAs, the calendar's selected
 * day, the import review panel's save button, and more.
 *
 * These bugs never fail typecheck and never throw — the only way to catch them
 * is to forbid the literal outright and force the token (`Colors.light.onChalk`)
 * wherever a foreground sits on chalk.
 *
 * The allowlist below holds the cases that are genuinely fine: white sitting on
 * a real colour (red destructive action, amber badge, dark surface). Each entry
 * names the background it was verified against. If you add to it, verify the
 * background first — an unverified entry defeats the whole test.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const CLIENT_ROOT = join(__dirname, "..");
const SCAN_DIRS = ["screens", "components"];

/** file → set of allowed white-literal occurrences, with the verified background. */
const ALLOWED: Record<string, string[]> = {
  "screens/main/ActiveWorkoutScreen.tsx": [
    "trash icon on swipeDeleteAction (#EF4444)",
  ],
  "screens/ProgressScreen.tsx": [
    "lift chip label on lift.color when selected",
  ],
  "screens/ImportWorkoutScreen.tsx": [
    "thumbnail remove x on Colors.light.error",
  ],
  "screens/ProfileScreen.tsx": [
    "Switch thumbColor (not a surface foreground)",
  ],
  "components/ErrorFallback.tsx": [
    "title on #111111",
    "button label on #34C759",
  ],
  "components/HybridCalendar.tsx": [
    "cardio zap icon on #F59E0B",
  ],
  "components/PlateCalculator.tsx": [
    "plate label on the plate's own colour",
  ],
};

const WHITE_LITERAL =
  /(?:color|tintColor|thumbColor)\s*[:=]\s*[{"']?\s*["']#(?:fff|ffffff)["']/gi;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * The mirror image of the same bug: a pale background left over from the old
 * light theme. The app is committed dark, so a near-white chip renders as a
 * bright blob — and anything chalk-coloured drawn on top of it disappears. This
 * is how the "Start strength training" icon in the add-workout sheet became
 * invisible (chalk glyph on #EEF2FF) while passing the white-foreground check.
 */
const LIGHT_BG = /backgroundColor:\s*["']#([0-9a-f]{6})["']/gi;
/** Perceptual luminance; 0.75 clears amber (#F59E0B ≈ 0.65) and red (#EF4444 ≈ 0.47). */
const LIGHT_THRESHOLD = 0.75;

function luminance(hex: string): number {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

describe("no pale hardcoded backgrounds (light-theme leftovers)", () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(CLIENT_ROOT, d)));

  for (const file of files) {
    const rel = relative(CLIENT_ROOT, file).split("\\").join("/");
    it(`${rel} has no near-white hardcoded surface`, () => {
      const src = readFileSync(file, "utf-8");
      const offenders: string[] = [];
      for (const m of src.matchAll(LIGHT_BG)) {
        if (luminance(m[1]) > LIGHT_THRESHOLD) offenders.push(`#${m[1]}`);
      }
      expect(
        offenders,
        offenders.length
          ? `${rel}: pale hardcoded background(s) ${offenders.join(", ")} in a committed-dark app. ` +
            `Use a theme token (e.g. Colors.light.primary + "1A" over iron) instead.`
          : undefined,
      ).toEqual([]);
    });
  }
});

describe("no hardcoded white foregrounds outside the verified allowlist", () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(CLIENT_ROOT, d)));

  it("scans a meaningful number of files (guard against a broken glob)", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const file of files) {
    const rel = relative(CLIENT_ROOT, file).split("\\").join("/");
    it(`${rel} uses colour tokens, not white literals`, () => {
      const src = readFileSync(file, "utf-8");
      const hits = src.match(WHITE_LITERAL) ?? [];
      const allowed = ALLOWED[rel] ?? [];
      expect(
        hits.length,
        hits.length > allowed.length
          ? `${rel}: ${hits.length} hardcoded white foreground(s), only ${allowed.length} allowlisted ` +
            `(${allowed.join("; ") || "none"}). In Chalk & Iron the primary surface IS near-white — ` +
            `use Colors.light.onChalk for anything sitting on it, or add a verified allowlist entry.`
          : undefined,
      ).toBeLessThanOrEqual(allowed.length);
    });
  }
});
