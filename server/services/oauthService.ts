/**
 * OAuth ID-token verification.
 *
 * Verifies the JWT id_token returned to a client by Google or Apple after a
 * successful sign-in, and extracts a normalised OAuthIdentity. The result
 * carries no trust beyond what the issuer cryptographically signed.
 */
import { OAuth2Client, type TokenPayload } from "google-auth-library";
import jwt, { type VerifyOptions } from "jsonwebtoken";
import jwksClient, { type JwksClient } from "jwks-rsa";
import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { OAuthIdentity } from "../models";

/**
 * Looks up a returning Apple user's stored email by (provider, provider_id).
 * Used because Apple omits the `email` claim on every sign-in after the first
 * for a given app — without this fallback, returning Apple users couldn't log
 * back in once their JWT expired.
 */
function lookupStoredAppleEmail(providerId: string): string | null {
  const row = db
    .prepare("SELECT email FROM users WHERE provider = 'apple' AND provider_id = ?")
    .get(providerId) as { email: string } | undefined;
  return row?.email ?? null;
}

// ── Google ────────────────────────────────────────────────────────────────────

const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? "";
// OAuth2Client takes the audience at verify-time, so a single shared client is fine
const googleClient = new OAuth2Client();

export async function verifyGoogleIdToken(idToken: string): Promise<OAuthIdentity> {
  if (!idToken) throw new AppError(400, "id_token is required");
  if (!googleClientId) {
    throw new AppError(500, "GOOGLE_OAUTH_CLIENT_ID is not configured on the server");
  }

  let payload: TokenPayload | undefined;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      // Accept both the bare client ID and any additional audiences the env var lists (comma-separated)
      audience: googleClientId.split(",").map((s) => s.trim()).filter(Boolean),
    });
    payload = ticket.getPayload();
  } catch (err) {
    throw new AppError(401, `Invalid Google ID token: ${(err as Error).message}`);
  }

  if (!payload) throw new AppError(401, "Google ID token has no payload");
  if (!payload.sub) throw new AppError(401, "Google ID token is missing the subject claim");
  if (!payload.email) throw new AppError(401, "Google ID token is missing the email claim");
  if (payload.email_verified === false) {
    throw new AppError(401, "Google account email is not verified");
  }

  return {
    provider: "google",
    provider_id: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name ?? null,
    avatar_url: payload.picture ?? null,
  };
}

// ── Apple ────────────────────────────────────────────────────────────────────

const APPLE_ISSUER = "https://appleid.apple.com";
const appleClientId = process.env.APPLE_OAUTH_CLIENT_ID ?? "";

let _appleJwks: JwksClient | null = null;
function appleJwks(): JwksClient {
  if (!_appleJwks) {
    _appleJwks = jwksClient({
      jwksUri: `${APPLE_ISSUER}/auth/keys`,
      cache: true,
      cacheMaxAge: 24 * 60 * 60 * 1000, // 24h — Apple rotates keys infrequently
      rateLimit: true,
    });
  }
  return _appleJwks;
}

interface ApplePayload {
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  is_private_email?: string | boolean;
  iss?: string;
  aud?: string | string[];
}

export async function verifyAppleIdToken(
  idToken: string,
  fallbackName?: string,
): Promise<OAuthIdentity> {
  if (!idToken) throw new AppError(400, "id_token is required");
  if (!appleClientId) {
    throw new AppError(500, "APPLE_OAUTH_CLIENT_ID is not configured on the server");
  }

  // Apple supports multiple bundle/service IDs per project — accept any in the env list
  const allowedAudiences = appleClientId.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowedAudiences.length === 0) {
    throw new AppError(500, "APPLE_OAUTH_CLIENT_ID produced no valid audience values");
  }
  const audience: NonNullable<VerifyOptions["audience"]> =
    allowedAudiences.length === 1
      ? allowedAudiences[0]
      : (allowedAudiences as [string, ...string[]]);

  const payload = await new Promise<ApplePayload>((resolve, reject) => {
    jwt.verify(
      idToken,
      (header, callback) => {
        if (!header.kid) return callback(new Error("Apple ID token missing kid header"));
        appleJwks().getSigningKey(header.kid, (err, key) => {
          if (err || !key) return callback(err ?? new Error("Apple signing key not found"));
          callback(null, key.getPublicKey());
        });
      },
      {
        algorithms: ["RS256"],
        issuer: APPLE_ISSUER,
        audience,
      },
      (err: Error | null, decoded: jwt.JwtPayload | string | undefined) => {
        if (err) return reject(new AppError(401, `Invalid Apple ID token: ${err.message}`));
        resolve(decoded as ApplePayload);
      },
    );
  });

  if (!payload.sub) throw new AppError(401, "Apple ID token is missing the subject claim");

  // Apple only returns the `email` claim on the FIRST sign-in for a given app.
  // Returning users won't have one — fall back to the email we stored at signup.
  // Only fail if it's truly a brand-new user we've never seen.
  let email = payload.email?.toLowerCase() ?? null;
  if (!email) {
    email = lookupStoredAppleEmail(payload.sub);
    if (!email) {
      throw new AppError(
        401,
        "Apple ID token is missing the email claim and no existing account was found",
      );
    }
  }

  return {
    provider: "apple",
    provider_id: payload.sub,
    email,
    name: fallbackName ?? null,
    avatar_url: null,
  };
}
