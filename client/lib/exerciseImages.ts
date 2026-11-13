/**
 * Exercise image utility for TrackYourLift.
 *
 * Images come from the yuhonas/free-exercise-db repository on GitHub.
 * URL format: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{ID}/0.jpg
 *
 * Keys in EXERCISE_IMAGE_IDS cover every name seeded in server/db.ts plus
 * common alternate spellings so existing workout history continues to work.
 */

import { EXERCISE_IMAGE_IDS, exerciseImageFile } from "@shared/exerciseImageIds";

const BASE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

/** Returns the free-exercise-db folder id for the exercise, or null if unmapped. */
export function getExerciseImageId(exerciseName: string): string | null {
  return EXERCISE_IMAGE_IDS[exerciseName] ?? null;
}

/** Returns a GitHub CDN image URL for the exercise, or null if unmapped. */
export function getExerciseImageUrl(exerciseName: string): string | null {
  const id = EXERCISE_IMAGE_IDS[exerciseName];
  if (!id) return null;
  return `${BASE_URL}/${exerciseImageFile(id)}`;
}

/**
 * Returns the start/end demonstration frames for an exercise (free-exercise-db
 * ships two images per movement: `0.jpg` = start, `1.jpg` = end position).
 * Alternating between them in the detail modal produces a lightweight,
 * CORS-free movement animation that always works — no RapidAPI dependency.
 * Returns [] when the exercise is unmapped.
 */
export function getExerciseImageFrames(exerciseName: string): string[] {
  const id = EXERCISE_IMAGE_IDS[exerciseName];
  if (!id) return [];
  return [`${BASE_URL}/${id}/0.jpg`, `${BASE_URL}/${id}/1.jpg`];
}

/**
 * Per-muscle-group visual config used for the fallback card shown when
 * no image is available (unmapped exercise or network error).
 * Covers every muscle_group value used in server/db.ts seedExercises().
 */
export const MUSCLE_GROUP_META: Record<
  string,
  { color: string; icon: string; label: string }
> = {
  Chest:       { color: "#E74C3C", icon: "activity",      label: "Chest" },
  Back:        { color: "#2980B9", icon: "anchor",         label: "Back" },
  Shoulders:   { color: "#8E44AD", icon: "wind",           label: "Shoulders" },
  "Rear Delts":{ color: "#7D3C98", icon: "rotate-ccw",     label: "Rear Delts" },
  Biceps:      { color: "#F39C12", icon: "trending-up",    label: "Biceps" },
  Triceps:     { color: "#E67E22", icon: "zap",            label: "Triceps" },
  Legs:        { color: "#27AE60", icon: "chevrons-up",    label: "Legs" },
  Quads:       { color: "#27AE60", icon: "chevrons-up",    label: "Quads" },
  Hamstrings:  { color: "#16A085", icon: "chevrons-down",  label: "Hamstrings" },
  Calves:      { color: "#1ABC9C", icon: "arrow-down",     label: "Calves" },
  Glutes:      { color: "#D35400", icon: "star",           label: "Glutes" },
  Core:        { color: "#C0392B", icon: "circle",         label: "Core" },
  Traps:       { color: "#5D6D7E", icon: "arrow-up",       label: "Traps" },
  Forearms:    { color: "#F39C12", icon: "trending-up",    label: "Forearms" },
  "Full Body": { color: "#647692", icon: "grid",           label: "Full Body" },
};

/** Returns visual config for a muscle group, with a sensible default. */
export function getMuscleGroupMeta(muscleGroup: string) {
  return (
    MUSCLE_GROUP_META[muscleGroup] ?? {
      color: "#6B7280",
      icon: "activity",
      label: muscleGroup || "Exercise",
    }
  );
}
