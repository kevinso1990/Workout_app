/**
 * Localized display name for an exercise. `name` stays the canonical English
 * string used everywhere for matching (image lookup, workout history,
 * import alias matching) — this only picks a label to *show* the user.
 */
export function getExerciseDisplayName(
  exercise: { name: string; nameDe?: string | null },
  language: string,
): string {
  if (language.startsWith("de") && exercise.nameDe) return exercise.nameDe;
  return exercise.name;
}
