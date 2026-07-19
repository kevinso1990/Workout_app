import type { ImportedExercise } from "@/hooks/useWorkoutImport";

export type CatalogRow = {
  id: number;
  name: string;
  name_de?: string | null;
  muscle_group: string;
  equipment: string;
};

export function isImportedExerciseUnmapped(ex: ImportedExercise): boolean {
  if (ex.importMeta?.needsUserMapping) return true;
  if (
    typeof ex.catalogExerciseId === "number" &&
    ex.catalogExerciseId > 0 &&
    ex.importMeta?.matchQuality !== "uncertain"
  ) {
    return false;
  }
  if (ex.importMeta?.matchQuality === "uncertain") return true;
  return !ex.catalogExerciseId;
}

/** Closest catalog rows for inline search (original OCR name preferred). */
export function rankCatalogMatches(
  exercise: ImportedExercise,
  rows: CatalogRow[],
  limit = 10,
): CatalogRow[] {
  const needle = (
    exercise.importMeta?.originalName?.trim() ||
    exercise.name.trim()
  ).toLowerCase();
  if (!needle || rows.length === 0) return rows.slice(0, limit);

  const scored = rows
    .map((row) => {
      const name = row.name.toLowerCase();
      let score = 0;
      if (name === needle) score = 100;
      else if (name.startsWith(needle)) score = 80;
      else if (name.includes(needle)) score = 60;
      else if (needle.includes(name) && name.length >= 4) score = 50;
      else {
        const words = needle.split(/\s+/).filter(Boolean);
        const hits = words.filter((w) => name.includes(w)).length;
        score = hits * 12;
      }
      return { row, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return rows
      .filter((r) => r.name.toLowerCase().includes(needle.slice(0, 3)))
      .slice(0, limit);
  }
  return scored.slice(0, limit).map((s) => s.row);
}
