import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "split_refresh_snooze_until_v1";
const SNOOZE_DAYS = 14;

export async function isSplitRefreshSnoozed(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return false;
  return new Date(raw) > new Date();
}

export async function snoozeSplitRefreshLocal(): Promise<void> {
  const until = new Date();
  until.setDate(until.getDate() + SNOOZE_DAYS);
  await AsyncStorage.setItem(KEY, until.toISOString());
}
