import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "plan_generation_fallback_v1";

export async function setPlanGenerationFallbackNotice(message: string): Promise<void> {
  await AsyncStorage.setItem(KEY, message);
}

export async function peekPlanGenerationFallbackNotice(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw?.trim() || null;
}

export async function dismissPlanGenerationFallbackNotice(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
