/**
 * Google AdMob (P1) — feature flags only until react-native-google-mobile-ads is wired.
 * Subscriptions are deferred; ads offset Gemini / RapidAPI costs.
 */

function envBool(key: string): boolean {
  return typeof process !== "undefined" && process.env?.[key] === "true";
}

/** Master switch for any AdMob UI. Default off until unit IDs are configured. */
export const ADMOB_ENABLED = envBool("EXPO_PUBLIC_ADMOB_ENABLED");

/** Banner on active workout screen (bottom safe area). */
export const ADMOB_WORKOUT_BANNER_ENABLED = ADMOB_ENABLED;

/** Rewarded video: +1 Gemini PDF import after ~30s watch. */
export const ADMOB_REWARDED_IMPORT_ENABLED = ADMOB_ENABLED;

/** Placeholder unit IDs — replace before store release. */
export const ADMOB_BANNER_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID?.trim() ?? "";
export const ADMOB_REWARDED_IMPORT_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_IMPORT_UNIT_ID?.trim() ?? "";
