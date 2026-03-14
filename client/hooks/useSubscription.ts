/**
 * useSubscription — single source of truth for Pro status in the frontend.
 *
 * Usage:
 *   const { isPro, isEnabled, isLoading } = useSubscription();
 *
 * When SUBSCRIPTIONS_ENABLED is false (the default):
 *   - isEnabled = false
 *   - isPro     = false   (everyone gets free-tier behaviour)
 *   - No API call is made
 *
 * When SUBSCRIPTIONS_ENABLED is true and the user is authenticated:
 *   - Fetches /api/subscriptions/status and returns the result.
 *   - isPro = true only if the user has an active, non-expired Pro subscription.
 */

import { useState, useEffect } from "react";
import { SUBSCRIPTIONS_ENABLED } from "../lib/subscriptionConfig";
import { api } from "../lib/api";

export interface SubscriptionState {
  /** True only when the user has an active Pro subscription. */
  isPro: boolean;
  /** False when SUBSCRIPTIONS_ENABLED=false — use to hide all paywall UI. */
  isEnabled: boolean;
  isLoading: boolean;
  tier: "free" | "pro";
  provider: "apple" | "google" | null;
  expiresAt: string | null;
  /** Call after a successful in-app purchase to refresh the status. */
  refresh: () => void;
}

export function useSubscription(authToken?: string): SubscriptionState {
  const [state, setState] = useState<Omit<SubscriptionState, "isEnabled" | "refresh">>({
    isPro: false,
    isLoading: SUBSCRIPTIONS_ENABLED && !!authToken,
    tier: "free",
    provider: null,
    expiresAt: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // If subscriptions are disabled globally, never block users
    if (!SUBSCRIPTIONS_ENABLED || !authToken) {
      setState({ isPro: false, isLoading: false, tier: "free", provider: null, expiresAt: null });
      return;
    }

    let cancelled = false;
    setState(s => ({ ...s, isLoading: true }));

    api
      .getSubscriptionStatus()
      .then(status => {
        if (!cancelled) {
          setState({
            isPro: status.isPro,
            isLoading: false,
            tier: status.tier,
            provider: status.provider as "apple" | "google" | null,
            expiresAt: status.expiresAt,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          // On error, default to free — never accidentally gate content
          setState({ isPro: false, isLoading: false, tier: "free", provider: null, expiresAt: null });
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, tick]);

  return {
    ...state,
    isEnabled: SUBSCRIPTIONS_ENABLED,
    refresh: () => setTick(t => t + 1),
  };
}
