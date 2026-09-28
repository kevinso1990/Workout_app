/**
 * Guard against German text leaking into the English app.
 *
 * i18next's `defaultValue` is a silent fallback: if the key is missing, it
 * renders the default — in EVERY language. Because the defaults written in
 * this codebase are German, a missing key does not look broken in German at
 * all. It only shows up as German text sitting in the English UI, which is
 * exactly how "Deine Woche" survived in English: 17 keys across the week
 * strip, the calendar tabs, the commitments screens and the coach card had a
 * German default and no entry in either locale file.
 *
 * So a `defaultValue` is treated here as a promise that the key exists, and
 * this test holds it to that promise.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CLIENT_ROOT = join(__dirname, "..");

type Json = { [k: string]: Json | string };

function loadLocale(lang: string): Json {
  return JSON.parse(
    readFileSync(join(CLIENT_ROOT, "locales", lang, "translation.json"), "utf-8"),
  ) as Json;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    // Skip the test tree: this file documents the pattern it searches for,
    // so scanning it would make the guard flag its own example.
    if (entry === "node_modules" || entry === "locales" || entry === "__tests__")
      continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Resolves a dotted key, accepting i18next plural suffixes. */
function hasKey(locale: Json, key: string): boolean {
  const parts = key.split(".");
  const leaf = parts.pop()!;
  let cur: Json | string = locale;
  for (const p of parts) {
    if (typeof cur !== "object" || !(p in cur)) return false;
    cur = cur[p];
  }
  if (typeof cur !== "object") return false;
  if (leaf in cur) return true;
  // Plural keys live as `<leaf>_one` / `<leaf>_other`; a call site uses the
  // base name and i18next picks the form from `count`.
  return `${leaf}_other` in cur || `${leaf}_one` in cur;
}

// t("some.key", { ...anything..., defaultValue: ... })
const T_WITH_DEFAULT =
  /\bt\(\s*["'`]([a-zA-Z0-9_.]+)["'`]\s*,\s*\{(?:[^{}]|\{[^{}]*\})*?defaultValue/gs;

// Any t("a.b") call at all. Requiring a dot keeps this from matching helpers
// that happen to be named `t` and take a plain word.
const T_ANY = /\bt\(\s*["'`]([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)["'`]/g;

describe("every translation key that hides behind a defaultValue really exists", () => {
  const de = loadLocale("de");
  const en = loadLocale("en");
  const files = walk(CLIENT_ROOT);

  const keys = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, "utf-8");
    for (const m of src.matchAll(T_WITH_DEFAULT)) keys.add(m[1]);
  }

  it("scans a meaningful number of files", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it("finds keys to check (guard against a regex that silently matches nothing)", () => {
    expect(keys.size).toBeGreaterThan(5);
  });

  for (const key of [...keys].sort()) {
    it(`${key} is defined in de and en`, () => {
      expect(hasKey(de, key), `${key} missing from de/translation.json`).toBe(true);
      expect(hasKey(en, key), `${key} missing from en/translation.json`).toBe(true);
    });
  }
});

describe("every translation key used in code exists at all", () => {
  // The defaultValue check above only covers keys that HAVE a fallback. A key
  // without one renders the raw dotted path on screen — which is how
  // "plans.duplicate" shipped as literal text on a swipe action, in a codebase
  // that already had a translation guard. The narrower guard could not see it
  // because it only looked at calls with a defaultValue.
  const de = loadLocale("de");
  const en = loadLocale("en");
  const files = walk(CLIENT_ROOT);

  const keys = new Set<string>();
  for (const file of files) {
    const src = readFileSync(file, "utf-8");
    for (const m of src.matchAll(T_ANY)) keys.add(m[1]);
  }

  it("finds a meaningful number of keys", () => {
    expect(keys.size).toBeGreaterThan(50);
  });

  it("has no key that would render as its own raw path", () => {
    const missingDe = [...keys].filter((k) => !hasKey(de, k)).sort();
    const missingEn = [...keys].filter((k) => !hasKey(en, k)).sort();
    expect(
      { missingDe, missingEn },
      "these keys are called in code but absent from the locale files, so the " +
        "dotted key itself is what the user sees",
    ).toEqual({ missingDe: [], missingEn: [] });
  });
});

describe("the two locale files describe the same app", () => {
  function leafKeys(node: Json, prefix = ""): string[] {
    const out: string[] = [];
    for (const [k, v] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "object") out.push(...leafKeys(v, path));
      else out.push(path);
    }
    return out;
  }

  it("has no key present in one language but absent in the other", () => {
    const de = new Set(leafKeys(loadLocale("de")));
    const en = new Set(leafKeys(loadLocale("en")));
    const onlyDe = [...de].filter((k) => !en.has(k));
    const onlyEn = [...en].filter((k) => !de.has(k));
    expect(
      { onlyDe, onlyEn },
      "a key defined in only one language renders as the other language's text (or the raw key) for those users",
    ).toEqual({ onlyDe: [], onlyEn: [] });
  });
});
