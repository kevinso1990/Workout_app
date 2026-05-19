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

const GITHUB_CDN =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

const RAPIDAPI_HOST = "exercisedb.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

/**
 * Maps exercise display names → free-exercise-db folder IDs (verified to exist).
 * Covers every exercise seeded in server/db.ts plus common alternates.
 */
const EXERCISE_IMAGE_IDS: Record<string, string> = {
  // ── Chest ──────────────────────────────────────────────────────────
  "Bench Press":                   "Barbell_Bench_Press_-_Medium_Grip",
  "Barbell Bench Press":           "Barbell_Bench_Press_-_Medium_Grip",
  "Incline Barbell Bench Press":   "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "Decline Barbell Bench Press":   "Barbell_Bench_Press_-_Medium_Grip",
  "Dumbbell Bench Press":          "Dumbbell_Bench_Press",
  "Incline Dumbbell Press":        "Incline_Dumbbell_Press",
  "Dumbbell Flyes":                "Dumbbell_Flyes",
  "Cable Flyes":                   "Cable_Crossover",
  "Machine Chest Press":           "Dumbbell_Bench_Press",
  "Pec Deck":                      "Dumbbell_Bench_Press",
  "Push-Ups":                      "Decline_Push-Up",
  "Chest Dips":                    "Dips_-_Chest_Version",
  "Landmine Press":                "Barbell_Shoulder_Press",
  "Diamond Push-Ups":              "Close-Grip_Push-Up_off_of_a_Dumbbell",
  "Dips":                          "Dips_-_Triceps_Version",

  // ── Back ───────────────────────────────────────────────────────────
  "Deadlift":                      "Barbell_Deadlift",
  "Barbell Row":                   "Bent_Over_Barbell_Row",
  "Barbell Rows":                  "Bent_Over_Barbell_Row",
  "Dumbbell Row":                  "Bent_Over_Two-Dumbbell_Row",
  "One-Arm Dumbbell Row":          "One-Arm_Dumbbell_Row",
  "Pendlay Row":                   "Bent_Over_Barbell_Row",
  "T-Bar Row":                     "Lying_T-Bar_Row",
  "Meadows Row":                   "Bent_Over_Barbell_Row",
  "Seated Cable Row":              "Elevated_Cable_Rows",
  "Seated Cable Rows":             "Elevated_Cable_Rows",
  "Lat Pulldown":                  "Close-Grip_Front_Lat_Pulldown",
  "Lat Pulldowns":                 "Close-Grip_Front_Lat_Pulldown",
  "Wide Grip Lat Pulldown":        "Full_Range-Of-Motion_Lat_Pulldown",
  "Wide-Grip Lat Pulldown":        "Full_Range-Of-Motion_Lat_Pulldown",
  "Pull-Ups":                      "Band_Assisted_Pull-Up",
  "Pull Ups":                      "Band_Assisted_Pull-Up",
  "Chin-Ups":                      "Band_Assisted_Pull-Up",
  "Cable Pullover":                "Barbell_Deadlift",
  "Straight Arm Pulldown":         "Barbell_Deadlift",
  "Machine Row":                   "Elevated_Cable_Rows",
  "Chest Supported Row":           "Dumbbell_Incline_Row",
  "Hyperextension":                "Hyperextensions_With_No_Hyperextension_Bench",
  "Trap Bar Deadlift":             "Barbell_Deadlift",
  "Rack Pull":                     "Barbell_Deadlift",
  "Good Morning":                  "Barbell_Deadlift",

  // ── Shoulders ──────────────────────────────────────────────────────
  "Overhead Press":                "Barbell_Shoulder_Press",
  "Dumbbell Shoulder Press":       "Dumbbell_Shoulder_Press",
  "Arnold Press":                  "Arnold_Dumbbell_Press",
  "Lateral Raise":                 "Cable_Seated_Lateral_Raise",
  "Lateral Raises":                "Cable_Seated_Lateral_Raise",
  "Cable Lateral Raise":           "Cable_Seated_Lateral_Raise",
  "Machine Lateral Raise":         "Cable_Seated_Lateral_Raise",
  "Front Raise":                   "Front_Dumbbell_Raise",
  "Front Raises":                  "Front_Dumbbell_Raise",
  "Rear Delt Fly":                 "Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench",
  "Rear Delt Flyes":               "Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench",
  "Face Pull":                     "Face_Pull",
  "Face Pulls":                    "Face_Pull",
  "Upright Row":                   "Barbell_Rear_Delt_Row",
  "Behind The Neck Press":         "Barbell_Shoulder_Press",
  "Machine Shoulder Press":        "Dumbbell_Shoulder_Press",
  "Barbell Shrug":                 "Barbell_Shrug",
  "Dumbbell Shrug":                "Dumbbell_Shrug",
  "Farmer's Walk":                 "Barbell_Shrug",

  // ── Biceps ─────────────────────────────────────────────────────────
  "Bicep Curls":                   "Barbell_Curl",
  "Barbell Curl":                  "Barbell_Curl",
  "Dumbbell Curl":                 "Dumbbell_Bicep_Curl",
  "Hammer Curl":                   "Hammer_Curls",
  "Hammer Curls":                  "Hammer_Curls",
  "Preacher Curl":                 "Machine_Preacher_Curls",
  "Incline Dumbbell Curl":         "Incline_Dumbbell_Curl",
  "Cable Curl":                    "High_Cable_Curls",
  "Concentration Curl":            "Concentration_Curls",
  "EZ-Bar Curl":                   "EZ-Bar_Curl",
  "Spider Curl":                   "Lying_Cable_Curl",
  "Reverse Curl":                  "Barbell_Curl",
  "Bayesian Curl":                 "High_Cable_Curls",

  // ── Triceps ────────────────────────────────────────────────────────
  "Tricep Pushdown":               "Cable_Incline_Pushdown",
  "Tricep Pushdowns":              "Cable_Incline_Pushdown",
  "Skull Crushers":                "EZ-Bar_Skullcrusher",
  "Overhead Tricep Extension":     "Dumbbell_One-Arm_Triceps_Extension",
  "Tricep Dips":                   "Dips_-_Triceps_Version",
  "Tricep Kickback":               "Dumbbell_One-Arm_Triceps_Extension",
  "Close Grip Bench Press":        "Close-Grip_Barbell_Bench_Press",
  "Cable Overhead Extension":      "Dumbbell_One-Arm_Triceps_Extension",
  "JM Press":                      "Close-Grip_Barbell_Bench_Press",

  // ── Legs ───────────────────────────────────────────────────────────
  "Squats":                        "Barbell_Full_Squat",
  "Barbell Squat":                 "Barbell_Full_Squat",
  "Front Squat":                   "Barbell_Full_Squat",
  "Goblet Squat":                  "Goblet_Squat",
  "Hack Squat":                    "Hack_Squat",
  "Leg Press":                     "Leg_Press",
  "Leg Extension":                 "Leg_Extensions",
  "Leg Curl":                      "Lying_Leg_Curls",
  "Leg Curls":                     "Lying_Leg_Curls",
  "Seated Leg Curl":               "Lying_Leg_Curls",
  "Romanian Deadlift":             "Barbell_Deadlift",
  "Stiff Leg Deadlift":            "Barbell_Deadlift",
  "Sumo Deadlift":                 "Barbell_Deadlift",
  "Bulgarian Split Squat":         "Barbell_Side_Split_Squat",
  "Walking Lunges":                "Dumbbell_Lunges",
  "Reverse Lunges":                "Dumbbell_Lunges",
  "Hip Thrust":                    "Barbell_Hip_Thrust",
  "Glute Bridge":                  "Barbell_Glute_Bridge",
  "Step Ups":                      "Barbell_Step_Ups",
  "Sissy Squat":                   "Barbell_Full_Squat",
  "Standing Calf Raise":           "Donkey_Calf_Raises",
  "Seated Calf Raise":             "Barbell_Seated_Calf_Raise",
  "Leg Press Calf Raise":          "Calf_Press_On_The_Leg_Press_Machine",

  // ── Core ───────────────────────────────────────────────────────────
  "Plank":                         "Dead_Bug",
  "Side Plank":                    "Dead_Bug",
  "Russian Twist":                 "Cable_Russian_Twists",
  "Russian Twists":                "Cable_Russian_Twists",
  "Hanging Leg Raise":             "Hanging_Leg_Raise",
  "Cable Crunch":                  "Cable_Crunch",
  "Ab Wheel Rollout":              "Ab_Roller",
  "Mountain Climbers":             "Mountain_Climbers",
  "Dead Bug":                      "Dead_Bug",
  "Crunches":                      "Crunches",
  "Sit-Ups":                       "3_4_Sit-Up",
  "Decline Sit-Ups":               "3_4_Sit-Up",
  "Dragon Flag":                   "Hanging_Leg_Raise",
  "Pallof Press":                  "Cable_Crunch",
  "Woodchoppers":                  "Cable_Crunch",

  // ── Forearms ───────────────────────────────────────────────────────
  "Wrist Curl":                    "Barbell_Curl",
  "Reverse Wrist Curl":            "Barbell_Curl",
  "Plate Pinch":                   "Barbell_Shrug",

  // ── Kettlebell ─────────────────────────────────────────────────────
  "KB Goblet Squat":               "Goblet_Squat",
  "KB Swing":                      "Barbell_Deadlift",
  "KB Romanian Deadlift":          "Barbell_Deadlift",
  "KB Lunges":                     "Dumbbell_Lunges",
  "KB Bulgarian Split Squat":      "Barbell_Side_Split_Squat",
  "KB Calf Raise":                 "Donkey_Calf_Raises",
  "KB Press":                      "Barbell_Shoulder_Press",
  "KB Push Press":                 "Barbell_Shoulder_Press",
  "KB Lateral Raise":              "Cable_Seated_Lateral_Raise",
  "KB Halo":                       "Cable_Seated_Lateral_Raise",
  "KB Floor Press":                "Dumbbell_Bench_Press",
  "KB Squeeze Press":              "Dumbbell_Bench_Press",
  "KB Row":                        "Bent_Over_Two-Dumbbell_Row",
  "KB Renegade Row":               "Bent_Over_Two-Dumbbell_Row",
  "KB High Pull":                  "Barbell_Rear_Delt_Row",
  "KB Clean":                      "Barbell_Deadlift",
  "KB Snatch":                     "Barbell_Deadlift",
  "KB Curl":                       "Dumbbell_Bicep_Curl",
  "KB Hammer Curl":                "Hammer_Curls",
  "KB Overhead Tricep Extension":  "Dumbbell_One-Arm_Triceps_Extension",
  "KB Skull Crusher":              "EZ-Bar_Skullcrusher",
  "KB Turkish Get-Up":             "Dead_Bug",
  "KB Windmill":                   "Cable_Seated_Lateral_Raise",
  "KB Russian Twist":              "Cable_Russian_Twists",
  "KB Farmer's Walk":              "Barbell_Shrug",
};

function getGithubImageUrl(exerciseName: string): string | null {
  const id = EXERCISE_IMAGE_IDS[exerciseName];
  if (!id) return null;
  return `${GITHUB_CDN}/${id}/0.jpg`;
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

export async function runGifPrefetch(): Promise<void> {
  const allExercises = db
    .prepare("SELECT id, name FROM exercises")
    .all() as { id: number; name: string }[];

  // Step 1: Pre-fetch MuscleWiki animated media (runs for exercises not yet cached).
  // This populates exercise_media_cache so the /api/exercises/gif/:name route
  // can serve animated GIFs and MP4 video clips.
  await runMuscleWikiPrefetch(allExercises);

  // Step 2: Populate the fallback gif_url column with static GitHub CDN images
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
