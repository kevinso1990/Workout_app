import db from "../db";

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

function loadCatalog(): { name: string; lower: string }[] {
  if (cachedNames) return cachedNames;
  const rows = db
    .prepare("SELECT name, muscle_group FROM exercises WHERE is_custom = 0 ORDER BY length(name) ASC, name ASC")
    .all() as { name: string; muscle_group: string }[];
  cachedNames = rows.map((r) => ({ name: r.name, lower: r.name.toLowerCase().trim() }));
  return cachedNames;
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
  if (!originalName) {
    return {
      canonicalName: "Plank",
      originalName: "",
      matchQuality: "uncertain",
      muscleGroup: muscleGroupForName("Plank"),
      needsUserMapping: true,
      catalogExerciseId: catalogIdForName("Plank"),
    };
  }

  const lower = originalName.toLowerCase();
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

  let bestContains: { name: string; score: number } | null = null;
  for (const row of catalog) {
    const nl = row.lower;
    if (nl.includes(lower) && lower.length >= 3) {
      const score = lower.length / Math.max(nl.length, 1);
      if (!bestContains || score > bestContains.score) bestContains = { name: row.name, score };
    }
    if (lower.includes(nl) && nl.length >= 4) {
      const score = nl.length / Math.max(lower.length, 1);
      if (!bestContains || score > bestContains.score) bestContains = { name: row.name, score };
    }
  }
  if (bestContains && bestContains.score >= 0.35) {
    return {
      canonicalName: bestContains.name,
      originalName,
      matchQuality: "fuzzy",
      muscleGroup: muscleGroupForName(bestContains.name),
      needsUserMapping: false,
      catalogExerciseId: catalogIdForName(bestContains.name),
    };
  }

  let bestName = catalog[0]?.name ?? "Plank";
  let bestDist = Infinity;
  for (const row of catalog) {
    const d = levenshtein(lower, row.lower);
    if (d < bestDist) {
      bestDist = d;
      bestName = row.name;
    }
  }

  const maxLen = Math.max(originalName.length, 6);
  const threshold = maxLen <= 10 ? 3 : maxLen <= 18 ? 5 : 7;
  const quality: ImportMatchQuality = bestDist <= 1 ? "exact" : bestDist <= threshold ? "fuzzy" : "uncertain";
  const needsUserMapping = quality === "uncertain";

  return {
    canonicalName: bestName,
    originalName,
    matchQuality: quality,
    muscleGroup: muscleGroupForName(bestName),
    needsUserMapping,
    catalogExerciseId: catalogIdForName(bestName),
  };
}

export function invalidateImportExerciseNameCache(): void {
  cachedNames = null;
}
