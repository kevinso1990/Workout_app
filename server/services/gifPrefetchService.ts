/**
 * gifPrefetchService.ts
 *
 * Background job that populates the `gif_url` column on the `exercises` table
 * with exercise demonstration image URLs.
 *
 * Primary source: GitHub CDN (yuhonas/free-exercise-db) — free, no key needed.
 * Secondary source: ExerciseDB API via RapidAPI (RAPIDAPI_KEY) — used to
 *   verify exercise name matches and supplement any unmapped entries.
 *
 * Note: ExerciseDB previously returned `gifUrl` but removed it from their API
 * in 2025. The RAPIDAPI_KEY is still used for name matching / fallback search.
 * Static exercise images are served from the GitHub CDN instead.
 *
 * All folder IDs in EXERCISE_IMAGE_IDS are verified to exist in the
 * yuhonas/free-exercise-db repository.
 */

import db from "../db";
import { getExerciseDbApiKey } from "../lib/exerciseDbConfig";
import { searchMuscleWiki } from "./muscleWikiService";
import { EXERCISE_IMAGE_IDS, exerciseImageFile } from "../../shared/exerciseImageIds";

const GITHUB_CDN =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

const RAPIDAPI_HOST = "exercisedb.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;



function getGithubImageUrl(exerciseName: string): string | null {
  const id = EXERCISE_IMAGE_IDS[exerciseName];
  if (!id) return null;
  return `${GITHUB_CDN}/${exerciseImageFile(id)}`;
}

interface ExerciseDBEntry {
  id: string;
  name: string;
}

async function searchExerciseDB(
  exerciseName: string,
  apiKey: string
): Promise<ExerciseDBEntry | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const encoded = encodeURIComponent(exerciseName.toLowerCase());
    const res = await fetch(`${BASE_URL}/exercises/name/${encoded}?limit=3`, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as ExerciseDBEntry[];
    if (!Array.isArray(data) || data.length === 0) return null;

    return (
      data.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase()) ??
      data[0]
    );
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pre-fetches MuscleWiki animated content for all exercises that don't yet
 * have a cached entry in exercise_media_cache. Runs in the background with a
 * small delay between requests to avoid hammering the external API.
 */
async function runMuscleWikiPrefetch(exercises: { id: number; name: string }[]): Promise<void> {
  const alreadyCached = new Set(
    (
      db
        .prepare("SELECT exercise_name FROM exercise_media_cache")
        .all() as { exercise_name: string }[]
    ).map((r) => r.exercise_name.toLowerCase()),
  );

  const uncached = exercises.filter((ex) => !alreadyCached.has(ex.name.toLowerCase()));
  if (uncached.length === 0) {
    console.log("[GIF prefetch] MuscleWiki data already cached for all exercises.");
    return;
  }

  console.log(`[GIF prefetch] Pre-fetching MuscleWiki animated media for ${uncached.length} exercises…`);
  let fetched = 0;

  for (const ex of uncached) {
    try {
      const results = await searchMuscleWiki(ex.name);
      if (results.length > 0) fetched++;
    } catch {
      /* ignore individual failures */
    }
    await sleep(200);
  }

  console.log(`[GIF prefetch] MuscleWiki prefetch done — fetched ${fetched}/${uncached.length} exercises.`);
}

/**
 * Fetches and caches media for a single newly-created exercise.
 * Called after custom exercise creation so users see images without waiting
 * for a server restart. Runs asynchronously (fire-and-forget).
 */
export async function prefetchSingleExercise(id: number, name: string): Promise<void> {
  try {
    await runMuscleWikiPrefetch([{ id, name }]);

    const row = db
      .prepare("SELECT gif_url FROM exercises WHERE id = ?")
      .get(id) as { gif_url: string | null } | undefined;

    if (!row?.gif_url) {
      const githubUrl = getGithubImageUrl(name);
      if (githubUrl) {
        db.prepare("UPDATE exercises SET gif_url = ? WHERE id = ?").run(githubUrl, id);
      } else {
        const apiKey = getExerciseDbApiKey();
        if (apiKey) {
          const match = await searchExerciseDB(name, apiKey);
          if (match) {
            const matchUrl = getGithubImageUrl(match.name);
            if (matchUrl) {
              db.prepare("UPDATE exercises SET gif_url = ? WHERE id = ?").run(matchUrl, id);
            }
          }
        }
      }
    }

    console.log(`[GIF prefetch] Completed media fetch for custom exercise: ${name}`);
  } catch (err) {
    console.error(`[GIF prefetch] Failed to fetch media for exercise "${name}":`, err);
  }
}

const folderKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Images an older version set that show something else: KB Halo was mapped to
 * a lateral raise and a windmill, and these free-exercise-db folders no longer exist upstream.
 */
const RETIRED_IMAGES: Record<string, string[]> = {
  "KB Halo": ["Cable_Seated_Lateral_Raise", "Advanced_Kettlebell_Windmill"],
};
const DEAD_FOLDERS = new Set([
  "Kettlebell_Halo",
  "Kettlebell_Halo_With_Overhead_Extension",
  "Kettlebell_Overhead_Triceps_Extension",
]);

/** Points rows at their mapped image where it is missing or an older mapping left a wrong one. */
export function correctMappedImages(exercises: { id: number; name: string }[]): number {
  const read = db.prepare("SELECT gif_url FROM exercises WHERE id = ?");
  const update = db.prepare("UPDATE exercises SET gif_url = ? WHERE id = ?");
  let fixed = 0;
  for (const ex of exercises) {
    const row = read.get(ex.id) as { gif_url: string | null } | undefined;
    const current = row?.gif_url;
    if (!current) {
      const want = getGithubImageUrl(ex.name);
      if (want) {
        update.run(want, ex.id);
        fixed++;
      }
      continue;
    }
    if (!current.startsWith(GITHUB_CDN)) continue;
    const folder = current.slice(GITHUB_CDN.length + 1).split("/")[0] ?? "";
    if (DEAD_FOLDERS.has(folder) || RETIRED_IMAGES[ex.name]?.includes(folder)) {
      update.run(getGithubImageUrl(ex.name), ex.id);
      fixed++;
      continue;
    }
    const want = getGithubImageUrl(ex.name);
    if (!want || current === want) continue;
    // Its own folder stays unless only the frame differs (Plank's frame 1).
    const wantFolder = want.slice(GITHUB_CDN.length + 1).split("/")[0] ?? "";
    if (folderKey(folder) === folderKey(ex.name) && wantFolder !== folder) continue;
    update.run(want, ex.id);
    fixed++;
  }
  return fixed;
}

export async function runGifPrefetch(): Promise<void> {
  const allExercises = db
    .prepare("SELECT id, name FROM exercises")
    .all() as { id: number; name: string }[];

  // Step 1: Correct images set from an older version of the mapping (Plank
  // showed Dead Bug, Good Morning a deadlift). Runs first because it is
  // instant and the MuscleWiki pass below takes minutes.
  const fixed = correctMappedImages(allExercises);
  if (fixed > 0) console.log(`[GIF prefetch] Corrected ${fixed} exercise images.`);

  // Step 2a: Pre-fetch MuscleWiki animated media (runs for exercises not yet cached).
  // This populates exercise_media_cache so the /api/exercises/gif/:name route
  // can serve animated GIFs and MP4 video clips.
  await runMuscleWikiPrefetch(allExercises);

  // Step 2b: Populate the fallback gif_url column with static GitHub CDN images
  // for exercises that still need a static image fallback.
  const exercises = allExercises.filter((ex) => {
    const row = db
      .prepare("SELECT gif_url FROM exercises WHERE id = ?")
      .get(ex.id) as { gif_url: string | null } | undefined;
    return !row?.gif_url;
  });

  if (exercises.length === 0) {
    console.log("[GIF prefetch] All exercises already have fallback image URLs cached.");
    return;
  }

  console.log(`[GIF prefetch] Caching fallback image URLs for ${exercises.length} exercises…`);

  const apiKey = getExerciseDbApiKey();
  const update = db.prepare("UPDATE exercises SET gif_url = ? WHERE id = ?");
  let cached = 0;

  for (const ex of exercises) {
    // First try the local GitHub CDN mapping — instant, no API call needed
    const githubUrl = getGithubImageUrl(ex.name);
    if (githubUrl) {
      update.run(githubUrl, ex.id);
      cached++;
      continue;
    }

    // If not in the local map, try ExerciseDB (if key is set) to find a similar
    // exercise name we can map, then fall back to GitHub CDN for that match.
    if (apiKey) {
      const match = await searchExerciseDB(ex.name, apiKey);
      if (match) {
        const matchUrl = getGithubImageUrl(match.name);
        if (matchUrl) {
          update.run(matchUrl, ex.id);
          cached++;
        }
      }
      await sleep(400);
    }
  }

  console.log(`[GIF prefetch] Done — cached ${cached}/${exercises.length} fallback image URLs.`);
}
