/**
 * Subscription feature flags, store product IDs, and RevenueCat configuration.
 *
 * Enable subscriptions by setting EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true and
 * configuring RevenueCat API keys for each platform.
 */

const viteEnv: Record<string, string | undefined> = {};

function envBool(viteKey: string, expoKey: string): boolean {
  const expoVal = typeof process !== "undefined" ? process.env?.[expoKey] : undefined;
  return viteEnv[viteKey] === "true" || expoVal === "true";
}

function envStr(viteKey: string, expoKey: string, fallback = ""): string {
  const expoVal = typeof process !== "undefined" ? process.env?.[expoKey] : undefined;
  return viteEnv[viteKey] || expoVal || fallback;
}

/** Master switch. False by default until store products and RevenueCat are configured. */
export const SUBSCRIPTIONS_ENABLED = envBool(
  "VITE_SUBSCRIPTIONS_ENABLED",
  "EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED",
);

/** RevenueCat entitlement identifier configured in the RC dashboard. */
export const REVENUECAT_ENTITLEMENT_ID = envStr(
  "VITE_REVENUECAT_ENTITLEMENT_ID",
  "EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID",
  "pro",
);

export const REVENUECAT_IOS_API_KEY = envStr(
  "VITE_REVENUECAT_IOS_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
);

export const REVENUECAT_ANDROID_API_KEY = envStr(
  "VITE_REVENUECAT_ANDROID_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
);

/**
 * Legacy store product IDs — kept for server receipt validation paths.
 * RevenueCat owns the live purchase flow on native.
 */
export const APPLE_PRODUCT_ID = envStr(
  "VITE_APPLE_PRODUCT_ID",
  "EXPO_PUBLIC_APPLE_PRODUCT_ID",
);

export const GOOGLE_PRODUCT_ID = envStr(
  "VITE_GOOGLE_PRODUCT_ID",
  "EXPO_PUBLIC_GOOGLE_PRODUCT_ID",
);

export const GOOGLE_PACKAGE_NAME = envStr(
  "VITE_GOOGLE_PACKAGE_NAME",
  "EXPO_PUBLIC_GOOGLE_PACKAGE_NAME",
);

/** Price shown in Pro UI copy. */
export const PRO_PRICE_DISPLAY = "€5 / month";
