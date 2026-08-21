import AsyncStorage from "@react-native-async-storage/async-storage";

import { getApiUrl } from "@/lib/query-client";

/**
 * German display names for exercises. Plans and logged workouts store only the
 * canonical English `name`, so the browse screen (which fetches the catalog
 * with `name_de`) showed German while plan/workout screens showed English.
 * This module fetches the catalog once, keeps an English→German map in memory
 * (persisted so it survives restarts and is available before the network call),
 * and localises names synchronously. Image lookups keep using the English name.
 */

const STORAGE_KEY = "exerciseNameCatalog.de.v1";

let deMap = new Map<string, string>();
let deMapLoose = new Map<string, string>();
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

function rebuildLoose(): void {
  deMapLoose = new Map();
  for (const [k, v] of deMap) {
    const lk = looseNorm(k);
    if (!deMapLoose.has(lk)) deMapLoose.set(lk, v);
  }
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

let hydrating = false;

/** Load the cached map immediately, then refresh from the server. Idempotent. */
export async function hydrateExerciseNameCatalog(): Promise<void> {
  if (hydrating) return;
  hydrating = true;
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      deMap = new Map(JSON.parse(cached) as [string, string][]);
      rebuildLoose();
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
    }[];
    const entries: [string, string][] = [];
    for (const r of rows) {
      if (r.name && r.name_de) entries.push([norm(r.name), r.name_de]);
    }
    if (entries.length) {
      deMap = new Map(entries);
      rebuildLoose();
      hydrated = true;
      emit();
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => {});
    }
  } catch {
    // offline / server down — cached map (if any) still serves
  } finally {
    hydrating = false;
  }
}
