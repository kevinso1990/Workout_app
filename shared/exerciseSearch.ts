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

// ── Forgiving search ─────────────────────────────────────────────────────────
//
// `.includes()` on the whole query only finds an exercise when the user types
// a contiguous slice of its exact name: "dumbbell curls" missed "Dumbbell
// Curl" over one plural "s", and "curls dum" missed it over word order. People
// don't remember catalogue phrasing, so the query is matched word by word:
// every typed word has to be found somewhere in the exercise (names in both
// languages, equipment, muscle), in any order, as a whole word, a word start,
// a piece of a compound ("curl" in "Kurzhantelcurl"), or with a typo.

/** Lowercase, umlauts folded (so "bankdrucken" finds "Bankdrücken"). */
export function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Plural/inflection ending off, so "curls" and "curl" meet. Both sides use it. */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith("es") && !token.endsWith("ses")) return token.slice(0, -1);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function tokenize(s: string): string[] {
  return normalizeSearchText(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem);
}

/**
 * Words people type for an exercise that the catalogue spells differently:
 * abbreviations and the other language. A query word matches if it OR one of
 * its alternatives matches. Multi-word alternatives must all be present.
 */
const SYNONYMS: Record<string, string[]> = {
  db: ["dumbbell"],
  kh: ["kurzhantel", "dumbbell"],
  kurzhantel: ["dumbbell"],
  hantel: ["dumbbell"],
  dumbbell: ["kurzhantel"],
  lh: ["langhantel", "barbell"],
  langhantel: ["barbell"],
  barbell: ["langhantel"],
  kb: ["kettlebell"],
  sz: ["ez"],
  bizep: ["bicep"],
  bicep: ["bizep"],
  trizep: ["tricep"],
  tricep: ["trizep"],
  // The German catalogue names sometimes render "curl" as "Locke".
  curl: ["locke"],
  klimmzug: ["pull up", "pullup", "chin up"],
  klimmzuge: ["pull up", "pullup", "chin up"],
  pullup: ["pull up", "klimmzug"],
  chinup: ["chin up"],
  liegestutz: ["push up", "pushup"],
  pushup: ["push up", "liegestutz"],
  kniebeuge: ["squat"],
  squat: ["kniebeuge"],
  kreuzheben: ["deadlift"],
  deadlift: ["kreuzheben"],
  rdl: ["romanian deadlift"],
  bankdrucken: ["bench press"],
  bench: ["bank"],
  rudern: ["row"],
  row: ["rudern"],
  ohp: ["overhead press"],
  schulterdrucken: ["shoulder press", "overhead press"],
  seitheben: ["lateral raise"],
  latzug: ["lat pulldown", "pulldown"],
  beinpresse: ["leg press"],
  ausfallschritt: ["lunge"],
  lunge: ["ausfallschritt"],
  wadenheben: ["calf raise"],
  hyperextension: ["back extension", "ruckenstrecken"],
  ruckenstrecker: ["hyperextension", "back extension", "ruckenstrecken"],
  hyperext: ["hyperextension"],
  plank: ["unterarmstutz"],
  unterarmstutz: ["plank"],
  dip: ["dip"],
};

/** Levenshtein distance, giving up early once it exceeds `max`. */
function editDistanceWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

/** How well one typed word matches one word of the exercise; 0 = not at all. */
function wordScore(q: string, h: string): number {
  if (q === h) return 4;
  if (h.startsWith(q)) return 3;
  // "kniebeugen" typed, "kniebeuge" stored — the stored word is the shorter one.
  if (h.length >= 4 && q.startsWith(h) && q.length - h.length <= 2) return 3;
  // A piece of a compound: "curl" in "kurzhantelcurl", "druck" in "bankdrucken".
  if (q.length >= 3 && h.includes(q)) return 2;
  // A typo, in the whole word or in its start ("dumbel" → "dumbbell").
  const typos = q.length >= 7 ? 2 : 1;
  if (q.length >= 4 && (editDistanceWithin(q, h, typos) || editDistanceWithin(q, h.slice(0, q.length + 1), typos))) {
    return 1.5;
  }
  return 0;
}

function bestWordScore(q: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    const s = wordScore(q, w);
    if (s > best) best = s;
    if (best === 4) break;
  }
  return best;
}

/** Score of a typed word against a field, trying its synonyms too. */
function queryWordScore(q: string, words: string[], joined: string): number {
  let best = bestWordScore(q, words);
  if (best === 4) return best;
  for (const alt of SYNONYMS[q] ?? []) {
    const altWords = tokenize(alt);
    if (altWords.length === 1) {
      best = Math.max(best, bestWordScore(altWords[0], words) - 0.25);
    } else if (altWords.every((a) => joined.includes(a))) {
      best = Math.max(best, 3.5);
    }
  }
  return best;
}

/**
 * Exercises matching `query`, best first. `names` are the exercise's names
 * (English and German, equally weighted); `extra` are secondary fields
 * (equipment, muscle group) a word may also be found in, at half weight.
 * Every typed word must match somewhere, or the exercise is left out.
 */
export function searchExercises<T>(
  items: T[],
  query: string,
  names: (item: T) => (string | null | undefined)[],
  extra: (item: T) => (string | null | undefined)[] = () => [],
): T[] {
  const qWords = tokenize(query);
  if (qWords.length === 0) return items;
  const qJoined = normalizeSearchText(query).trim();

  const scored: { item: T; score: number; index: number }[] = [];
  items.forEach((item, index) => {
    const nameStrings = names(item).filter((n): n is string => !!n);
    const nameWords = nameStrings.flatMap(tokenize);
    const nameJoined = nameWords.join(" ");
    const extraWords = extra(item).filter((n): n is string => !!n).flatMap(tokenize);
    const extraJoined = extraWords.join(" ");

    let score = 0;
    for (const q of qWords) {
      const inName = queryWordScore(q, nameWords, nameJoined);
      const inExtra = queryWordScore(q, extraWords, extraJoined) / 2;
      const s = Math.max(inName, inExtra);
      if (s === 0) return;
      score += s;
    }
    // Prefer the exercise the user most likely means: the exact name, then a
    // name that starts with what was typed, then the shortest (plainest) one —
    // "Dumbbell Curl" over "Seated Dumbbell Inner Biceps Curl".
    const normalizedNames = nameStrings.map(normalizeSearchText);
    if (normalizedNames.some((n) => n === qJoined)) score += 10;
    else if (normalizedNames.some((n) => n.startsWith(qJoined))) score += 3;
    const shortest = Math.min(...nameStrings.map((n) => tokenize(n).length), 99);
    score -= Math.max(0, shortest - qWords.length) * 0.3;
    scored.push({ item, score, index });
  });

  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.item);
}
