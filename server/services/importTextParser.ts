/**
 * Rule-based workout plan extraction from plain text (PDF text layer or
 * spreadsheet CSV). Used as primary path for text imports and as fallback
 * when Gemini/Claude quota is exhausted.
 */

export interface ParsedImportExercise {
  name: string;
  sets: number;
  reps: number | null;
  weight: number | null;
  notes: string | null;
}

export interface ParsedImportDay {
  dayName: string;
  exercises: ParsedImportExercise[];
}

export interface ParsedImportPlan {
  planName: string;
  days: ParsedImportDay[];
}

const DAY_HEADER =
  /^(?:#{1,3}\s*)?(?:day|tag|workout|session|training|woche|week|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|monday|tuesday|wednesday|thursday|friday|saturday|sunday|push|pull|legs|upper|lower|ganzkörper|full\s*body)\s*[-–—:]?\s*([a-z0-9äöüß]+)?/i;

const SETS_REPS_PATTERNS: RegExp[] = [
  // 3x10, 3 x 10, 3×10, 3×10-12
  /(\d{1,2})\s*[x×]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/i,
  // 4 sets x 8 reps / 4 Sätze x 10 Wdh
  /(\d{1,2})\s*(?:sets?|sätze?|satz)\s*[x×]\s*(\d{1,3})(?:\s*(?:reps?|wdh\.?|wiederholungen?))?/i,
  // 3 @ 10
  /(\d{1,2})\s*@\s*(\d{1,3})/i,
];

// 80kg, 80 kg, 80,5kg, @ 80kg, x 100 kg — German decimal comma supported.
const WEIGHT_PATTERN = /(?:@\s*)?(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:kg|kilo|kilogramm)\b/i;

/** Pull a target weight (kg) out of a line, returning the weight and the line with that mention removed. */
function extractWeight(line: string): { weight: number | null; rest: string } {
  const m = line.match(WEIGHT_PATTERN);
  if (!m) return { weight: null, rest: line };
  const weight = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(weight)) return { weight: null, rest: line };
  const rest = line
    .replace(m[0], "")
    .replace(/,\s*,/g, ",")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
  return { weight, rest };
}

const SKIP_LINE =
  /^(?:page|seite|\d+\s*\/\s*\d+|copyright|www\.|http|email|tel\.|phone|sets?\s*reps?|sätze|wdh|exercise|übung|name|notes?|bemerkung)/i;

/** Lines that are schedule/meta text, NOT exercises. */
const NON_EXERCISE_LINE =
  /\b(?:bei\s+\d+x\s*\/?\s*woche|wochenstruktur|mo\s*\+\s*do|di\s*\+\s*fr|bürotag|büro\s*tag|cardio|mobility|warm-?up|aufwärmen|physio|einleitung|deload|stretching|yoga|pilates|cooldown|regeneration)\b/i;

/** Headers that start a strength day block (GK A/B/C, Tag 1, Day A, …). */
const STRENGTH_DAY_HEADER =
  /^(?:#{1,3}\s*)?(?:GK\s*[ABCabc]|Ganzkörper\s*[ABCabc]|GZ\s*[ABCabc]|Tag\s*\d+|Day\s*[ABCabc\d]|Training\s*[ABCabc]|Workout\s*[ABCabc]|Session\s*[ABCabc])/i;

/** Section titles to skip entirely (not strength lists). */
const IGNORE_SECTION_HEADER =
  /^(?:warm-?up|aufwärmen|mobility|cardio|bürotag|büro|einleitung|physio|stretch|cooldown|deload|wochenstruktur|office|regeneration|conditioning)\b/i;

/**
 * Extract only GK A/B/C (and similar strength-day) sections from a long PDF text.
 * Drops intros, warm-up, cardio, Bürotage, and schedule notes.
 */
export function extractStrengthDaySections(fullText: string): string {
  const lines = fullText.split(/\r?\n/);
  const sections: string[] = [];
  let current: string[] = [];
  let inStrength = false;

  const flush = () => {
    if (current.length > 0) sections.push(current.join("\n"));
    current = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (STRENGTH_DAY_HEADER.test(line)) {
      flush();
      current = [line];
      inStrength = true;
      continue;
    }

    if (IGNORE_SECTION_HEADER.test(line) || NON_EXERCISE_LINE.test(line)) {
      if (inStrength) flush();
      inStrength = false;
      continue;
    }

    if (inStrength) {
      current.push(line);
    }
  }
  flush();

  const joined = sections.join("\n\n").trim();
  return joined.length > 0 ? joined : fullText;
}

export function isLikelyNonExerciseName(name: string): boolean {
  const n = name.trim();
  if (n.length < 3) return true;
  if (NON_EXERCISE_LINE.test(n)) return true;
  if (/^\d+x\s*\/?\s*woche/i.test(n)) return true;
  if (/^(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|monday|tuesday|wednesday|thursday|friday)\b/i.test(n) && !/\d/.test(n)) {
    return true;
  }
  // Schedule fragments without exercise-like words
  if (/:\s*(?:mo|di|mi|do|fr|sa|so)\b/i.test(n) && n.length < 50) return true;
  return false;
}

function stripSetsRepsFromName(name: string): string {
  return name
    .replace(/\d{1,2}\s*[x×]\s*\d{1,3}(?:\s*[-–—]\s*\d{1,3})?/gi, "")
    .replace(/\d{1,2}\s*(?:sets?|sätze?|satz)\s*[x×]\s*\d{1,3}(?:\s*(?:reps?|wdh\.?|wiederholungen?))?/gi, "")
    .replace(/\d{1,2}\s*@\s*\d{1,3}/gi, "")
    .replace(/^[\d.)]+\s*/, "")
    .replace(/^[-–—•*]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseSetsReps(
  line: string,
): { sets: number; reps: number | null; repsMax: number | null; rest: string } | null {
  for (const re of SETS_REPS_PATTERNS) {
    const m = line.match(re);
    if (!m) continue;
    const sets = parseInt(m[1], 10);
    const reps = parseInt(m[2], 10);
    const repsMax = m[3] !== undefined ? parseInt(m[3], 10) : NaN;
    if (!Number.isFinite(sets) || sets <= 0 || sets > 20) continue;
    const rest = line.replace(re, "").trim();
    return {
      sets,
      reps: Number.isFinite(reps) ? reps : null,
      repsMax: Number.isFinite(repsMax) && repsMax > reps ? repsMax : null,
      rest,
    };
  }
  return null;
}

/** "8-12" style note when a rep range was given, otherwise null. */
function repsRangeNote(reps: number | null, repsMax: number | null): string | null {
  return reps !== null && repsMax !== null ? `${reps}-${repsMax} Wdh.` : null;
}

/** Parse a spreadsheet Reps cell — plain "10" or a range "8-12" (note preserves the range). */
function parseRepsCell(raw: string | undefined): { reps: number | null; note: string | null } {
  if (!raw) return { reps: null, note: null };
  const range = raw.match(/(\d{1,3})\s*[-–—]\s*(\d{1,3})/);
  if (range) {
    const lo = parseInt(range[1], 10);
    const hi = parseInt(range[2], 10);
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) {
      return { reps: lo, note: repsRangeNote(lo, hi) };
    }
  }
  const reps = parseInt(raw, 10);
  return { reps: Number.isFinite(reps) ? reps : null, note: null };
}

/** Split "Exercise Name    4 x 10" on tabs or 2+ spaces. */
function splitColumns(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((s) => s.trim()).filter(Boolean);
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  return [line.trim()];
}

function parseColumnRow(cols: string[]): ParsedImportExercise | null {
  if (cols.length === 0) return null;
  const { weight: colWeight, rest: joinedNoWeight } = extractWeight(cols.join(" "));
  const parsed = parseSetsReps(joinedNoWeight);
  if (parsed && parsed.rest.length >= 2) {
    return {
      name: stripSetsRepsFromName(parsed.rest),
      sets: parsed.sets,
      reps: parsed.reps,
      weight: colWeight,
      notes: repsRangeNote(parsed.reps, parsed.repsMax),
    };
  }
  if (cols.length >= 3) {
    const { weight: nameWeight, rest: nameNoWeight } = extractWeight(cols[0]);
    const name = stripSetsRepsFromName(nameNoWeight);
    const sets = parseInt(cols[1], 10);
    const reps = parseInt(cols[2], 10);
    const weight = colWeight ?? nameWeight ?? (cols.length >= 4 && /^\d+([.,]\d+)?$/.test(cols[3]) ? parseFloat(cols[3].replace(",", ".")) : null);
    if (name.length >= 2 && Number.isFinite(sets) && sets > 0) {
      return { name, sets, reps: Number.isFinite(reps) ? reps : null, weight, notes: null };
  }
  }
  if (cols.length === 1) {
    const { weight, rest } = extractWeight(cols[0]);
    const name = stripSetsRepsFromName(rest);
    if (name.length >= 3) return { name, sets: 3, reps: null, weight, notes: null };
  }
  return null;
}

function parseCsvBlock(block: string): ParsedImportPlan | null {
  const lines = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const headerIdx = lines.findIndex((l) => /exercise|übung|movement/i.test(l));
  const dataLines = headerIdx >= 0 ? lines.slice(headerIdx + 1) : lines.slice(1);
  if (dataLines.length === 0) return null;

  // Optional dedicated weight column, e.g. "Day,Exercise,Sets,Reps,Weight" / "...,Gewicht".
  const headerCols = headerIdx >= 0 ? lines[headerIdx].split(",").map((c) => c.trim().replace(/^"|"$/g, "")) : [];
  const weightColIdx = headerCols.findIndex((c) => /weight|gewicht|kg/i.test(c));

  const dayMap = new Map<string, ParsedImportExercise[]>();
  let defaultDay = "Day 1";

  for (const line of dataLines) {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 2) continue;

    // Day,Exercise,Sets,Reps  OR  Exercise,Sets,Reps
    let dayName = defaultDay;
    let name: string;
    let sets = 3;
    let repsCell: { reps: number | null; note: string | null } = { reps: null, note: null };

    if (cols.length >= 4 && /day|tag|workout/i.test(cols[0]) === false) {
      dayName = cols[0] || defaultDay;
      name = cols[1];
      sets = parseInt(cols[2], 10) || 3;
      repsCell = parseRepsCell(cols[3]);
    } else if (cols.length >= 3) {
      if (/day|tag/i.test(cols[0])) {
        dayName = cols[0];
        name = cols[1];
        sets = parseInt(cols[2], 10) || 3;
        repsCell = parseRepsCell(cols[3]);
      } else {
        name = cols[0];
        sets = parseInt(cols[1], 10) || 3;
        repsCell = parseRepsCell(cols[2]);
      }
    } else {
      name = cols[0];
    }

    const { weight: inlineWeight, rest: nameNoWeight } = extractWeight(name);
    name = stripSetsRepsFromName(nameNoWeight);
    if (!name || name.length < 2) continue;

    const colWeight = weightColIdx >= 0 && cols[weightColIdx] ? parseFloat(cols[weightColIdx].replace(",", ".")) : NaN;
    const weight = Number.isFinite(colWeight) ? colWeight : inlineWeight;

    if (!dayMap.has(dayName)) dayMap.set(dayName, []);
    dayMap.get(dayName)!.push({ name, sets, reps: repsCell.reps, weight, notes: repsCell.note });
  }

  if (dayMap.size === 0) return null;
  const days = [...dayMap.entries()].map(([dayName, exercises]) => ({ dayName, exercises }));
  const totalEx = days.reduce((n, d) => n + d.exercises.length, 0);
  if (totalEx < 2) return null;

  return { planName: "Imported Plan", days };
}

function parseFreeformText(text: string, minExercises = 2): ParsedImportPlan | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  if (lines.length < 2) return null;

  let planName = "Imported Plan";
  let startIdx = 0;
  const first = lines[0];
  if (
    first.length <= 60 &&
    !SETS_REPS_PATTERNS.some((re) => re.test(first)) &&
    !DAY_HEADER.test(first)
  ) {
    planName = first.replace(/^#+\s*/, "").trim() || planName;
    startIdx = 1;
  }

  const days: ParsedImportDay[] = [];
  let current: ParsedImportDay = { dayName: "Day 1", exercises: [] };

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP_LINE.test(line)) continue;
    if (line.toLowerCase() === planName.toLowerCase()) continue;

    const dayMatch = line.match(DAY_HEADER);
    if (dayMatch && line.length < 80 && !parseSetsReps(line)) {
      if (current.exercises.length > 0) days.push(current);
      current = { dayName: line.replace(/^#+\s*/, "").trim(), exercises: [] };
      continue;
    }

    const { weight: lineWeight, rest: lineNoWeight } = extractWeight(line);
    const parsed = parseSetsReps(lineNoWeight);
    if (parsed) {
      const name = stripSetsRepsFromName(parsed.rest);
      if (name.length >= 2) {
        current.exercises.push({
          name,
          sets: parsed.sets,
          reps: parsed.reps,
          weight: lineWeight,
          notes: repsRangeNote(parsed.reps, parsed.repsMax),
        });
      }
      continue;
    }

    const cols = splitColumns(line);
    if (cols.length >= 2) {
      const row = parseColumnRow(cols);
      if (row && row.name.length >= 2) {
        current.exercises.push(row);
        continue;
      }
    }

    // Line with only exercise name (no sets/reps) — still capture if plausible
    const bare = stripSetsRepsFromName(lineNoWeight);
    if (
      bare.length >= 4 &&
      bare.length <= 80 &&
      /[a-zäöüß]/i.test(bare) &&
      !/^\d+$/.test(bare) &&
      !isLikelyNonExerciseName(bare)
    ) {
      current.exercises.push({ name: bare, sets: 3, reps: null, weight: lineWeight, notes: null });
    }
  }

  if (current.exercises.length > 0) days.push(current);
  const totalEx = days.reduce((n, d) => n + d.exercises.length, 0);
  if (totalEx < minExercises) return null;

  return { planName, days };
}

/** Parse spreadsheet or PDF plain text into a structured plan (no AI). */
export function parseWorkoutTextImport(text: string, opts?: { minExercises?: number }): ParsedImportPlan | null {
  const minExercises = opts?.minExercises ?? 2;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Spreadsheet/CSV: parse full text so column headers are preserved.
  const sheetBlocks = trimmed.split(/\n\n+/);
  for (const block of sheetBlocks) {
    if (block.includes(",") && (/exercise|übung|sets|sätze|reps|wdh/i.test(block))) {
      const csvPlan = parseCsvBlock(block.replace(/^### Sheet:[^\n]*\n?/i, ""));
      if (csvPlan) return csvPlan;
    }
  }

  if (trimmed.includes(",") && /exercise|übung/i.test(trimmed)) {
    const csvPlan = parseCsvBlock(trimmed);
    if (csvPlan) return csvPlan;
  }

  const focused = extractStrengthDaySections(trimmed);
  return parseFreeformText(focused.trim(), minExercises);
}

/** True when text is tabular (spreadsheet export) — skip PDF section slicing. */
export function isSpreadsheetLikeText(text: string): boolean {
  return text.includes(",") && /exercise|übung|sets|sätze|reps|wdh/i.test(text);
}

export function isAiQuotaOrBillingError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("prepayment credits") ||
    msg.includes("credit") && msg.includes("depleted") ||
    msg.includes("resource exhausted") ||
    msg.includes("quota") ||
    msg.includes("billing") ||
    msg.includes("429")
  );
}
