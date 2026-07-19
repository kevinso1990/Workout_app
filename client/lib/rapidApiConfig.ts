/**
 * ExerciseDB (RapidAPI) credentials.
 *
 * Expo / EAS:  EXPO_PUBLIC_RAPIDAPI_KEY (inlined into process.env at build time)
 * Vite web:    VITE_RAPIDAPI_KEY (inlined via vite.config.ts define)
 * Server:      RAPIDAPI_KEY
 *
 * Do NOT use import.meta here — Hermes/Metro native bundles crash on it.
 */

function trimOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getExerciseDbApiKey(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return (
    trimOrUndefined(process.env.EXPO_PUBLIC_RAPIDAPI_KEY) ||
    trimOrUndefined(process.env.VITE_RAPIDAPI_KEY) ||
    trimOrUndefined(process.env.VITE_EXPO_PUBLIC_RAPIDAPI_KEY) ||
    trimOrUndefined(process.env.RAPIDAPI_KEY)
  );
}

export function isExerciseDbConfigured(): boolean {
  return !!getExerciseDbApiKey();
}

export const EXERCISEDB_KEY_HINT =
  "Set EXPO_PUBLIC_RAPIDAPI_KEY (Expo) or VITE_RAPIDAPI_KEY (Vite) to load exercise animations.";
