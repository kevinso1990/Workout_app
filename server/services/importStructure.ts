/**
 * Deterministic clean-up of the structure the import model reads out of a
 * plan: rep targets ("20–30 Sek/Seite"), set ranges, supersets, rest and the
 * weekly schedule. The model is told the target format, but anything it gets
 * slightly wrong is fixed here rather than trusted.
 */

export type ImportDayKind = "strength" | "mobility" | "cardio";

export interface RepsTarget {
  /** "6-8", "10", "30-45 s" — null when the row has no target. */
  reps: string | null;
  perSide: boolean;
}

const PER_SIDE = /\s*(?:\/\s*seite|pro\s+seite|je\s+seite|per\s+side|each\s+side|\/\s*side|\/\s*bein|\/\s*arm)\b\.?/i;

/** Normalises a rep/time target to "6-8", "10" or "30-45 s" (+ per-side flag). */
export function normalizeRepsTarget(raw: unknown, perSideHint?: unknown): RepsTarget {
  let perSide = perSideHint === true;
  if (raw === null || raw === undefined || raw === "") return { reps: null, perSide };
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? { reps: String(Math.min(999, Math.floor(raw))), perSide } : { reps: null, perSide };
  }
  let s = String(raw).trim();
  if (PER_SIDE.test(s)) {
    perSide = true;
    s = s.replace(PER_SIDE, " ").trim();
  }
  s = s.replace(/[–—]/g, "-").replace(/\s*-\s*/g, "-");

  const minutes = s.match(/^(\d+)(?:-(\d+))?\s*(?:min|minuten|minutes|mins?)\.?$/i);
  if (minutes) {
    const lo = parseInt(minutes[1], 10) * 60;
    const hi = minutes[2] ? parseInt(minutes[2], 10) * 60 : null;
    return { reps: hi && hi > lo ? `${lo}-${hi} s` : `${lo} s`, perSide };
  }
  const seconds = s.match(/^(\d+)(?:-(\d+))?\s*(?:s|sek|sec|sekunden|seconds|secs)\.?$/i);
  if (seconds) {
    const hi = seconds[2] && parseInt(seconds[2], 10) > parseInt(seconds[1], 10) ? `-${seconds[2]}` : "";
    return { reps: `${seconds[1]}${hi} s`, perSide };
  }
  const count = s.match(/^(\d+)(?:-(\d+))?\s*(?:wdh\.?|reps?|wiederholungen|x)?$/i);
  if (count) {
    const hi = count[2] && parseInt(count[2], 10) > parseInt(count[1], 10) ? `-${count[2]}` : "";
    return { reps: `${count[1]}${hi}`, perSide };
  }
  // "AMRAP", "max" … — keep as written, short.
  return { reps: s.slice(0, 24) || null, perSide };
}

/** Sets as a positive integer; a range ("2-3") takes the upper bound. */
export function normalizeSets(raw: unknown, fallback = 3): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.min(20, Math.floor(raw));
  const m = String(raw ?? "").match(/(\d+)(?:\s*[-–—]\s*(\d+))?/);
  if (!m) return fallback;
  const n = parseInt(m[2] ?? m[1], 10);
  return Number.isFinite(n) && n > 0 ? Math.min(20, n) : fallback;
}

export function normalizeDayKind(raw: unknown, dayName: string): ImportDayKind {
  if (raw === "mobility" || raw === "cardio" || raw === "strength") return raw;
  if (/mobil|dehn|stretch|beweglich|yoga/i.test(dayName)) return "mobility";
  if (/cardio|ausdauer|intervall|conditioning|laufen|running/i.test(dayName)) return "cardio";
  return "strength";
}

const WEEKDAY_WORD =
  "(?:mo|di|mi|do|fr|sa|so|montags?|dienstags?|mittwochs?|donnerstags?|freitags?|samstags?|sonntags?|mon|tue|wed|thu|fri|sat|sun)\\.?";
const TIME_OF_DAY = "(?:abends|morgens|mittags|evening|morning)";
const WEEKDAY_SUFFIX = new RegExp(
  `\\s*(?:\\(\\s*(?:${WEEKDAY_WORD}(?:\\s+${TIME_OF_DAY})?|${TIME_OF_DAY})\\s*\\)|[–—-]\\s*${WEEKDAY_WORD}(?:\\s+${TIME_OF_DAY})?)$`,
  "i",
);

/** "GK A lang – Bein / Hinge (Sa)" → "GK A lang – Bein / Hinge"; "Cardio – So" → "Cardio". */
export function stripWeekdaySuffix(name: string): string {
  const stripped = name.trim().replace(WEEKDAY_SUFFIX, "").trim();
  return stripped || name.trim();
}

export function cleanText(raw: unknown, max = 300): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

export function normalizeSuperset(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toUpperCase().replace(/^SUPERSET\s*/, "");
  return /^[A-Z][0-9]?$/.test(s) ? s.charAt(0) : null;
}

export function normalizeRestSeconds(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n >= 10 && n <= 600 ? Math.round(n) : null;
}

const WEEKDAY_KEYS: Record<string, number> = {
  mon: 0, mo: 0, montag: 0, monday: 0,
  tue: 1, di: 1, dienstag: 1, tuesday: 1,
  wed: 2, mi: 2, mittwoch: 2, wednesday: 2,
  thu: 3, do: 3, donnerstag: 3, thursday: 3,
  fri: 4, fr: 4, freitag: 4, friday: 4,
  sat: 5, sa: 5, samstag: 5, saturday: 5,
  sun: 6, so: 6, sonntag: 6, sunday: 6,
};

export function parseWeekday(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 6) return raw;
  const key = String(raw ?? "").trim().toLowerCase().replace(/\.$/, "");
  return key in WEEKDAY_KEYS ? WEEKDAY_KEYS[key] : null;
}

function nameKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");
}

/** Day index for a schedule's dayName: exact, then loose, then prefix ("GK A kurz" ↔ "GK A kurz – Bein / Hinge"). */
function resolveDayIndex(dayName: unknown, dayNames: string[]): number {
  if (typeof dayName !== "string" || !dayName.trim()) return -1;
  const exact = dayNames.indexOf(dayName.trim());
  if (exact >= 0) return exact;
  const k = nameKey(dayName);
  if (!k) return -1;
  const loose = dayNames.findIndex((n) => nameKey(n) === k);
  if (loose >= 0) return loose;
  const prefixed = dayNames
    .map((n, i) => ({ i, nk: nameKey(n) }))
    .filter(({ nk }) => nk.startsWith(k) || k.startsWith(nk));
  return prefixed.length === 1 ? prefixed[0].i : -1;
}

export interface ImportScheduleEntry {
  weekday: number;
  dayIndex: number;
}

/**
 * Model schedule ({ weeks: [{ sessions: [{ weekday, dayName }] }] }) → week
 * lists of { weekday, dayIndex }. Unresolvable sessions are dropped; one
 * session per weekday per week; empty weeks are dropped; a cycle whose weeks
 * are all identical collapses to one week.
 */
export function normalizeSchedule(raw: unknown, dayNames: string[]): ImportScheduleEntry[][] {
  const weeksRaw = (raw as { weeks?: unknown } | null)?.weeks;
  if (!Array.isArray(weeksRaw)) return [];
  const weeks: ImportScheduleEntry[][] = [];
  for (const w of weeksRaw.slice(0, 8)) {
    const sessions = Array.isArray(w) ? w : (w as { sessions?: unknown } | null)?.sessions;
    if (!Array.isArray(sessions)) continue;
    const byWeekday = new Map<number, number>();
    for (const s of sessions) {
      const e = s as { weekday?: unknown; dayName?: unknown };
      const weekday = parseWeekday(e?.weekday);
      const dayIndex = resolveDayIndex(e?.dayName, dayNames);
      if (weekday === null || dayIndex < 0 || byWeekday.has(weekday)) continue;
      byWeekday.set(weekday, dayIndex);
    }
    if (byWeekday.size === 0) continue;
    weeks.push([...byWeekday.entries()].sort((a, b) => a[0] - b[0]).map(([weekday, dayIndex]) => ({ weekday, dayIndex })));
  }
  const signature = (w: ImportScheduleEntry[]) => w.map((e) => `${e.weekday}:${e.dayIndex}`).join(",");
  if (weeks.length > 1 && weeks.every((w) => signature(w) === signature(weeks[0]))) return [weeks[0]];
  return weeks;
}
