/**
 * Reading the structure a plan carries beyond sets × reps: supersets, rest,
 * timed targets. Shared by the import review, the plan view and the workout.
 */

/**
 * "A1", "A2", "B1" … per exercise, null outside a superset. A block letter
 * used by a single exercise is no superset and gets no label.
 */
export function supersetLabels(exercises: { superset?: string | null }[]): (string | null)[] {
  const counts = new Map<string, number>();
  for (const e of exercises) if (e.superset) counts.set(e.superset, (counts.get(e.superset) ?? 0) + 1);
  const seen = new Map<string, number>();
  return exercises.map((e) => {
    if (!e.superset || (counts.get(e.superset) ?? 0) < 2) return null;
    const n = (seen.get(e.superset) ?? 0) + 1;
    seen.set(e.superset, n);
    return `${e.superset}${n}`;
  });
}

/** Indexes of the exercises sharing `index`'s superset, in plan order (≥ 2), else null. */
export function supersetMembers(exercises: { superset?: string | null }[], index: number): number[] | null {
  const group = exercises[index]?.superset;
  if (!group) return null;
  const members = exercises.flatMap((e, i) => (e.superset === group ? [i] : []));
  return members.length >= 2 ? members : null;
}

/** Target is a time ("30-45 s", "45 Sek.") rather than a rep count. */
export function isTimedTarget(reps: string | null | undefined): boolean {
  return !!reps && /\d\s*(?:s|sek\.?|sec|sekunden|seconds)$/i.test(reps.trim());
}

/** "90 s" (as plans write it), "2 min", "3:30 min". */
export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 1 && s === 0) return `${m} min`;
  if (seconds < 180) return `${seconds} s`;
  return `${m}:${String(s).padStart(2, "0")} min`;
}

/**
 * Two-line caption for a session in a narrow day column. "Ganzkörper A" →
 * "Ganzkörper" / "A"; "GK A kurz – Bein / Hinge" → "GK A" / "kurz" — the
 * subtitle after the dash never fits, and shrinking the whole name to one
 * line made it unreadably small.
 */
export function weekStripCaption(label: string): [string, string | null] {
  const head = label.split(/\s[–—-]\s|:/)[0].trim() || label;
  const letter = head.match(/^(.*) ([A-Z])$/);
  if (letter) return [letter[1], letter[2]];
  const words = head.split(/\s+/);
  if (words.length >= 2) return [words.slice(0, -1).join(" "), words[words.length - 1]];
  return [head, null];
}

/**
 * "GK A · GK B · Mobility" — what a plan trains, short enough for one line
 * under its name. Plan names alone ("Mein Trainingsplan", "Wochenplan")
 * rarely tell two plans apart; their sessions do.
 */
export function planDaySummary(dayNames: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of dayNames) {
    const short = name
      .split(/\s[–—-]\s|:/)[0]
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s+(kurz|lang|short|long)$/i, "")
      .trim();
    const key = short.toLowerCase();
    if (!short || seen.has(key)) continue;
    seen.add(key);
    out.push(short);
  }
  // "Ganzkörper A · Ganzkörper B" → "Ganzkörper A · B": a run of lettered
  // sessions shares its name once.
  return out
    .map((name, i) => {
      const m = name.match(/^(.+) ([A-Z])$/);
      const prev = i > 0 ? out[i - 1].match(/^(.+) ([A-Z])$/) : null;
      return m && prev && prev[1] === m[1] ? m[2] : name;
    })
    .join(" · ");
}
