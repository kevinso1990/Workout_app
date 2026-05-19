/**
 * Apple StoreKit receipt validation.
 *
 * Uses the legacy App Store Receipt Validation API (verifyReceipt), which
 * works for StoreKit 1 apps. If you later migrate to StoreKit 2, switch to
 * the App Store Server API:
 *   https://developer.apple.com/documentation/appstoreserverapiapi
 *
 * Required env vars:
 *   APPLE_SHARED_SECRET   — from App Store Connect → Your App → Subscriptions
 *   APPLE_PRODUCT_ID      — e.g. "com.yourapp.pro_monthly"  (optional filter)
 */

const APPLE_ENDPOINT_PRODUCTION = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_ENDPOINT_SANDBOX    = "https://sandbox.itunes.apple.com/verifyReceipt";

export interface AppleValidationResult {
  valid: boolean;
  originalTransactionId?: string;
  productId?: string;
  expiresAt?: string | null;
  /** Raw Apple status code — 0 means success */
  appleStatus?: number;
  error?: string;
  /** Entire Apple response, stored for audit/debugging */
  rawResponse?: string;
}

/**
 * Sends a StoreKit receipt to Apple and returns the parsed result.
 *
 * Apple automatically redirects sandbox receipts from production (status 21007),
 * so callers can always pass `isSandbox = false` initially; this function
 * handles the retry transparently.
 */
export async function validateAppleReceipt(
  receiptData: string,
  isSandbox = false
): Promise<AppleValidationResult> {
  const sharedSecret = process.env.APPLE_SHARED_SECRET;
  if (!sharedSecret) {
    throw new Error("APPLE_SHARED_SECRET environment variable is not set");
  }

  const endpoint = isSandbox ? APPLE_ENDPOINT_SANDBOX : APPLE_ENDPOINT_PRODUCTION;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      "receipt-data": receiptData,
      password: sharedSecret,
      "exclude-old-transactions": true,
    }),
  });

  if (!res.ok) {
    return { valid: false, error: `Apple HTTP error: ${res.status}` };
  }

  const data = (await res.json()) as Record<string, unknown>;
  const rawResponse = JSON.stringify(data);
  const status = data.status as number;

  // 21007 = receipt is a sandbox receipt but was sent to production endpoint
  if (status === 21007 && !isSandbox) {
    return validateAppleReceipt(receiptData, /* isSandbox= */ true);
  }

  if (status !== 0) {
    return {
      valid: false,
      appleStatus: status,
      error: `Apple validation failed with status ${status}`,
      rawResponse,
    };
  }

  const latestInfo = (data.latest_receipt_info as Record<string, string>[]) ?? [];
  if (!latestInfo.length) {
    return { valid: false, error: "No receipt info in Apple response", rawResponse };
  }

  const expectedProductId = process.env.APPLE_PRODUCT_ID ?? "";

  // Find the most recent, non-expired receipt for our product
  const candidates = latestInfo
    .filter((r) => !expectedProductId || r.product_id === expectedProductId)
    .sort((a, b) => parseInt(b.expires_date_ms) - parseInt(a.expires_date_ms));

  if (!candidates.length) {
    return { valid: false, error: "Matching product not found in Apple receipt", rawResponse };
  }

  const latest = candidates[0];
  const expiresMs = parseInt(latest.expires_date_ms);
  const expiresAt = expiresMs ? new Date(expiresMs).toISOString() : null;
  const isExpired = expiresMs > 0 && expiresMs < Date.now();

  return {
    valid: !isExpired,
    originalTransactionId: latest.original_transaction_id,
    productId: latest.product_id,
    expiresAt,
    appleStatus: 0,
    rawResponse,
  };
}
