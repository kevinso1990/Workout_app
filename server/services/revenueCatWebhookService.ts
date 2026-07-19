import type { SubscriptionProvider as SubscriptionProviderType } from "../models";

type RevenueCatStore = "APP_STORE" | "PLAY_STORE" | "STRIPE" | string;

export interface RevenueCatWebhookEvent {
  type: string;
  app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  transaction_id?: string;
  original_transaction_id?: string;
  store?: RevenueCatStore;
}

export interface RevenueCatWebhookBody {
  api_version?: string;
  event?: RevenueCatWebhookEvent;
}

function storeToProvider(
  store: RevenueCatStore | undefined,
): SubscriptionProviderType | null {
  if (store === "APP_STORE") return "apple";
  if (store === "PLAY_STORE") return "google";
  return null;
}

function parseUserId(appUserId: string | undefined): number | null {
  if (!appUserId?.trim()) return null;
  const id = parseInt(appUserId, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Applies a normalized RevenueCat webhook event to the users table.
 * Returns false when the event could not be mapped to a user.
 */
export function applyRevenueCatWebhookEvent(
  event: RevenueCatWebhookEvent,
  markPro: (
    userId: number,
    provider: SubscriptionProviderType,
    originalTransactionId: string,
    expiresAt: string | null,
    productId?: string,
    rawResponse?: string,
  ) => void,
  markFree: (userId: number) => void,
): boolean {
  const userId = parseUserId(event.app_user_id);
  if (!userId) return false;

  const provider = storeToProvider(event.store) ?? "apple";
  const txnId =
    event.original_transaction_id ??
    event.transaction_id ??
    `rc-${event.type}-${userId}`;
  const expiresAt =
    event.expiration_at_ms != null
      ? new Date(event.expiration_at_ms).toISOString()
      : null;
  const raw = JSON.stringify(event);

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "SUBSCRIPTION_EXTENDED":
      markPro(userId, provider, txnId, expiresAt, event.product_id, raw);
      return true;

    case "CANCELLATION":
    case "EXPIRATION":
      markFree(userId);
      return true;

    case "BILLING_ISSUE":
      // Keep Pro during grace; webhook may be followed by EXPIRATION.
      return true;

    default:
      return false;
  }
}
