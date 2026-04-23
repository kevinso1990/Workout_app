import AsyncStorage from '@react-native-async-storage/async-storage';

const WGER_BASE = 'https://wger.de/api/v2';
const BACKEND_URL = 'https://workout-builder.replit.app/api/translate-exercise';
const CACHE_PREFIX = 'exercise_gif_v1_';
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const sessionCache: Record<string, string | null> = {};
const inFlight: Record<string, Promise<string | null>> = {};

async function translateToEnglish(name: string): Promise<string> {
  const hasGermanChars = /[äöüÄÖÜß]/.test(name);
  const commonEnglish = ['bench', 'squat', 'deadlift', 'press', 'curl', 'row', 'pull', 'push', 'fly', 'raise', 'extension', 'plank'];
  const isLikelyEnglish = commonEnglish.some(w => name.toLowerCase().includes(w));
  if (!hasGermanChars && isLikelyEnglish) return name;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return name;
    const data = await res.json();
    return data.english || name;
  } catch {
    return name;
  }
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

export async function getExerciseGif(exerciseName: string): Promise<string | null> {
  const cacheKey = exerciseName.toLowerCase().trim();

  if (cacheKey in sessionCache) return sessionCache[cacheKey];
  if (cacheKey in inFlight) return inFlight[cacheKey];

  try {
    const stored = await AsyncStorage.getItem(CACHE_PREFIX + cacheKey);
    if (stored) {
      const { url, timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp < CACHE_DURATION_MS) {
        sessionCache[cacheKey] = url;
        return url;
      }
    }
  } catch { /* ignore storage errors */ }

  const fetchPromise = (async () => {
    try {
      const englishName = await translateToEnglish(cacheKey);
      const url = await fetchGifFromWger(englishName);
      sessionCache[cacheKey] = url;
      AsyncStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify({ url, timestamp: Date.now() }))
        .catch(() => {});
      return url;
    } catch {
      sessionCache[cacheKey] = null;
      return null;
    } finally {
      delete inFlight[cacheKey];
    }
  })();

  inFlight[cacheKey] = fetchPromise;
  return fetchPromise;
}
