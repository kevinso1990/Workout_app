/**
 * Subscription feature flags and product IDs.
 *
 * All values are read from environment variables at build time so you can
 * enable sandbox testing in a dev build without touching production.
 *
 * Vite (web):   prefix with VITE_
 * Expo (native): prefix with EXPO_PUBLIC_
 *
 * ── Environment variables ────────────────────────────────────────────────────
 *
 * VITE_SUBSCRIPTIONS_ENABLED / EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED
 *   Set to "true" to show purchase UI and enable IAP flows.
 *   Default: false → app behaves as 100% free, no paywall shown.
 *
 * VITE_APPLE_PRODUCT_ID / EXPO_PUBLIC_APPLE_PRODUCT_ID
 *   Your Apple subscription product ID, e.g. "com.yourapp.pro_monthly".
 *   Obtain from App Store Connect → Your App → Subscriptions.
 *
 * VITE_GOOGLE_PRODUCT_ID / EXPO_PUBLIC_GOOGLE_PRODUCT_ID
 *   Your Google Play subscription product ID, e.g. "pro_monthly".
 *   Obtain from Google Play Console → Monetize → Subscriptions.
 *
 * VITE_GOOGLE_PACKAGE_NAME / EXPO_PUBLIC_GOOGLE_PACKAGE_NAME
 *   Your Android app package name, e.g. "com.yourapp.fitplan".
 */

// Vite exposes env at import.meta.env; Expo exposes it at process.env.
// We read both so the same file works in both build systems.
const viteEnv: Record<string, string | undefined> =
  (typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {}) || {};

function envBool(viteKey: string, expoKey: string): boolean {
  const expoVal = typeof process !== "undefined" ? process.env?.[expoKey] : undefined;
  return viteEnv[viteKey] === "true" || expoVal === "true";
}

function envStr(viteKey: string, expoKey: string): string {
  const expoVal = typeof process !== "undefined" ? process.env?.[expoKey] : undefined;
  return viteEnv[viteKey] || expoVal || "";
}

/** Master switch. False by default — set env var to "true" to enable. */
export const SUBSCRIPTIONS_ENABLED = envBool(
  "VITE_SUBSCRIPTIONS_ENABLED",
  "EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED"
);

/**
 * Apple App Store subscription product ID.
 * Plug in the value from App Store Connect when you're ready to test.
 */
export const APPLE_PRODUCT_ID = envStr(
  "VITE_APPLE_PRODUCT_ID",
  "EXPO_PUBLIC_APPLE_PRODUCT_ID"
);

/**
 * Google Play subscription product ID.
 * Plug in the value from Google Play Console when you're ready to test.
 */
export const GOOGLE_PRODUCT_ID = envStr(
  "VITE_GOOGLE_PRODUCT_ID",
  "EXPO_PUBLIC_GOOGLE_PRODUCT_ID"
);

/** Android app package name — required for Google Play validation. */
export const GOOGLE_PACKAGE_NAME = envStr(
  "VITE_GOOGLE_PACKAGE_NAME",
  "EXPO_PUBLIC_GOOGLE_PACKAGE_NAME"
);

/** Price shown in Pro UI copy. Change when you have a real price confirmed. */
export const PRO_PRICE_DISPLAY = "€5 / month";
