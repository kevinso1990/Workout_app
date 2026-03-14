/**
 * Google Play Billing purchase token validation.
 *
 * Uses the Google Play Developer API (androidpublisher v3).
 * Reference: https://developers.google.com/android-publisher/api-ref/rest/v1/purchases.subscriptions/get
 *
 * Required env vars:
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  — full JSON content of the service account key file
 *                                       (from Google Play Console → Setup → API access)
 *   GOOGLE_PRODUCT_ID                 — e.g. "pro_monthly"
 *   GOOGLE_PACKAGE_NAME               — e.g. "com.yourapp.fitplan"
 *
 * How to obtain GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:
 *   1. In Google Play Console, go to Setup → API access.
 *   2. Link to (or create) a Google Cloud project.
 *   3. Create a Service Account with "Financial data viewer" role.
 *   4. Download the JSON key file.
 *   5. Set the ENTIRE JSON content as the env var value.
 */

export interface GoogleValidationResult {
  valid: boolean;
  orderId?: string;
  expiresAt?: string | null;
  autoRenewing?: boolean;
  cancelReason?: number;
  error?: string;
  rawResponse?: string;
}

// ── Internal: Google OAuth2 JWT signing ───────────────────────────────────────

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

/**
 * Creates a short-lived Google OAuth2 access token using a service account key.
 * Uses Node's built-in `crypto` module — no extra dependencies needed.
 */
async function getAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const { createSign } = await import("crypto");

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const signature = sign.sign(serviceAccount.private_key, "base64url");

  const jws = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jws,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google OAuth token error (${res.status}): ${err}`);
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function validateGooglePurchase(
  packageName: string,
  subscriptionId: string,
  purchaseToken: string
): Promise<GoogleValidationResult> {
  const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON environment variable is not set");
  }

  let serviceAccount: ServiceAccountKey;
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccountKey;
  } catch {
    throw new Error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  const accessToken = await getAccessToken(serviceAccount);

  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications` +
    `/${encodeURIComponent(packageName)}/purchases/subscriptions` +
    `/${encodeURIComponent(subscriptionId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const rawResponse = await res.text();

  if (!res.ok) {
    return {
      valid: false,
      error: `Google Play API error (${res.status}): ${rawResponse}`,
      rawResponse,
    };
  }

  const sub = JSON.parse(rawResponse) as Record<string, unknown>;
  const expiresMs = parseInt((sub.expiryTimeMillis as string) ?? "0");
  const isExpired = expiresMs > 0 && expiresMs < Date.now();
  // paymentState: 0=pending, 1=received, 2=free trial, 3=pending deferred
  const paymentReceived = sub.paymentState === 1 || sub.paymentState === 2;

  return {
    valid: !isExpired && paymentReceived,
    orderId: sub.orderId as string | undefined,
    expiresAt: expiresMs ? new Date(expiresMs).toISOString() : null,
    autoRenewing: sub.autoRenewing as boolean | undefined,
    cancelReason: sub.cancelReason as number | undefined,
    rawResponse,
  };
}
