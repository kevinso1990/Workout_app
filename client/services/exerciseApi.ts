/**
 * ExerciseDB (RapidAPI) — animated GIFs + official instructions for modal display.
 * List thumbnails stay static; GIFs load only in popups.
 */

import * as FileSystem from "expo-file-system/legacy";

import { getExerciseDbApiKey } from "@/lib/rapidApiConfig";
import { parseJsonFromText, readResponseBodyAsText } from "@/lib/fetchBody";

const RAPIDAPI_HOST = "exercisedb.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

export type ExerciseDbDetail = {
  gifUrl: string | null;
  instructions: string[];
};

type ExerciseDbRow = {
  id?: string;
  name?: string;
  gifUrl?: string;
  instructions?: string[];
};

const detailCache = new Map<string, ExerciseDbDetail | null>();
const inflight = new Map<string, Promise<ExerciseDbDetail | null>>();

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function rapidHeaders(apiKey: string): Record<string, string> {
  return {
    "x-rapidapi-key": apiKey,
    "x-rapidapi-host": RAPIDAPI_HOST,
  };
}

function pickBestMatch(rows: ExerciseDbRow[], exerciseName: string): ExerciseDbRow | null {
  if (!rows.length) return null;
  const target = normalizeName(exerciseName);
  return (
    rows.find((r) => r.name && normalizeName(r.name) === target) ??
    rows.find((r) => r.name && normalizeName(r.name).includes(target)) ??
    rows.find((r) => r.name && target.includes(normalizeName(r.name))) ??
    rows[0]
  );
}

const INSTRUCTION_NOISE_PATTERNS: RegExp[] = [
  /rapidapi/i,
  /exercisedb\.p\.rapidapi/i,
  /powered\s+by/i,
  /api\s*credit/i,
  /developer\s+account/i,
  /subscribe\s+to\s+unlock/i,
  /x-rapidapi-key/i,
  /exercise\s*db\s*api/i,
];

function isInstructionNoise(step: string): boolean {
  const s = step.trim();
  if (s.length < 12) return true;
  if (/^https?:\/\/\S+$/i.test(s)) return true;
  if (/\.(gif|jpe?g|png|webp|svg)(\?|$)/i.test(s)) return true;
  return INSTRUCTION_NOISE_PATTERNS.some((re) => re.test(s));
}

/** Removes API attribution, bare URLs, and other non-coaching lines from instruction steps. */
export function sanitizeExerciseInstructions(steps: string[]): string[] {
  return steps
    .map((step) =>
      String(step)
        .trim()
        .replace(/^step:\s*\d+\s*[:.\-]?\s*/i, "")
        .trim(),
    )
    .filter((step) => step.length >= 12 && !isInstructionNoise(step));
}

function parseInstructions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return sanitizeExerciseInstructions(
    raw.map((step) => String(step).trim()).filter((step) => step.length > 0),
  );
}

async function searchExerciseByName(
  exerciseName: string,
  apiKey: string,
): Promise<ExerciseDbRow | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const encoded = encodeURIComponent(exerciseName.trim().toLowerCase());
    const res = await fetch(`${BASE_URL}/exercises/name/${encoded}?limit=5`, {
      headers: rapidHeaders(apiKey),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ExerciseDbRow[];
    if (!Array.isArray(data) || data.length === 0) return null;
    return pickBestMatch(data, exerciseName);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadExerciseGif(
  exerciseId: string,
  apiKey: string,
): Promise<string | null> {
  const dest = `${FileSystem.cacheDirectory ?? ""}edb-gif-${exerciseId}-360.gif`;
  if (!FileSystem.cacheDirectory) return null;

  try {
    const result = await FileSystem.downloadAsync(
      `${BASE_URL}/image?exerciseId=${encodeURIComponent(exerciseId)}&resolution=360`,
      dest,
      { headers: rapidHeaders(apiKey) },
    );
    if (result.status >= 200 && result.status < 300) return result.uri;
  } catch {
    /* fall through */
  }
  return null;
}

async function resolveGifUrl(
  match: ExerciseDbRow,
  apiKey: string,
): Promise<string | null> {
  if (match.gifUrl?.startsWith("http")) return match.gifUrl;
  if (!match.id) return null;
  return downloadExerciseGif(match.id, apiKey);
}

async function lookupExerciseDetail(
  exerciseName: string,
): Promise<ExerciseDbDetail | null> {
  const apiKey = getExerciseDbApiKey();
  if (!apiKey) return null;

  try {
    const match = await searchExerciseByName(exerciseName, apiKey);
    if (!match) return null;

    const gifUrl = await resolveGifUrl(match, apiKey);
    const instructions = parseInstructions(match.instructions);

    return { gifUrl, instructions };
  } catch {
    return null;
  }
}

/**
 * Fetches GIF + step-by-step instructions from ExerciseDB (cached).
 */
export async function fetchExerciseDetail(
  exerciseName: string,
): Promise<ExerciseDbDetail | null> {
  const trimmed = exerciseName?.trim();
  if (!trimmed) return null;

  const cacheKey = normalizeName(trimmed);
  if (detailCache.has(cacheKey)) return detailCache.get(cacheKey) ?? null;

  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const task = (async (): Promise<ExerciseDbDetail | null> => {
    const detail = await lookupExerciseDetail(trimmed);
    detailCache.set(cacheKey, detail);
    return detail;
  })();

  inflight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inflight.delete(cacheKey);
  }
}

/** Animated demonstration GIF for modal playback. */
export async function fetchExerciseGif(exerciseName: string): Promise<string | null> {
  const detail = await fetchExerciseDetail(exerciseName);
  return detail?.gifUrl ?? null;
}

/** Official ExerciseDB coaching steps (empty when API unavailable). */
export async function fetchExerciseInstructions(
  exerciseName: string,
): Promise<string[]> {
  const detail = await fetchExerciseDetail(exerciseName);
  return detail?.instructions ?? [];
}

export { getExerciseDbApiKey, isExerciseDbConfigured } from "@/lib/rapidApiConfig";

/** Clears in-memory ExerciseDB cache. */
export function clearExerciseGifCache(): void {
  detailCache.clear();
  inflight.clear();
}
