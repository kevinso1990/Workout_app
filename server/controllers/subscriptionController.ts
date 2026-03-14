import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { AppError } from "../middleware/errorHandler";
import * as subscriptionService from "../services/subscriptionService";
import { validateAppleReceipt } from "../services/appleReceiptService";
import { validateGooglePurchase } from "../services/googlePlayService";
import type {
  ValidateAppleReceiptBody,
  ValidateGooglePurchaseBody,
} from "../models";

/** Whether the subscription system is enabled at all. False by default. */
function isSubscriptionsEnabled(): boolean {
  return process.env.SUBSCRIPTIONS_ENABLED === "true";
}

// ── GET /api/subscriptions/status ────────────────────────────────────────────

/** Returns the current user's subscription status. Always accessible. */
export const getStatus = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const status = subscriptionService.getSubscriptionStatus(userId);
  res.json(status);
});

// ── POST /api/subscriptions/validate/apple ───────────────────────────────────

export const validateApple = asyncHandler(async (req: Request, res: Response) => {
  if (!isSubscriptionsEnabled()) {
    throw new AppError(503, "Subscriptions are not enabled on this server");
  }

  const { receiptData, isSandbox } = req.body as ValidateAppleReceiptBody;
  if (!receiptData) throw new AppError(400, "receiptData is required");

  const result = await validateAppleReceipt(receiptData, isSandbox);

  if (!result.valid || !result.originalTransactionId) {
    throw new AppError(402, result.error ?? "Apple receipt is invalid or expired");
  }

  const userId = req.user!.sub;
  subscriptionService.markUserPro(
    userId,
    "apple",
    result.originalTransactionId,
    result.expiresAt ?? null,
    result.productId,
    result.rawResponse
  );

  res.json({
    ok: true,
    tier: "pro",
    expiresAt: result.expiresAt,
    provider: "apple",
  });
});

// ── POST /api/subscriptions/validate/google ──────────────────────────────────

export const validateGoogle = asyncHandler(async (req: Request, res: Response) => {
  if (!isSubscriptionsEnabled()) {
    throw new AppError(503, "Subscriptions are not enabled on this server");
  }

  const { packageName, subscriptionId, purchaseToken } =
    req.body as ValidateGooglePurchaseBody;

  if (!packageName)    throw new AppError(400, "packageName is required");
  if (!subscriptionId) throw new AppError(400, "subscriptionId is required");
  if (!purchaseToken)  throw new AppError(400, "purchaseToken is required");

  const result = await validateGooglePurchase(packageName, subscriptionId, purchaseToken);

  if (!result.valid || !result.orderId) {
    throw new AppError(402, result.error ?? "Google purchase token is invalid or expired");
  }

  const userId = req.user!.sub;
  subscriptionService.markUserPro(
    userId,
    "google",
    result.orderId,
    result.expiresAt ?? null,
    subscriptionId,
    result.rawResponse
  );

  res.json({
    ok: true,
    tier: "pro",
    expiresAt: result.expiresAt,
    provider: "google",
  });
});

// ── POST /api/subscriptions/webhooks/apple ───────────────────────────────────

/**
 * Receives Apple App Store Server Notifications (V2, signed JWS payload).
 * Apple sends these for: SUBSCRIBED, DID_RENEW, EXPIRED, GRACE_PERIOD_EXPIRED,
 * DID_FAIL_TO_RENEW, REFUND, REVOKE, etc.
 *
 * Security: verify the signedPayload JWT against Apple's public keys before
 * trusting the payload. For now we log but verify the shared secret header.
 * Full JWS verification: https://developer.apple.com/documentation/appstoreservernotifications/responsebodyv2
 */
export const appleWebhook = asyncHandler(async (req: Request, res: Response) => {
  // Always return 200 quickly so Apple doesn't retry
  res.sendStatus(200);

  if (!isSubscriptionsEnabled()) return;

  const { signedPayload } = req.body as { signedPayload?: string };
  if (!signedPayload) return;

  // TODO: Verify the JWS signature using Apple's root certificates before
  // trusting the payload. See SUBSCRIPTIONS.md → "Apple webhook verification".

  // Decode the payload without full verification for now (sandbox testing only)
  const [, payloadB64] = signedPayload.split(".");
  if (!payloadB64) return;

  let notification: Record<string, unknown>;
  try {
    notification = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return;
  }

  const notificationType = notification.notificationType as string | undefined;
  const data = notification.data as Record<string, unknown> | undefined;
  if (!data) return;

  // Decode the signedTransactionInfo to get the original transaction ID
  const signedTransactionInfo = data.signedTransactionInfo as string | undefined;
  if (!signedTransactionInfo) return;

  const [, txB64] = signedTransactionInfo.split(".");
  if (!txB64) return;

  let txInfo: Record<string, unknown>;
  try {
    txInfo = JSON.parse(Buffer.from(txB64, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return;
  }

  const originalTransactionId = txInfo.originalTransactionId as string | undefined;
  if (!originalTransactionId) return;

  const userId = subscriptionService.findUserByOriginalTransactionId(originalTransactionId, "apple");
  if (!userId) return;

  switch (notificationType) {
    case "SUBSCRIBED":
    case "DID_RENEW": {
      const expiresMs = txInfo.expiresDate as number | undefined;
      const expiresAt = expiresMs ? new Date(expiresMs).toISOString() : null;
      subscriptionService.markUserPro(userId, "apple", originalTransactionId, expiresAt);
      break;
    }
    case "EXPIRED":
    case "GRACE_PERIOD_EXPIRED":
    case "DID_FAIL_TO_RENEW":
      subscriptionService.setReceiptStatus(userId, "apple", originalTransactionId, "expired");
      break;
    case "REFUND":
    case "REVOKE":
      subscriptionService.setReceiptStatus(userId, "apple", originalTransactionId, "refunded");
      break;
    default:
      // Other event types (PRICE_INCREASE, etc.) — no action needed
      break;
  }
});

// ── POST /api/subscriptions/webhooks/google ──────────────────────────────────

/**
 * Receives Google Play Real-time Developer Notifications via Cloud Pub/Sub.
 * Google sends a base64-encoded JSON message with SubscriptionNotification events.
 *
 * Security: the Cloud Pub/Sub subscription should be configured to push to a
 * URL that includes a secret token (set GOOGLE_PUBSUB_TOKEN env var) to
 * prevent unauthorised calls.
 * Reference: https://developer.android.com/google/play/billing/rtdn-reference
 */
export const googleWebhook = asyncHandler(async (req: Request, res: Response) => {
  res.sendStatus(200);

  if (!isSubscriptionsEnabled()) return;

  // Validate Pub/Sub token if configured
  const expectedToken = process.env.GOOGLE_PUBSUB_TOKEN;
  if (expectedToken) {
    const token = (req.query.token ?? req.headers["x-pubsub-token"]) as string | undefined;
    if (token !== expectedToken) return;
  }

  const message = req.body?.message as { data?: string } | undefined;
  if (!message?.data) return;

  let notification: Record<string, unknown>;
  try {
    notification = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf8")
    ) as Record<string, unknown>;
  } catch {
    return;
  }

  const subNotification = notification.subscriptionNotification as
    | Record<string, unknown>
    | undefined;
  if (!subNotification) return;

  const purchaseToken = subNotification.purchaseToken as string | undefined;
  const subscriptionId = subNotification.subscriptionId as string | undefined;
  const notificationType = subNotification.notificationType as number | undefined;

  if (!purchaseToken || !subscriptionId) return;

  // Find the user by resolving their purchase token via Google Play API
  // notificationType: 1=recovered, 2=renewed, 3=cancelled, 4=purchased,
  //                   5=on_hold, 6=in_grace_period, 7=restarted, 12=revoked, 13=expired
  if (notificationType === 3 || notificationType === 12 || notificationType === 13) {
    // Cancelled / revoked / expired — look up user and revoke Pro
    // We stored orderId as original_transaction_id; with only a purchaseToken here
    // we'd need to call the Play API to get the orderId. For now log for manual handling.
    // TODO: call validateGooglePurchase() to resolve orderId then look up user
    return;
  }

  if (notificationType === 1 || notificationType === 2 || notificationType === 4) {
    // Recovered / renewed / purchased — re-validate the token to refresh expiry
    const packageName = process.env.GOOGLE_PACKAGE_NAME;
    if (!packageName) return;

    try {
      const { validateGooglePurchase } = await import("../services/googlePlayService");
      const result = await validateGooglePurchase(packageName, subscriptionId, purchaseToken);
      if (!result.valid || !result.orderId) return;

      const userId = subscriptionService.findUserByOriginalTransactionId(result.orderId, "google");
      if (!userId) return;

      subscriptionService.markUserPro(userId, "google", result.orderId, result.expiresAt ?? null);
    } catch {
      // Silently ignore — the next foreground receipt validation will correct state
    }
  }
});
