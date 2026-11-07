import AsyncStorage from "@react-native-async-storage/async-storage";

/** Plan-habit questions already answered (yes or no) — never asked twice. */
const ANSWERED_KEY = "@planDeviationAnswered";

export async function loadAnsweredDeviations(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(ANSWERED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function rememberAnsweredDeviation(key: string): Promise<void> {
  const answered = await loadAnsweredDeviations();
  answered.add(key);
  try {
    await AsyncStorage.setItem(ANSWERED_KEY, JSON.stringify([...answered]));
  } catch {
    // non-fatal: worst case the question comes back once
  }
}
