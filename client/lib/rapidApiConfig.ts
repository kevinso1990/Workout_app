/**
 * ExerciseDB (RapidAPI) credentials for the mobile app.
 *
 * EAS / production builds: set EXPO_PUBLIC_RAPIDAPI_KEY in EAS Secrets (baked at build time).
 * Local dev: same key in root .env.
 *
 * RAPIDAPI_KEY is an optional alias for server-side parity when sharing one .env file.
 */

export function getExerciseDbApiKey(): string | undefined {
  const key =
    process.env.EXPO_PUBLIC_RAPIDAPI_KEY?.trim() ||
    process.env.RAPIDAPI_KEY?.trim();
  return key || undefined;
}

export function isExerciseDbConfigured(): boolean {
  return !!getExerciseDbApiKey();
}
