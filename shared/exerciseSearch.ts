/**
 * Relevance ranking for exercise search.
 *
 * Every exercise picker in the app filtered with `.includes()` and then left
 * results in whatever order the catalog happened to be in (muscle_group, then
 * name — see listCatalogExercises). That makes two things look broken that
 * are really just "no ranking":
 *
 * 1. Typing "squat" could show "Kettlebell Goblet Squat" above plain "Squat",
 *    because muscle-group order put it first — not because it's a better
 *    match for what was typed.
 * 2. The exercise picker also matched the EQUIPMENT field, so typing
 *    "kettlebell" pulled in exercises with no "kettlebell" in their name at
 *    all (e.g. "Goblet Squat", equipment=kettlebell) — a scattered run of
 *    same-equipment exercises that look unrelated to the search term, which
 *    is what reads as "it only matches starting with kettlebell": the real
 *    name matches get buried among the equipment matches.
 *
 * The fix is a relevance score, not a different matching rule — the
 * underlying `.includes()` behavior was already correct, it just was never
 * used to ORDER results.
 */

/**
 * Lower is better. Infinity means no match at all.
 *   0 — exact match
 *   1 — starts with the query
 *   2 — query appears at a word boundary (" squat" inside "back squat")
 *   3 — query appears anywhere else in the string
 */
export function textMatchRank(haystack: string, query: string): number {
  const h = haystack.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 3;
  if (h === q) return 0;
  if (h.startsWith(q)) return 1;
  if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(h)) return 2;
  if (h.includes(q)) return 3;
  return Infinity;
}

/**
 * Ranks `items` for a search query. `primary` is matched first (e.g. the
 * exercise name) and always outranks a `secondary` match (e.g. equipment or
 * muscle group) — so a name match is never buried under a pile of
 * same-equipment results. Within equal rank, original order is preserved
 * (stable sort), which keeps the catalog's own muscle_group/name ordering as
 * the tiebreaker rather than reshuffling arbitrarily.
 */
export function sortByRelevance<T>(
  items: T[],
  query: string,
  // A single field (e.g. name), or several equally-weighted ones (e.g. the
  // English AND German exercise name) — the best-matching one wins.
  primary: (item: T) => string | string[],
  secondary?: (item: T) => string[],
): T[] {
  const q = query.trim();
  if (!q) return items;

  const rankOf = (value: string | string[]): number =>
    Array.isArray(value)
      ? Math.min(...value.map((s) => textMatchRank(s, q)), Infinity)
      : textMatchRank(value, q);

  const scored = items.map((item, index) => {
    const primaryRank = rankOf(primary(item));
    const secondaryRank = secondary
      ? Math.min(...secondary(item).map((s) => textMatchRank(s, q)), Infinity)
      : Infinity;
    // A primary (name) match of any quality outranks every secondary match —
    // offset secondary ranks past the primary range (0-3) instead of
    // comparing them directly, so "equipment contains" never beats "name
    // contains", only ever beats other equipment-only matches.
    const rank = primaryRank < Infinity ? primaryRank : secondaryRank + 10;
    return { item, rank, index };
  });

  return scored
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((s) => s.item);
}
