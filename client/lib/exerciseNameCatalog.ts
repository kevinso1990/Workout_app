import AsyncStorage from "@react-native-async-storage/async-storage";

import { getApiUrl } from "@/lib/query-client";

/**
 * German display names AND per-exercise image URLs for the catalog.
 *
 * Plans and logged workouts store only the canonical English `name`, so:
 *  - the browse screen showed German while plan/workout screens showed English;
 *  - image lookups relied on a hand-maintained name→folder guess-map with gaps
 *    (missing images) and errors (wrong image for the exercise).
 *
 * This module fetches the catalog once (which now returns `name_de` and the
 * correct per-exercise `gif_url`), keeps English→German and English→image maps
 * in memory (persisted so they survive restarts and are available before the
 * network call), and resolves both synchronously with a tolerant fallback.
 */

const NAME_KEY = "exerciseNameCatalog.de.v1";
const GIF_KEY = "exerciseNameCatalog.gif.v1";

let deMap = new Map<string, string>();
let deMapLoose = new Map<string, string>();
let gifMap = new Map<string, string>();
let gifMapLoose = new Map<string, string>();
let hydrated = false;
const listeners = new Set<() => void>();

function norm(s: string): string {
  return s.trim().toLowerCase();
}

// Tolerant key: drop punctuation/spacing and a trailing plural "s" so a plan's
// "Dumbbell Lateral Raises" still matches the catalog's "Dumbbell Lateral Raise".
function looseNorm(s: string): string {
  const k = s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return k.endsWith("s") ? k.slice(0, -1) : k;
}

function buildLoose(src: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of src) {
    const lk = looseNorm(k);
    if (!out.has(lk)) out.set(lk, v);
  }
  return out;
}

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeExerciseNames(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Stable snapshot for useSyncExternalStore — flips false→true on hydration. */
export function exerciseNamesReady(): boolean {
  return hydrated;
}

export function localizeExerciseName(name: string, language: string): string {
  if (name && language?.startsWith("de")) {
    const de = deMap.get(norm(name)) ?? deMapLoose.get(looseNorm(name));
    if (de) return de;
  }
  return name;
}

/** The correct free-exercise-db image URL for an exercise, or null if unknown. */
export function catalogImageUrl(name: string): string | null {
  if (!name) return null;
  return gifMap.get(norm(name)) ?? gifMapLoose.get(looseNorm(name)) ?? null;
}

let hydrating = false;

/** Load the cached maps immediately, then refresh from the server. Idempotent. */
export async function hydrateExerciseNameCatalog(): Promise<void> {
  if (hydrating) return;
  hydrating = true;
  try {
    const [cachedDe, cachedGif] = await Promise.all([
      AsyncStorage.getItem(NAME_KEY),
      AsyncStorage.getItem(GIF_KEY),
    ]);
    if (cachedDe) {
      deMap = new Map(JSON.parse(cachedDe) as [string, string][]);
      deMapLoose = buildLoose(deMap);
    }
    if (cachedGif) {
      gifMap = new Map(JSON.parse(cachedGif) as [string, string][]);
      gifMapLoose = buildLoose(gifMap);
    }
    if (cachedDe || cachedGif) {
      hydrated = true;
      emit();
    }
  } catch {
    // ignore corrupt cache
  }

  try {
    const url = new URL("/api/exercises/catalog", getApiUrl()).toString();
    const res = await fetch(url);
    if (!res.ok) return;
    const rows = (await res.json()) as {
      name: string;
      name_de?: string | null;
      gif_url?: string | null;
    }[];
    const deEntries: [string, string][] = [];
    const gifEntries: [string, string][] = [];
    for (const r of rows) {
      if (r.name && r.name_de) deEntries.push([norm(r.name), r.name_de]);
      if (r.name && r.gif_url) gifEntries.push([norm(r.name), r.gif_url]);
    }
    if (deEntries.length || gifEntries.length) {
      if (deEntries.length) {
        deMap = new Map(deEntries);
        deMapLoose = buildLoose(deMap);
        AsyncStorage.setItem(NAME_KEY, JSON.stringify(deEntries)).catch(() => {});
      }
      if (gifEntries.length) {
        gifMap = new Map(gifEntries);
        gifMapLoose = buildLoose(gifMap);
        AsyncStorage.setItem(GIF_KEY, JSON.stringify(gifEntries)).catch(() => {});
      }
      hydrated = true;
      emit();
    }
  } catch {
    // offline / server down — cached maps (if any) still serve
  } finally {
    hydrating = false;
  }
}
