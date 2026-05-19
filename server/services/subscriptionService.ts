/**
 * Core subscription business logic.
 * Handles DB reads/writes for user subscription status and receipt records.
 *
 * When SUBSCRIPTIONS_ENABLED is falsy, the validation helpers in this file
 * will throw early — callers (routes) are responsible for checking that flag
 * before reaching here.
 */

import db from "../db";
import type { SubscriptionStatus, SubscriptionTier, SubscriptionProvider } from "../models";

// ── Read ─────────────────────────────────────────────────────────────────────

export function getSubscriptionStatus(userId: number): SubscriptionStatus {
  const user = db
    .prepare(
      "SELECT subscription_tier, subscription_provider, subscription_expires_at FROM users WHERE id = ?"
    )
    .get(userId) as
    | {
        subscription_tier: SubscriptionTier | null;
        subscription_provider: SubscriptionProvider | null;
        subscription_expires_at: string | null;
      }
    | undefined;

  if (!user) {
    return { tier: "free", isPro: false, provider: null, expiresAt: null };
  }

  const tier: SubscriptionTier = user.subscription_tier ?? "free";

  // If the stored expiry has passed, lazily demote the user to free
  if (tier === "pro" && user.subscription_expires_at) {
    if (new Date(user.subscription_expires_at) < new Date()) {
      markUserFree(userId);
      return { tier: "free", isPro: false, provider: null, expiresAt: null };
    }
  }

  return {
    tier,
    isPro: tier === "pro",
    provider: user.subscription_provider,
    expiresAt: user.subscription_expires_at,
  };
}

// ── Write ────────────────────────────────────────────────────────────────────

export function markUserPro(
  userId: number,
  provider: SubscriptionProvider,
  originalTransactionId: string,
  expiresAt: string | null,
  productId?: string,
  rawResponse?: string
): void {
  db.prepare(
    `UPDATE users
     SET subscription_tier = 'pro',
         subscription_provider = ?,
         subscription_expires_at = ?
     WHERE id = ?`
  ).run(provider, expiresAt, userId);

  // Upsert receipt record for audit trail
  db.prepare(
    `INSERT INTO subscription_receipts
       (user_id, provider, original_transaction_id, product_id, expires_at, status, raw_response)
     VALUES (?, ?, ?, ?, ?, 'active', ?)
     ON CONFLICT (user_id, provider, original_transaction_id)
     DO UPDATE SET
       expires_at  = excluded.expires_at,
       status      = 'active',
       raw_response = excluded.raw_response,
       updated_at  = datetime('now')`
  ).run(userId, provider, originalTransactionId, productId ?? null, expiresAt, rawResponse ?? null);
}

export function markUserFree(userId: number): void {
  db.prepare(
    `UPDATE users
     SET subscription_tier = 'free',
         subscription_provider = NULL,
         subscription_expires_at = NULL
     WHERE id = ?`
  ).run(userId);
}

export function setReceiptStatus(
  userId: number,
  provider: SubscriptionProvider,
  originalTransactionId: string,
  status: "expired" | "cancelled" | "refunded"
): void {
  markUserFree(userId);
  db.prepare(
    `UPDATE subscription_receipts
     SET status = ?, updated_at = datetime('now')
     WHERE user_id = ? AND provider = ? AND original_transaction_id = ?`
  ).run(status, userId, provider, originalTransactionId);
}

// ── Lookup helpers ───────────────────────────────────────────────────────────

/** Find the user_id associated with an Apple/Google original transaction ID. */
export function findUserByOriginalTransactionId(
  originalTransactionId: string,
  provider: SubscriptionProvider
): number | null {
  const row = db
    .prepare(
      `SELECT user_id FROM subscription_receipts
       WHERE original_transaction_id = ? AND provider = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(originalTransactionId, provider) as { user_id: number } | undefined;
  return row?.user_id ?? null;
}
