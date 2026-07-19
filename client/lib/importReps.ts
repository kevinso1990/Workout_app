import type { ImportedExercise } from "@/hooks/useWorkoutImport";

/** Value shown in the review reps field (supports ranges like 8-12). */
export function repsInputValue(ex: ImportedExercise): string {
  if (typeof ex.reps === "string") return ex.reps;
  if (ex.reps !== null && ex.reps !== undefined && Number.isFinite(ex.reps)) {
    return String(ex.reps);
  }
  return "";
}

/** Normalize user input: integer, range string, or partial range while typing. */
export function parseRepsInput(text: string): number | string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const rangeMatch = trimmed.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]}`;
  }

  const plusMatch = trimmed.match(/^(\d+)\+$/);
  if (plusMatch) {
    return `${plusMatch[1]}+`;
  }

  if (/^\d+\s*[-–]\s*$/.test(trimmed)) {
    return trimmed.replace(/\s/g, "").replace("–", "-");
  }

  if (/^\d+\+$/.test(trimmed)) {
    return trimmed;
  }

  if (/^[\d+\-–\s]+$/.test(trimmed) && /\+/.test(trimmed)) {
    return trimmed.replace(/\s/g, "").replace("–", "-");
  }

  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) ? Math.min(120, Math.max(0, n)) : null;
  }

  if (/^[\d\s\-–]+$/.test(trimmed)) {
    return trimmed.replace(/\s/g, "").replace("–", "-");
  }

  return trimmed;
}

/** Plan storage `reps` column (always a display string). */
export function repsToPlanString(reps: ImportedExercise["reps"]): string {
  if (typeof reps === "string") return reps.trim();
  if (reps !== null && reps !== undefined && Number.isFinite(reps)) {
    return String(reps);
  }
  return "";
}
