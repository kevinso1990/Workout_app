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

/** Called after a successful rewarded video (stub until AdMob SDK is integrated). */
export async function grantBonusImportCredit(): Promise<number> {
  await ensureLoaded();
  bonusCredits += 1;
  await AsyncStorage.setItem(STORAGE_KEY, String(bonusCredits));
  return bonusCredits;
}
