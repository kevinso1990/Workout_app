/** Server-side ExerciseDB (RapidAPI) — used by gif prefetch and catalog fallbacks. */
export function getExerciseDbApiKey(): string | undefined {
  const key =
    process.env.RAPIDAPI_KEY?.trim() ||
    process.env.EXPO_PUBLIC_RAPIDAPI_KEY?.trim() ||
    process.env.VITE_RAPIDAPI_KEY?.trim() ||
    process.env.VITE_EXPO_PUBLIC_RAPIDAPI_KEY?.trim();
  return key || undefined;
}
