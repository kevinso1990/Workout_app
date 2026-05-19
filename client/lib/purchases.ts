/**
 * In-app purchase flow scaffolding for iOS (StoreKit) and Android (Google Play Billing).
 *
 * This module provides a unified interface that the app uses to trigger purchases.
 * The actual StoreKit / Play Billing SDK calls are marked with TODO comments.
 *
 * ── How to wire up real purchases ───────────────────────────────────────────
 *
 * 1. Install a React Native IAP library. Recommended options:
 *      - react-native-iap (most widely used)
 *          npm install react-native-iap
 *      - expo-iap (Expo-native, currently in beta)
 *          npx expo install expo-iap
 *
 * 2. Follow the library's setup guide for iOS (add StoreKit capability in Xcode)
 *    and Android (add Google Play Billing dependency in build.gradle).
 *
 * 3. Replace the TODO stubs below with the library's API calls.
 *
 * 4. Set EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true and EXPO_PUBLIC_APPLE_PRODUCT_ID
 *    / EXPO_PUBLIC_GOOGLE_PRODUCT_ID in your .env.local (or Expo secrets).
 *
 * 5. Build and run on a real device with a sandbox/test account.
 *    See SUBSCRIPTIONS.md → "Sandbox testing walkthrough" for step-by-step.
 */

import { Platform } from "react-native";
import { SUBSCRIPTIONS_ENABLED, APPLE_PRODUCT_ID, GOOGLE_PRODUCT_ID, GOOGLE_PACKAGE_NAME } from "./subscriptionConfig";
import { api } from "./api";

export interface PurchaseResult {
  success: boolean;
  error?: string;
}

/**
 * Initiates a subscription purchase for the Pro tier.
 *
 * On iOS: triggers the StoreKit payment sheet for APPLE_PRODUCT_ID.
 * On Android: triggers the Google Play Billing flow for GOOGLE_PRODUCT_ID.
 * On web: not supported (subscriptions are app-store only for digital content).
 *
 * Returns `{ success: true }` once the backend has validated the purchase
 * and marked the user as Pro.
 */
export async function purchasePro(): Promise<PurchaseResult> {
  if (!SUBSCRIPTIONS_ENABLED) {
    return { success: false, error: "Subscriptions are not enabled in this build." };
  }
  if (Platform.OS === "ios") {
    return purchaseProIos();
  } else if (Platform.OS === "android") {
    return purchaseProAndroid();
  } else {
    return { success: false, error: "In-app purchases are only available on iOS and Android." };
  }
}

// ── iOS / StoreKit ────────────────────────────────────────────────────────────

async function purchaseProIos(): Promise<PurchaseResult> {
  if (!APPLE_PRODUCT_ID) {
    return { success: false, error: "Apple product ID is not configured (EXPO_PUBLIC_APPLE_PRODUCT_ID)." };
  }

  try {
    // TODO: Replace the block below with your chosen IAP library.
    //
    // Example using react-native-iap:
    //
    //   import * as IAP from 'react-native-iap';
    //
    //   await IAP.initConnection();
    //   const purchase = await IAP.requestSubscription({ sku: APPLE_PRODUCT_ID });
    //
    //   // purchase.transactionReceipt is the base64 StoreKit receipt
    //   const receiptData = purchase.transactionReceipt;
    //   await api.validateAppleReceipt({ receiptData });
    //   await IAP.finishTransaction({ purchase, isConsumable: false });
    //   await IAP.endConnection();
    //   return { success: true };

    throw new Error("StoreKit purchase flow not yet implemented. See client/lib/purchases.ts.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ── Android / Google Play Billing ─────────────────────────────────────────────

async function purchaseProAndroid(): Promise<PurchaseResult> {
  if (!GOOGLE_PRODUCT_ID) {
    return { success: false, error: "Google product ID is not configured (EXPO_PUBLIC_GOOGLE_PRODUCT_ID)." };
  }
  if (!GOOGLE_PACKAGE_NAME) {
    return { success: false, error: "Google package name is not configured (EXPO_PUBLIC_GOOGLE_PACKAGE_NAME)." };
  }

  try {
    // TODO: Replace the block below with your chosen IAP library.
    //
    // Example using react-native-iap:
    //
    //   import * as IAP from 'react-native-iap';
    //
    //   await IAP.initConnection();
    //   const purchase = await IAP.requestSubscription({ sku: GOOGLE_PRODUCT_ID });
    //
    //   // purchase.purchaseToken is the token to send to the backend
    //   await api.validateGooglePurchase({
    //     packageName: GOOGLE_PACKAGE_NAME,
    //     subscriptionId: GOOGLE_PRODUCT_ID,
    //     purchaseToken: purchase.purchaseToken,
    //   });
    //   await IAP.finishTransaction({ purchase, isConsumable: false });
    //   await IAP.endConnection();
    //   return { success: true };

    throw new Error("Google Play Billing flow not yet implemented. See client/lib/purchases.ts.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Restores any existing subscription (e.g. after reinstall or new device).
 * On iOS: re-fetches the current App Store receipt and re-validates.
 * On Android: queries existing purchases from the Play Billing SDK.
 */
export async function restorePurchases(): Promise<PurchaseResult> {
  if (!SUBSCRIPTIONS_ENABLED) {
    return { success: false, error: "Subscriptions are not enabled in this build." };
  }
  try {
    // TODO: Implement restore flow with your chosen IAP library.
    //
    // iOS example (react-native-iap):
    //   await IAP.initConnection();
    //   const purchases = await IAP.getAvailablePurchases();
    //   const sub = purchases.find(p => p.productId === APPLE_PRODUCT_ID);
    //   if (sub?.transactionReceipt) {
    //     await api.validateAppleReceipt({ receiptData: sub.transactionReceipt });
    //     return { success: true };
    //   }
    //   return { success: false, error: 'No active subscription found.' };

    throw new Error("Restore purchases not yet implemented. See client/lib/purchases.ts.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
