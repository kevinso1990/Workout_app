/**
 * RevenueCat-backed in-app purchase flow for iOS and Android.
 *
 * Configure keys via EXPO_PUBLIC_REVENUECAT_IOS_API_KEY /
 * EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY. Entitlement id defaults to "pro".
 */

import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  PURCHASES_ERROR_CODE,
} from "react-native-purchases";

import {
  REVENUECAT_ENTITLEMENT_ID,
  SUBSCRIPTIONS_ENABLED,
} from "./subscriptionConfig";
import { decodeJwtSub, ensureAuthToken, getStoredToken } from "./nativeAuth";

export type PurchaseErrorCode =
  | "cancelled"
  | "payment_failed"
  | "network"
  | "already_subscribed"
  | "not_configured"
  | "unknown";

export interface PurchaseResult {
  success: boolean;
  error?: string;
  errorCode?: PurchaseErrorCode;
  customerInfo?: CustomerInfo;
}

function hasActiveEntitlement(info: CustomerInfo): boolean {
  return info.entitlements.active[REVENUECAT_ENTITLEMENT_ID]?.isActive === true;
}

export function mapPurchaseError(err: unknown): PurchaseResult {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string; message?: string }).code;
    const message =
      (err as { message?: string }).message ?? "Purchase failed";

    switch (code) {
      case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
        return {
          success: false,
          error: "Purchase cancelled.",
          errorCode: "cancelled",
        };
      case PURCHASES_ERROR_CODE.NETWORK_ERROR:
        return {
          success: false,
          error: "Network error — check your connection and try again.",
          errorCode: "network",
        };
      case PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
        return {
          success: false,
          error: "You already have an active subscription.",
          errorCode: "already_subscribed",
        };
      case PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR:
      case PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR:
      case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
      case PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR:
        return {
          success: false,
          error: message,
          errorCode: "payment_failed",
        };
      default:
        return { success: false, error: message, errorCode: "unknown" };
    }
  }

  const message = err instanceof Error ? err.message : String(err);
  return { success: false, error: message, errorCode: "unknown" };
}

/** Links the RevenueCat customer to the authenticated server user id. */
export async function syncRevenueCatUserId(): Promise<void> {
  if (!SUBSCRIPTIONS_ENABLED) return;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  await ensureAuthToken();
  const token = await getStoredToken();
  const userId = token ? decodeJwtSub(token) : null;
  if (userId != null) {
    await Purchases.logIn(String(userId));
  }
}

function pickPackage(packages: PurchasesPackage[]): PurchasesPackage | null {
  if (packages.length === 0) return null;
  const monthly = packages.find((p) => p.packageType === "MONTHLY");
  return monthly ?? packages[0];
}

export async function purchaseProPackage(
  packages: PurchasesPackage[],
): Promise<PurchaseResult> {
  if (!SUBSCRIPTIONS_ENABLED) {
    return {
      success: false,
      error: "Subscriptions are not enabled in this build.",
      errorCode: "not_configured",
    };
  }
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return {
      success: false,
      error: "In-app purchases are only available on iOS and Android.",
      errorCode: "not_configured",
    };
  }

  const existing = await Purchases.getCustomerInfo();
  if (hasActiveEntitlement(existing)) {
    return {
      success: true,
      customerInfo: existing,
      errorCode: "already_subscribed",
    };
  }

  let pkg = pickPackage(packages);
  if (!pkg) {
    const offerings = await Purchases.getOfferings();
    pkg = pickPackage(offerings.current?.availablePackages ?? []);
  }
  if (!pkg) {
    return {
      success: false,
      error: "No subscription package is available right now.",
      errorCode: "not_configured",
    };
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (!hasActiveEntitlement(customerInfo)) {
      return {
        success: false,
        error: "Purchase completed but Pro entitlement is not active yet.",
        errorCode: "unknown",
        customerInfo,
      };
    }
    return { success: true, customerInfo };
  } catch (err) {
    return mapPurchaseError(err);
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!SUBSCRIPTIONS_ENABLED) {
    return {
      success: false,
      error: "Subscriptions are not enabled in this build.",
      errorCode: "not_configured",
    };
  }
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return {
      success: false,
      error: "Restore is only available on iOS and Android.",
      errorCode: "not_configured",
    };
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    if (!hasActiveEntitlement(customerInfo)) {
      return {
        success: false,
        error: "No active subscription found for this account.",
        errorCode: "unknown",
        customerInfo,
      };
    }
    return { success: true, customerInfo };
  } catch (err) {
    return mapPurchaseError(err);
  }
}

/** @deprecated Use SubscriptionContext.purchasePro instead. */
export async function purchasePro(): Promise<PurchaseResult> {
  return purchaseProPackage([]);
}
