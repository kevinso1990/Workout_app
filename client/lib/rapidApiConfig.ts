/**
 * ExerciseDB (RapidAPI) credentials.
 *
 * Expo / EAS:  EXPO_PUBLIC_RAPIDAPI_KEY
 * Vite web:    VITE_RAPIDAPI_KEY (or VITE_EXPO_PUBLIC_RAPIDAPI_KEY)
 * Server:      RAPIDAPI_KEY
 */

function trimOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readProcessEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return trimOrUndefined(process.env[name]);
}

function readViteEnv(name: string): string | undefined {
  try {
    const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
      .env;
    return trimOrUndefined(env?.[name]);
  } catch {
    return undefined;
  }
}

export function getExerciseDbApiKey(): string | undefined {
  return (
    readProcessEnv("EXPO_PUBLIC_RAPIDAPI_KEY") ||
    readViteEnv("VITE_RAPIDAPI_KEY") ||
    readViteEnv("VITE_EXPO_PUBLIC_RAPIDAPI_KEY") ||
    readProcessEnv("RAPIDAPI_KEY")
  );
}

export function isExerciseDbConfigured(): boolean {
  return !!getExerciseDbApiKey();
}

export const EXERCISEDB_KEY_HINT =
  "Set EXPO_PUBLIC_RAPIDAPI_KEY (Expo) or VITE_RAPIDAPI_KEY (Vite) to load exercise animations.";
