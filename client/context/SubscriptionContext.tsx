import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";

import {
  REVENUECAT_ANDROID_API_KEY,
  REVENUECAT_ENTITLEMENT_ID,
  REVENUECAT_IOS_API_KEY,
  SUBSCRIPTIONS_ENABLED,
} from "@/lib/subscriptionConfig";
import { decodeJwtSub, ensureAuthToken, getStoredToken } from "@/lib/nativeAuth";
import {
  mapPurchaseError,
  purchaseProPackage,
  restorePurchases as restorePurchasesFlow,
  syncRevenueCatUserId,
} from "@/lib/purchases";
import type { PurchaseResult } from "@/lib/purchases";

export type SubscriptionContextValue = {
  isPro: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  tier: "free" | "pro";
  packages: PurchasesPackage[];
  packagesLoading: boolean;
  purchasePro: () => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

let purchasesConfigured = false;

function readEntitlement(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return (
    info.entitlements.active[REVENUECAT_ENTITLEMENT_ID]?.isActive === true
  );
}

async function configurePurchasesIfNeeded(): Promise<void> {
  if (!SUBSCRIPTIONS_ENABLED || purchasesConfigured) return;
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;

  const apiKey =
    Platform.OS === "ios" ? REVENUECAT_IOS_API_KEY : REVENUECAT_ANDROID_API_KEY;
  if (!apiKey) {
    console.warn("[subscriptions] RevenueCat API key missing for", Platform.OS);
    return;
  }

  Purchases.configure({ apiKey });
  purchasesConfigured = true;
  await syncRevenueCatUserId();
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(SUBSCRIPTIONS_ENABLED);
  const [isPro, setIsPro] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  const applyCustomerInfo = useCallback((info: CustomerInfo | null) => {
    setIsPro(readEntitlement(info));
  }, []);

  const refresh = useCallback(async () => {
    if (!SUBSCRIPTIONS_ENABLED) {
      setIsPro(false);
      setIsLoading(false);
      return;
    }
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      setIsPro(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      await configurePurchasesIfNeeded();
      await ensureAuthToken();
      const token = await getStoredToken();
      const userId = token ? decodeJwtSub(token) : null;
      if (userId != null) {
        await Purchases.logIn(String(userId));
      }
      const info = await Purchases.getCustomerInfo();
      applyCustomerInfo(info);
    } catch {
      setIsPro(false);
    } finally {
      setIsLoading(false);
    }
  }, [applyCustomerInfo]);

  const loadPackages = useCallback(async () => {
    if (!SUBSCRIPTIONS_ENABLED) return;
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    setPackagesLoading(true);
    try {
      await configurePurchasesIfNeeded();
      const offerings = await Purchases.getOfferings();
      const current = offerings.current?.availablePackages ?? [];
      setPackages(current);
    } catch {
      setPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadPackages();

    if (!SUBSCRIPTIONS_ENABLED) return undefined;

    const listener = (info: CustomerInfo) => {
      applyCustomerInfo(info);
    };
    if (Platform.OS === "ios" || Platform.OS === "android") {
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(listener);
      };
    }
    return undefined;
  }, [applyCustomerInfo, loadPackages, refresh]);

  const purchasePro = useCallback(async (): Promise<PurchaseResult> => {
    if (!SUBSCRIPTIONS_ENABLED) {
      return { success: false, error: "Subscriptions are not enabled in this build." };
    }
    try {
      await configurePurchasesIfNeeded();
      const result = await purchaseProPackage(packages);
      if (result.customerInfo) {
        applyCustomerInfo(result.customerInfo);
      }
      return result;
    } catch (err) {
      return mapPurchaseError(err);
    }
  }, [applyCustomerInfo, packages]);

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    if (!SUBSCRIPTIONS_ENABLED) {
      return { success: false, error: "Subscriptions are not enabled in this build." };
    }
    try {
      await configurePurchasesIfNeeded();
      const result = await restorePurchasesFlow();
      if (result.customerInfo) {
        applyCustomerInfo(result.customerInfo);
      }
      return result;
    } catch (err) {
      return mapPurchaseError(err);
    }
  }, [applyCustomerInfo]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isPro,
      isEnabled: SUBSCRIPTIONS_ENABLED,
      isLoading,
      tier: isPro ? "pro" : "free",
      packages,
      packagesLoading,
      purchasePro,
      restorePurchases,
      refresh,
    }),
    [
      isPro,
      isLoading,
      packages,
      packagesLoading,
      purchasePro,
      restorePurchases,
      refresh,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    return {
      isPro: false,
      isEnabled: SUBSCRIPTIONS_ENABLED,
      isLoading: false,
      tier: "free",
      packages: [],
      packagesLoading: false,
      purchasePro: async () => ({
        success: false,
        error: "Subscription provider not mounted",
      }),
      restorePurchases: async () => ({
        success: false,
        error: "Subscription provider not mounted",
      }),
      refresh: async () => {},
    };
  }
  return ctx;
}
