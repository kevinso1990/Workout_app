/**
 * The exercise catalog — 1000+ entries from the server, with a local cache.
 *
 * This exists because the catalog fetch was written inline in one screen, so
 * every other screen that needed exercises carried its own hardcoded list
 * instead. The edit screen's list held about 90 entries, which is why exercises
 * added to the real catalog could not be picked there at all.
 *
 * Three layers, in order:
 *   1. the cache, so the picker opens instantly and works offline
 *   2. the server, which refreshes the cache in the background
 *   3. the caller's bundled fallback, only if both are empty
 *
 * The cache is deliberately not given a TTL. A stale catalog is a catalog with
 * a few exercises missing; an empty one is a screen the user cannot use. So it
 * is served whatever its age and replaced whenever the network allows.
 */

import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getApiUrl } from "@/constants/api";

export type CatalogExercise = {
  id: string;
  name: string;
  /** German display name; `name` stays English for matching and history. */
  nameDe?: string;
  muscleGroup: string;
  equipment: string;
  isCustom?: boolean;
};

const CACHE_KEY = "exercise_catalog_v1";

type CatalogRow = {
  id: number;
  name: string;
  name_de?: string | null;
  muscle_group: string;
  equipment: string;
  is_custom: number;
};

function toCatalogExercise(r: CatalogRow): CatalogExercise {
  return {
    id: String(r.id),
    name: r.name,
    nameDe: r.name_de ?? undefined,
    muscleGroup: r.muscle_group,
    equipment: r.equipment
      ? r.equipment.charAt(0).toUpperCase() + r.equipment.slice(1)
      : "",
    isCustom: r.is_custom === 1,
  };
}

export async function readCachedCatalog(): Promise<CatalogExercise[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CatalogExercise[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function fetchCatalog(): Promise<CatalogExercise[]> {
  const url = new URL("/api/exercises/catalog", getApiUrl()).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`catalog http ${res.status}`);
  const rows = (await res.json()) as CatalogRow[];
  if (!Array.isArray(rows)) throw new Error("catalog shape");
  return rows.map(toCatalogExercise);
}

export function useExerciseCatalog(): {
  catalog: CatalogExercise[];
  /** False once either the cache or the network has answered. */
  loading: boolean;
} {
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = await readCachedCatalog();
      if (!cancelled && cached.length > 0) {
        setCatalog(cached);
        setLoading(false);
      }

      try {
        const fresh = await fetchCatalog();
        if (cancelled) return;
        // An empty response must not wipe a good cache — that would turn a
        // server hiccup into an empty picker on the next offline launch.
        if (fresh.length > 0) {
          setCatalog(fresh);
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
        }
      } catch {
        // Offline or server down: the cache (or the caller's fallback) stands.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading };
}
