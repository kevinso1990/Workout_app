#!/usr/bin/env node
/**
 * Grows the exercise catalog from the full yuhonas/free-exercise-db dataset
 * (876 exercises) — the same legally-safe (permissive-licensed) source the
 * app already uses for exercise thumbnails, just not yet for the catalog
 * rows themselves. The local workout.db only has the 235-exercise hand-seeded
 * starter set from server/db.ts; this fills it out properly.
 *
 * Also adds "Pigeon Stretch" and "Couch Stretch" by hand — two well-known
 * mobility moves that free-exercise-db doesn't have under any name (checked
 * directly against the fetched dataset, no near-miss alias either).
 *
 * German names come from scripts/data/freeExerciseDbNamesDe.json (hand
 * translated, gym-German: "Kreuzheben", "Latziehen", "Scott-Curl").
 *
 * Writes a plain .sql file (INSERT OR IGNORE, idempotent against the UNIQUE
 * name column — same pattern server/db.ts already uses for its own seeding)
 * instead of writing to the DB directly, so it has no native dependency and
 * works regardless of which Node build produced the installed
 * better-sqlite3 binary. Apply it with the sqlite3 CLI:
 *
 *   node scripts/import-free-exercise-db.mjs > /tmp/import-exercises.sql
 *   sqlite3 workout.db < /tmp/import-exercises.sql
 */

import { readFileSync } from "node:fs";

const NAMES_DE = JSON.parse(
  readFileSync(new URL("./data/freeExerciseDbNamesDe.json", import.meta.url), "utf8"),
);

const SOURCE_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const GITHUB_CDN =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

// free-exercise-db primaryMuscles[0] -> this app's muscle_group taxonomy
// (matches client/lib/exerciseTaxonomy.ts's MUSCLE_GROUP_KEYS exactly).
const MUSCLE_MAP = {
  chest: "Chest",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abdominals: "Core",
  quadriceps: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
  glutes: "Glutes",
  lats: "Back",
  "middle back": "Back",
  "lower back": "Back",
  traps: "Traps",
  neck: "Shoulders",
  abductors: "Glutes",
  adductors: "Legs",
};

// free-exercise-db equipment -> this app's equipment taxonomy
// (matches client/lib/exerciseTaxonomy.ts's EQUIPMENT_KEYS).
const EQUIPMENT_MAP = {
  "body only": "bodyweight",
  dumbbell: "dumbbell",
  barbell: "barbell",
  cable: "cable",
  machine: "machine",
  kettlebells: "kettlebell",
  bands: "bands",
  "medicine ball": "other",
  "exercise ball": "other",
  "e-z curl bar": "barbell",
  "foam roll": "other",
  other: "other",
};

// Not in free-exercise-db under any name (checked: no "pigeon", "couch", or
// "figure 4" entry, and "Kneeling Hip Flexor" is the closest but distinct
// movement). Original instructions, not copied from any source.
const HAND_ADDED = [
  { name: "Pigeon Stretch", name_de: "Taube-Dehnung", muscle_group: "Glutes", equipment: "bodyweight" },
  { name: "Couch Stretch", name_de: "Couch-Dehnung", muscle_group: "Quads", equipment: "bodyweight" },
];

function mapMuscleGroup(primaryMuscles) {
  return MUSCLE_MAP[primaryMuscles?.[0]] ?? "Core";
}

function mapEquipment(equipment) {
  if (!equipment) return "other";
  return EQUIPMENT_MAP[equipment] ?? "other";
}

function sqlQuote(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`fetch failed: http ${res.status}`);
  const dataset = await res.json();

  const lines = [];
  lines.push("BEGIN;");

  for (const ex of dataset) {
    const gifUrl = `${GITHUB_CDN}/${ex.id}/0.jpg`;
    const muscleGroup = mapMuscleGroup(ex.primaryMuscles);
    const equipment = mapEquipment(ex.equipment);
    lines.push(
      `INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, is_custom, gif_url) VALUES (${sqlQuote(ex.name)}, ${sqlQuote(muscleGroup)}, ${sqlQuote(equipment)}, 0, ${sqlQuote(gifUrl)});`,
    );
    const nameDe = NAMES_DE[ex.name];
    if (nameDe) {
      lines.push(
        `INSERT OR IGNORE INTO exercise_translations (exercise_id, lang, name) SELECT id, 'de', ${sqlQuote(nameDe)} FROM exercises WHERE name = ${sqlQuote(ex.name)};`,
      );
    }
  }

  for (const ex of HAND_ADDED) {
    lines.push(
      `INSERT OR IGNORE INTO exercises (name, muscle_group, equipment, is_custom, gif_url) VALUES (${sqlQuote(ex.name)}, ${sqlQuote(ex.muscle_group)}, ${sqlQuote(ex.equipment)}, 0, NULL);`,
    );
    lines.push(
      `INSERT OR IGNORE INTO exercise_translations (exercise_id, lang, name) SELECT id, 'de', ${sqlQuote(ex.name_de)} FROM exercises WHERE name = ${sqlQuote(ex.name)};`,
    );
  }

  lines.push("COMMIT;");
  console.log(lines.join("\n"));
  console.error(`Wrote ${dataset.length + HAND_ADDED.length} INSERT statements for ${dataset.length} free-exercise-db rows + ${HAND_ADDED.length} hand-added rows.`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
