import { describe, it, expect } from "vitest";

import { applyRevenueCatWebhookEvent } from "../services/revenueCatWebhookService";

describe("applyRevenueCatWebhookEvent", () => {
  it("marks user pro on INITIAL_PURCHASE", () => {
    const calls: unknown[] = [];
    const ok = applyRevenueCatWebhookEvent(
      {
        type: "INITIAL_PURCHASE",
        app_user_id: "42",
        store: "APP_STORE",
        product_id: "pro_monthly",
        original_transaction_id: "txn-1",
        expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
      },
      (userId, provider, txn, expiresAt, productId) => {
        calls.push({ userId, provider, txn, expiresAt, productId });
      },
      () => {},
    );
    expect(ok).toBe(true);
    expect(calls[0]).toMatchObject({
      userId: 42,
      provider: "apple",
      txn: "txn-1",
      productId: "pro_monthly",
    });
  });

  it("marks user free on EXPIRATION", () => {
    let freed = false;
    const ok = applyRevenueCatWebhookEvent(
      {
        type: "EXPIRATION",
        app_user_id: "7",
      },
      () => {},
      () => {
        freed = true;
      },
    );
    expect(ok).toBe(true);
    expect(freed).toBe(true);
  });

  it("ignores events without a numeric app_user_id", () => {
    const ok = applyRevenueCatWebhookEvent(
      { type: "RENEWAL", app_user_id: "guest-abc" },
      () => {
        throw new Error("should not mark pro");
      },
      () => {
        throw new Error("should not mark free");
      },
    );
    expect(ok).toBe(false);
  });
});
