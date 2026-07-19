import db from "../db";
import { isLikelyNonExerciseName } from "./importTextParser";

export type ImportMatchQuality = "exact" | "fuzzy" | "uncertain";

export interface ImportExerciseMatch {
  canonicalName: string;
  originalName: string;
  matchQuality: ImportMatchQuality;
  muscleGroup: string;
  /** True when the text match is weak — client should ask the user to pick a catalog exercise. */
  needsUserMapping: boolean;
  catalogExerciseId: number | null;
}

let cachedNames: { name: string; lower: string }[] | null = null;

/**
 * Folds common unilateral/qualifier phrasings to a single canonical form so
 * variations match regardless of wording, e.g. "one armed" / "one-arm" / "1 arm"
 * → "single-arm". Keeps surrounding words intact (used for matching, not display).
 */
function canonicalizeQualifiers(s: string): string {
  return s
    .replace(/\bone[-\s]?armed\b/gi, "single-arm")
    .replace(/\bone[-\s]?arm\b/gi, "single-arm")
    .replace(/\b1[-\s]?arm\b/gi, "single-arm")
    .replace(/\bsingle[-\s]?arm\b/gi, "single-arm")
    .replace(/\bone[-\s]?legged\b/gi, "single-leg")
    .replace(/\bone[-\s]?leg\b/gi, "single-leg")
    .replace(/\bsingle[-\s]?leg\b/gi, "single-leg");
}

/**
 * Normalizes a free-text name to an alias key: lowercase, umlauts folded
 * (ä→a, ö→o, ü→u, ß→ss), then all non-alphanumerics stripped. Lets us match
 * German and abbreviated exercise names to canonical catalog entries.
 */
function normalizeAliasKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Curated synonym → canonical-name map. Keys are alias-normalized.
 * Targets MUST exist in the seeded catalog (see db.ts). Used before fuzzy
 * matching so common abbreviations and German names resolve confidently.
 */
const EXERCISE_ALIASES: Record<string, string> = {
  // English abbreviations / synonyms
  kbswing: "Kettlebell Swing",
  kettlebellswing: "Kettlebell Swing",
  kettlebellswings: "Kettlebell Swing",
  swing: "Kettlebell Swing",
  swings: "Kettlebell Swing",
  hexbar: "Hex Bar Deadlift",
  hexbardeadlift: "Hex Bar Deadlift",
  trapbar: "Trap Bar Deadlift",
  trapbardeadlift: "Trap Bar Deadlift",
  reverselunge: "Reverse Lunge",
  reverselunges: "Reverse Lunge",
  rdl: "Romanian Deadlift",
  romaniandeadlift: "Romanian Deadlift",
  ohp: "Overhead Press",
  bench: "Barbell Bench Press",
  benchpress: "Barbell Bench Press",
  pullup: "Pull-Ups",
  pullups: "Pull-Ups",
  chinup: "Chin-Ups",
  chinups: "Chin-Ups",
  pushup: "Push-Ups",
  pushups: "Push-Ups",
  dips: "Tricep Dips",
  gobletsquat: "Goblet Squat",
  cleanandpress: "Clean and Press",
  turkishgetup: "Kettlebell Turkish Get-Up",
  tgu: "Kettlebell Turkish Get-Up",
  deadhang: "Dead Hang",
  deadhangs: "Dead Hang",
  passivehang: "Dead Hang",
  // Unilateral / positional kettlebell & dumbbell variations
  kneelingsinglearmkettlebellshoulderpress: "Kneeling Single-Arm Kettlebell Press",
  kneelingsinglearmkettlebellpress: "Kneeling Single-Arm Kettlebell Press",
  kneelingkettlebellshoulderpress: "Kneeling Single-Arm Kettlebell Press",
  kneelingkettlebellpress: "Kneeling Single-Arm Kettlebell Press",
  singlearmkettlebellshoulderpress: "Single-Arm Kettlebell Shoulder Press",
  singlearmkettlebellpress: "Single-Arm Kettlebell Shoulder Press",
  halfkneelingkettlebellpress: "Half-Kneeling Kettlebell Press",
  halfkneelingkettlebellshoulderpress: "Half-Kneeling Kettlebell Press",
  seatedkettlebellshoulderpress: "Seated Kettlebell Shoulder Press",
  bottomsupkettlebellpress: "Kettlebell Bottoms-Up Press",
  kettlebellbottomsuppress: "Kettlebell Bottoms-Up Press",
  singlearmkettlebellswing: "Single-Arm Kettlebell Swing",
  singlearmkettlebellrow: "Single-Arm Kettlebell Row",
  kneelingsinglearmdumbbellshoulderpress: "Kneeling Dumbbell Shoulder Press",
  kneelingdumbbellshoulderpress: "Kneeling Dumbbell Shoulder Press",
  kneelingdumbbellpress: "Kneeling Dumbbell Shoulder Press",
  singlearmdumbbellshoulderpress: "Single-Arm Dumbbell Shoulder Press",
  singlearmdumbbellrow: "Single-Arm Dumbbell Row",
  halfkneelinglandminepress: "Half-Kneeling Landmine Press",
  singlearmlandminerow: "Single-Arm Landmine Row",
  // German → canonical
  kniebeuge: "Barbell Squat",
  kniebeugen: "Barbell Squat",
  frontkniebeuge: "Front Squat",
  gobletkniebeuge: "Goblet Squat",
  kreuzheben: "Deadlift",
  kreuzhebengestreckt: "Stiff Leg Deadlift",
  rumanischeskreuzheben: "Romanian Deadlift",
  bankdrucken: "Barbell Bench Press",
  schragbankdrucken: "Incline Barbell Bench Press",
  kurzhantelbankdrucken: "Dumbbell Bench Press",
  klimmzug: "Pull-Ups",
  klimmzuge: "Pull-Ups",
  liegestutz: "Push-Ups",
  liegestutze: "Push-Ups",
  ausfallschritt: "Walking Lunges",
  ausfallschritte: "Walking Lunges",
  ausfallschritteruckwarts: "Reverse Lunge",
  ruckwartsausfallschritt: "Reverse Lunge",
  schulterdrucken: "Overhead Press",
  schulterdruckenkurzhantel: "Dumbbell Shoulder Press",
  langhantelrudern: "Barbell Row",
  rudern: "Barbell Row",
  kurzhantelrudern: "Dumbbell Row",
  bizepscurl: "Dumbbell Curl",
  bizepscurls: "Dumbbell Curl",
  armbeuger: "Dumbbell Curl",
  trizepsdrucken: "Tricep Pushdown",
  wadenheben: "Standing Calf Raise",
  beinpresse: "Leg Press",
  beinstrecker: "Leg Extension",
  beinbeuger: "Leg Curl",
  latzug: "Lat Pulldown",
  planke: "Plank",
  unterarmstutz: "Plank",
  huftheben: "Hip Thrust",
  beckenheben: "Glute Bridge",
  kettlebellschwung: "Kettlebell Swing",
  kettlebellschwunge: "Kettlebell Swing",
  russischerdreher: "Russian Twist",
};

function loadCatalog(): { name: string; lower: string }[] {
  if (cachedNames) return cachedNames;
  const rows = db
    .prepare("SELECT name, muscle_group FROM exercises WHERE is_custom = 0 ORDER BY length(name) ASC, name ASC")
    .all() as { name: string; muscle_group: string }[];
  cachedNames = rows.map((r) => ({ name: r.name, lower: r.name.toLowerCase().trim() }));
  return cachedNames;
}

function loadCatalogByLengthDesc(): { name: string; lower: string }[] {
  return [...loadCatalog()].sort((a, b) => b.lower.length - a.lower.length);
}

/** Match when all significant tokens of a catalog name appear in the input. */
function matchByTokenOverlap(inputLower: string): string | null {
  const inputTokens = inputLower.split(/\s+/).filter((t) => t.length > 1);
  let best: { name: string; score: number } | null = null;

  for (const row of loadCatalogByLengthDesc()) {
    const catTokens = row.lower.split(/\s+/).filter((t) => t.length > 1);
    if (catTokens.length === 0) continue;

    const allPresent = catTokens.every((ct) =>
      inputTokens.some((it) => {
        if (it === ct) return true;
        const shorter = it.length <= ct.length ? it : ct;
        const longer = it.length <= ct.length ? ct : it;
        return shorter.length >= 5 && longer.includes(shorter);
      }),
    );
    if (!allPresent) continue;

    const score = catTokens.length / Math.max(inputTokens.length, 1);
    if (!best || score > best.score || (score === best.score && row.lower.length > best.name.length)) {
      best = { name: row.name, score };
    }
  }
  return best && best.score >= 0.5 ? best.name : null;
}

function muscleGroupForName(canonical: string): string {
  const row = db
    .prepare("SELECT muscle_group FROM exercises WHERE name = ? COLLATE NOCASE LIMIT 1")
    .get(canonical) as { muscle_group: string } | undefined;
  return row?.muscle_group ?? "";
}

function catalogIdForName(canonical: string): number | null {
  const row = db
    .prepare("SELECT id FROM exercises WHERE name = ? COLLATE NOCASE LIMIT 1")
    .get(canonical) as { id: number } | undefined;
  return row?.id ?? null;
}

/** Levenshtein distance for fuzzy matching (bounded cost for ~130 names). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/**
 * Maps a free-text exercise name from OCR/LLM output to a single canonical DB name
 * to avoid duplicate or inconsistent exercise labels in the client.
 */
export function matchExerciseToCatalog(raw: string): ImportExerciseMatch {
  const originalName = raw.trim();
  if (!originalName || isLikelyNonExerciseName(originalName)) {
    return {
      canonicalName: originalName || "Unknown",
      originalName,
      matchQuality: "uncertain",
      muscleGroup: "",
      needsUserMapping: true,
      catalogExerciseId: null,
    };
  }

  const searchName = canonicalizeQualifiers(originalName);
  const lower = searchName.toLowerCase();
  const catalog = loadCatalog();

  for (const row of catalog) {
    if (row.lower === lower) {
      return {
        canonicalName: row.name,
        originalName,
        matchQuality: "exact",
        muscleGroup: muscleGroupForName(row.name),
        needsUserMapping: false,
        catalogExerciseId: catalogIdForName(row.name),
      };
    }
  }

  const aliasTarget = EXERCISE_ALIASES[normalizeAliasKey(searchName)];
  if (aliasTarget) {
    return {
      canonicalName: aliasTarget,
      originalName,
      matchQuality: "exact",
      muscleGroup: muscleGroupForName(aliasTarget),
      needsUserMapping: false,
      catalogExerciseId: catalogIdForName(aliasTarget),
    };
  }

  const tokenMatch = matchByTokenOverlap(lower);
  if (tokenMatch) {
    return {
      canonicalName: tokenMatch,
      originalName,
      matchQuality: "fuzzy",
      muscleGroup: muscleGroupForName(tokenMatch),
      needsUserMapping: false,
      catalogExerciseId: catalogIdForName(tokenMatch),
    };
  }

  // Substring match — prefer longest catalog names first (Trap Bar Deadlift before Deadlift).
  let bestContains: { name: string; score: number } | null = null;
  for (const row of loadCatalogByLengthDesc()) {
    const nl = row.lower;
    if (lower === nl) {
      bestContains = { name: row.name, score: 1 };
      break;
    }
    if (lower.includes(nl) && nl.length >= 8) {
      const score = nl.length / Math.max(lower.length, 1);
      if (!bestContains || score > bestContains.score) bestContains = { name: row.name, score };
    }
    if (nl.includes(lower) && lower.length >= 6) {
      const score = lower.length / Math.max(nl.length, 1);
      if (!bestContains || score > bestContains.score) bestContains = { name: row.name, score };
    }
  }
  if (bestContains && bestContains.score >= 0.45) {
    return {
      canonicalName: bestContains.name,
      originalName,
      matchQuality: "fuzzy",
      muscleGroup: muscleGroupForName(bestContains.name),
      needsUserMapping: false,
      catalogExerciseId: catalogIdForName(bestContains.name),
    };
  }

  // Levenshtein only for short, exercise-like names — never map schedule text to random exercises.
  if (lower.length >= 4 && lower.length <= 40 && !isLikelyNonExerciseName(originalName)) {
    let bestName: string | null = null;
    let bestDist = Infinity;
    for (const row of catalog) {
      const d = levenshtein(lower, row.lower);
      if (d < bestDist) {
        bestDist = d;
        bestName = row.name;
      }
    }
    const threshold = lower.length <= 12 ? 2 : lower.length <= 20 ? 4 : 5;
    if (bestName && bestDist <= threshold) {
      return {
        canonicalName: bestName,
        originalName,
        matchQuality: bestDist <= 1 ? "exact" : "fuzzy",
        muscleGroup: muscleGroupForName(bestName),
        needsUserMapping: false,
        catalogExerciseId: catalogIdForName(bestName),
      };
    }
  }

  return {
    canonicalName: originalName,
    originalName,
    matchQuality: "uncertain",
    muscleGroup: "",
    needsUserMapping: true,
    catalogExerciseId: null,
  };
}

export function invalidateImportExerciseNameCache(): void {
  cachedNames = null;
}
