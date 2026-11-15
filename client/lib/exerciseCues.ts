import AsyncStorage from "@react-native-async-storage/async-storage";

import { getApiUrl } from "@/lib/query-client";

/**
 * Cues for exercises the bundled data doesn't know — names from imported or
 * AI-built plans. The server writes them once (AI) and serves them to every
 * user after that; here they are kept per device so a known exercise never
 * waits on the network twice.
 */

const STORE_KEY = "exerciseCues.v1";

let memory: Record<string, string[]> | null = null;

async function load(): Promise<Record<string, string[]>> {
  if (memory) return memory;
  try {
    memory = JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? "{}");
  } catch {
    memory = {};
  }
  return memory!;
}

export async function fetchExerciseCues(
  name: string,
  muscleGroup: string,
  language: string,
): Promise<string[]> {
  const lang = language.startsWith("de") ? "de" : "en";
  const key = `${lang}|${name.trim().toLowerCase()}`;
  const store = await load();
  if (store[key]) return store[key];
  try {
    const res = await fetch(new URL("/api/exercise-cues", getApiUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, muscleGroup, language: lang }),
    });
    // A failed request isn't an answer — only a reply is remembered.
    if (!res.ok) return [];
    const { cues } = (await res.json()) as { cues?: unknown };
    const list = Array.isArray(cues) ? cues.filter((c): c is string => typeof c === "string") : [];
    store[key] = list;
    void AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
    return list;
  } catch {
    return [];
  }
}
