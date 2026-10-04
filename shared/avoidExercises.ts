/**
 * Matching a free-text "avoid" entry against an exercise name.
 *
 * Avoid-list entries come from two places with different shapes: a user
 * typing "Good Mornings" during onboarding, and a name lifted verbatim from a
 * physio's PDF ("Beinheben hängend – einarmig"). Neither is guaranteed to
 * match a catalog name character-for-character, so this does loose
 * case-insensitive matching (exact, or either string containing the other)
 * rather than requiring equality.
 *
 * This deliberately does NOT reuse the import matcher's fuzzy/token/
 * Levenshtein layers. Those are tuned to find the closest exercise for
 * something the user clearly intends to log — optimizing for a match. Here
 * the cost is inverted: a false EXCLUDE silently drops an exercise from a
 * plan for a reason that doesn't exist, which is a worse failure than an
 * avoided exercise slipping through once. So matching stays conservative.
 */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "a", ö: "o", ü: "u", ß: "ss" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True if `name` matches any entry in `avoidList` closely enough to exclude it. */
export function isAvoidedExercise(name: string, avoidList: string[]): boolean {
  if (!name.trim() || avoidList.length === 0) return false;
  const n = normalize(name);
  if (!n) return false;
  return avoidList.some((raw) => {
    const a = normalize(raw);
    if (!a) return false;
    // One-directional on purpose: the EXERCISE name may contain the avoided
    // phrase ("Barbell Good Mornings" contains "Good Mornings" → excluded),
    // but not the reverse. Checking both ways would make avoiding a long,
    // specific phrase ("Reverse Lunge Knee Drive") also exclude any shorter
    // exercise that happens to be a substring of it (plain "Lunge") — a
    // generic movement the user never actually asked to avoid.
    return n === a || n.includes(a);
  });
}

/** Removes avoided exercises from a day's list, by name. */
export function filterAvoidedExercises<T extends { name: string }>(
  exercises: T[],
  avoidList: string[] | undefined,
): T[] {
  if (!avoidList || avoidList.length === 0) return exercises;
  return exercises.filter((ex) => !isAvoidedExercise(ex.name, avoidList));
}

/** De-duplicated, trimmed, length-capped merge — used when saving new avoid entries. */
export function mergeAvoidLists(existing: string[], incoming: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...existing, ...incoming]) {
    const name = raw.trim();
    if (!name) continue;
    const key = normalize(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, 50);
}
