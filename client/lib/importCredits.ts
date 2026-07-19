import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "import_credits_bonus";
const DEFAULT_FREE_IMPORTS = 5;

/** Free Gemini PDF imports per install before rewarded ad grants more. */
export const FREE_GEMINI_IMPORTS = DEFAULT_FREE_IMPORTS;

let bonusCredits = 0;
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    bonusCredits = raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    bonusCredits = 0;
  }
  loaded = true;
}

export async function getBonusImportCredits(): Promise<number> {
  await ensureLoaded();
  return bonusCredits;
}

/** Pro subscribers bypass import limits. */
export function hasUnlimitedImports(isPro: boolean): boolean {
  return isPro;
}

export async function canPerformGeminiImport(
  isPro: boolean,
  usedCount: number,
): Promise<boolean> {
  if (hasUnlimitedImports(isPro)) return true;
  const bonus = await getBonusImportCredits();
  return usedCount < FREE_GEMINI_IMPORTS + bonus;
}

