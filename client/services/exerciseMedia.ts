import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { getApiUrl } from '@/lib/query-client';
import { getExerciseImageUrl } from '@/lib/exerciseImages';

const WGER_BASE = 'https://wger.de/api/v2';
const CACHE_PREFIX = 'exercise_media_v3_';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface ExerciseMedia {
  gifUrl: string | null;
  videoMp4: string | null;
  correctSteps: string[];
}

const sessionCache: Record<string, ExerciseMedia> = {};
const inFlight: Record<string, Promise<ExerciseMedia>> = {};
const prewarmAttempted = new Set<string>();

async function fetchFromServer(
  exerciseName: string,
  options?: { resolution?: number },
): Promise<ExerciseMedia> {
  try {
    const url = new URL(`/api/exercises/gif/${encodeURIComponent(exerciseName)}`, getApiUrl());
    if (options?.resolution) {
      url.searchParams.set("resolution", String(options.resolution));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { gifUrl: null, videoMp4: null, correctSteps: [] };
    const data = await res.json() as { gifUrl: string | null; videoMp4?: string | null; correctSteps?: string[] };
    return { gifUrl: data.gifUrl ?? null, videoMp4: data.videoMp4 ?? null, correctSteps: data.correctSteps ?? [] };
  } catch {
    return { gifUrl: null, videoMp4: null, correctSteps: [] };
  }
}

const thumbUrlCache = new Map<string, string | null>();

/** Lightweight list thumbnail (360px proxy); separate from full `getExerciseMedia` cache. */
export async function getExerciseGifThumbUrl(exerciseName: string): Promise<string | null> {
  const key = exerciseName.toLowerCase().trim();
  if (thumbUrlCache.has(key)) return thumbUrlCache.get(key)!;
  const media = await fetchFromServer(exerciseName, { resolution: 360 });
  const url = media.gifUrl ?? null;
  thumbUrlCache.set(key, url);
  return url;
}

async function fetchGifFromWger(exerciseName: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const searchRes = await fetch(
      `${WGER_BASE}/exercise/search/?term=${encodeURIComponent(exerciseName)}&language=english&format=json`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const suggestions = searchData.suggestions as { data: { id: number } }[];
    if (!suggestions?.length) return null;

    const exerciseId = suggestions[0].data.id;

    const imgController = new AbortController();
    const imgTimeout = setTimeout(() => imgController.abort(), 5000);
    const imgRes = await fetch(
      `${WGER_BASE}/exerciseimage/?exercise_base=${exerciseId}&format=json`,
      { signal: imgController.signal }
    );
    clearTimeout(imgTimeout);
    if (!imgRes.ok) return null;

    const imgData = await imgRes.json();
    const images = imgData.results as { image: string; is_main: boolean }[];
    if (!images?.length) return null;

    const main = images.find(i => i.is_main) || images[0];
    return main.image;
  } catch {
    return null;
  }
}

let gifNamesCache: Set<string> | null = null;
let gifNamesFetchPromise: Promise<Set<string>> | null = null;

/**
 * Returns a Set of exercise names (lowercase) for which the server has a
 * cached media URL. Fetched once per session and kept in memory.
 * An empty Set is returned if the server is unreachable or no media is cached.
 */
export async function getGifAvailableNames(): Promise<Set<string>> {
  if (gifNamesCache !== null) return gifNamesCache;
  if (gifNamesFetchPromise) return gifNamesFetchPromise;

  gifNamesFetchPromise = (async () => {
    try {
      const url = new URL('/api/exercises/gif-names', getApiUrl()).toString();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        gifNamesCache = new Set();
        return gifNamesCache;
      }
      const names = await res.json() as string[];
      gifNamesCache = new Set(names.map((n) => n.toLowerCase()));
    } catch {
      gifNamesCache = new Set();
    } finally {
      gifNamesFetchPromise = null;
    }
    return gifNamesCache as Set<string>;
  })();

  return gifNamesFetchPromise;
}

/**
 * Returns full media info (animated GIF URL + MP4 video URL) for an exercise.
 * Results are cached in memory and AsyncStorage for 7 days.
 */
export async function getExerciseMedia(exerciseName: string): Promise<ExerciseMedia> {
  const cacheKey = exerciseName.toLowerCase().trim();

  if (cacheKey in sessionCache) return sessionCache[cacheKey];
  if (cacheKey in inFlight) return inFlight[cacheKey];

  try {
    const stored = await AsyncStorage.getItem(CACHE_PREFIX + cacheKey);
    if (stored) {
      const { media, timestamp } = JSON.parse(stored);
      const correctSteps = Array.isArray(media.correctSteps) ? media.correctSteps : [];
      const hasRichData = correctSteps.length > 0 || !!(media.videoMp4);
      if (Date.now() - timestamp < CACHE_DURATION_MS && hasRichData) {
        const normalized: ExerciseMedia = {
          gifUrl: media.gifUrl ?? null,
          videoMp4: media.videoMp4 ?? null,
          correctSteps,
        };
        sessionCache[cacheKey] = normalized;
        return normalized;
      }
    }
  } catch { /* ignore storage errors */ }

  const fetchPromise = (async () => {
    try {
      const media = await fetchFromServer(exerciseName);

      // If server returned nothing, try wger.de as a last resort (static image only).
      if (!media.gifUrl && !media.videoMp4) {
        const wgerUrl = await fetchGifFromWger(exerciseName);
        if (wgerUrl) {
          media.gifUrl = wgerUrl;
        }
      }

      // Cache only results with rich MuscleWiki data (form tips or MP4 video).
      // Static image-only responses (exercises table / wger.de fallback) are not
      // cached so the next modal open re-fetches and picks up form tips once the
      // server's background MuscleWiki fetch has completed.
      const hasRichData = media.correctSteps.length > 0 || !!(media.videoMp4);
      if (hasRichData) {
        sessionCache[cacheKey] = media;
        AsyncStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify({ media, timestamp: Date.now() }))
          .catch(() => {});
      }
      return media;
    } catch {
      return { gifUrl: null, videoMp4: null, correctSteps: [] };
    } finally {
      delete inFlight[cacheKey];
    }
  })();

  inFlight[cacheKey] = fetchPromise;
  return fetchPromise;
}

/**
 * Clears both in-memory session cache and AsyncStorage cache for an exercise
 * so the next call to getExerciseMedia will re-fetch from the server. Also
 * removes any in-flight request to force a fresh fetch. Used when polling for
 * a newly-created custom exercise whose image may now be ready.
 */
export async function clearExerciseMediaCache(exerciseName: string): Promise<void> {
  const cacheKey = exerciseName.toLowerCase().trim();
  delete sessionCache[cacheKey];
  delete inFlight[cacheKey];
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + cacheKey);
  } catch { /* ignore storage errors */ }
}

/**
 * Backward-compatible helper that returns just the GIF/image URL.
 * Only returns image-compatible URLs (animated GIF or static JPEG) — never an MP4.
 * Prefer `getExerciseMedia` for new code to also get the MP4 video URL.
 */
export async function getExerciseGif(exerciseName: string): Promise<string | null> {
  const media = await getExerciseMedia(exerciseName);
  return media.gifUrl || null;
}

const PREWARM_BATCH_SIZE = 4;
const PREWARM_BATCH_DELAY_MS = 150;
const PREWARM_RECHECK_DELAY_MS = 5000;

/**
 * Silently pre-fetches exercise media in the background for a list of exercise names
 * so the data is already cached when the user opens the modal.
 *
 * First pass: fires immediately for exercises not yet attempted this session.
 * Second pass: schedules a re-fetch after PREWARM_RECHECK_DELAY_MS for exercises
 *   whose first response lacked rich data (no form tips or MP4), giving the server's
 *   background MuscleWiki fetch time to complete.
 * Completely non-blocking: caller does not need to await.
 */
export function prewarmExerciseMedia(exerciseNames: string[]): void {
  const needsFetch = exerciseNames.filter((name) => {
    const key = name.toLowerCase().trim();
    return !(key in sessionCache) && !(key in inFlight) && !prewarmAttempted.has(key);
  });

  if (needsFetch.length === 0) return;

  const fireBatch = (startIndex: number) => {
    const batch = needsFetch.slice(startIndex, startIndex + PREWARM_BATCH_SIZE);
    if (batch.length === 0) return;

    batch.forEach((name) => {
      const key = name.toLowerCase().trim();
      prewarmAttempted.add(key);
      getExerciseMedia(name)
        .then(() => {
          if (!(key in sessionCache)) {
            setTimeout(() => {
              if (!(key in sessionCache)) {
                prewarmAttempted.delete(key);
                getExerciseMedia(name).catch(() => {});
              }
            }, PREWARM_RECHECK_DELAY_MS);
          }
        })
        .catch(() => {});
    });

    if (startIndex + PREWARM_BATCH_SIZE < needsFetch.length) {
      setTimeout(() => fireBatch(startIndex + PREWARM_BATCH_SIZE), PREWARM_BATCH_DELAY_MS);
    }
  };

  fireBatch(0);
}

const ASSET_PREFETCH_BATCH_SIZE = 3;
const ASSET_PREFETCH_BATCH_GAP_MS = 80;

function isPrefetchableRasterUrl(url: string | null | undefined): url is string {
  if (!url?.trim()) return false;
  const lower = url.toLowerCase();
  if (lower.includes(".mp4") || lower.endsWith("/mp4")) return false;
  return true;
}

async function prefetchRasterUrl(url: string): Promise<void> {
  try {
    await Image.prefetch(url, { cachePolicy: "memory-disk" });
  } catch {
    /* non-fatal — modal still loads from network */
  }
}

/**
 * Resolves exercise media metadata, then warms expo-image memory-disk cache for
 * GIF/static URLs. Pair with `prewarmExerciseMedia` at workout start.
 */
export async function prefetchExerciseMediaAssets(
  exerciseName: string,
): Promise<void> {
  const media = await getExerciseMedia(exerciseName);
  const urls = new Set<string>();
  if (isPrefetchableRasterUrl(media.gifUrl)) urls.add(media.gifUrl);
  const staticUrl = getExerciseImageUrl(exerciseName);
  if (staticUrl) urls.add(staticUrl);
  await Promise.all([...urls].map(prefetchRasterUrl));
}

/**
 * Workout-start pipeline: metadata prewarm + binary prefetch for every unique
 * exercise in the active plan. Non-blocking for callers.
 */
export function prefetchWorkoutExerciseMedia(exerciseNames: string[]): void {
  const unique = [
    ...new Set(exerciseNames.map((n) => n.trim()).filter(Boolean)),
  ];
  if (unique.length === 0) return;

  prewarmExerciseMedia(unique);

  void (async () => {
    for (let i = 0; i < unique.length; i += ASSET_PREFETCH_BATCH_SIZE) {
      const batch = unique.slice(i, i + ASSET_PREFETCH_BATCH_SIZE);
      await Promise.all(
        batch.map((name) =>
          prefetchExerciseMediaAssets(name).catch(() => {}),
        ),
      );
      if (i + ASSET_PREFETCH_BATCH_SIZE < unique.length) {
        await new Promise((r) => setTimeout(r, ASSET_PREFETCH_BATCH_GAP_MS));
      }
    }
  })();
}
