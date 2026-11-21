/**
 * Auth service: Google / Apple / guest / dev plus optional email+password for
 * local development and legacy clients.
 *
 * - OAuth users are looked up / created by (provider, provider_id).
 * - Email users use provider `email` and provider_id = normalized email.
 * - Sessions are stateless JWTs signed with JWT_SECRET; logout is client-side.
 */
import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db";
import { AppError } from "../middleware/errorHandler";
import { verifyGoogleIdToken, verifyAppleIdToken } from "./oauthService";
import type {
  User,
  PublicUser,
  JwtPayload,
  AuthResponse,
  OAuthIdentity,
  AuthProvider,
} from "../models";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return secret;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    provider: user.provider,
    created_at: user.created_at,
    subscription_tier: user.subscription_tier ?? "free",
    subscription_provider: user.subscription_provider ?? null,
    subscription_expires_at: user.subscription_expires_at ?? null,
  };
}

export function signToken(user: User): string {
  const provider: AuthProvider =
    user.provider ?? (user.password_hash ? "email" : (null as unknown as AuthProvider));
  if (!provider) throw new AppError(500, "Cannot sign token for a user without a provider");
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    provider,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, getJwtSecret()) as unknown as JwtPayload;
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
}

/**
 * Signature-only check for proving who owns data (cloud backup). Expiry is
 * ignored on purpose: guest tokens expire after 7 days and the backup push
 * does not refresh them, but a validly signed token still proves the owner.
 * Returns the user id, or null for a missing or forged token.
 */
export function tokenOwner(token: string | undefined): number | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret(), { ignoreExpiration: true }) as unknown as JwtPayload;
    return typeof payload.sub === "number" ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Tokens older than this can't be renewed; the client signs in again instead. */
const RENEW_MAX_AGE_S = 365 * 24 * 60 * 60;

/**
 * Renews an expired but validly signed token for a user that still exists.
 * Keeps Apple users signed in past the 7-day expiry instead of the client
 * silently falling back to a fresh guest account.
 */
export function renewToken(token: string | undefined): AuthResponse {
  if (!token) throw new AppError(401, "Token required");
  let payload: JwtPayload & { iat?: number };
  try {
    payload = jwt.verify(token, getJwtSecret(), { ignoreExpiration: true }) as unknown as JwtPayload & { iat?: number };
  } catch {
    throw new AppError(401, "Invalid token");
  }
  if (!payload.iat || Date.now() / 1000 - payload.iat > RENEW_MAX_AGE_S) {
    throw new AppError(401, "Token too old to renew");
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.sub) as User | undefined;
  if (!user) throw new AppError(401, "User no longer exists");
  return { token: signToken(user), user: toPublicUser(user) };
}

/**
 * Deletes a user and everything stored for them (App Store 5.1.1(v)).
 * Anonymous rows (usage events, exercise votes by device) aren't linked to
 * the account and stay.
 */
export function deleteUserAccount(userId: number): void {
  const statements = [
    "DELETE FROM sets WHERE user_id = @id OR session_id IN (SELECT id FROM sessions WHERE user_id = @id)",
    "DELETE FROM sessions WHERE user_id = @id",
    "DELETE FROM plan_exercises WHERE plan_id IN (SELECT id FROM plans WHERE user_id = @id)",
    "DELETE FROM plans WHERE user_id = @id",
    "DELETE FROM body_weight WHERE user_id = @id",
    "DELETE FROM exercise_feedback WHERE user_id = @id",
    "DELETE FROM muscle_fatigue WHERE user_id = @id",
    "DELETE FROM mobile_workout_sync WHERE user_id = @id",
    "DELETE FROM subscription_receipts WHERE user_id = @id",
    "DELETE FROM exercises WHERE user_id = @id AND is_custom = 1",
    "DELETE FROM device_cloud_sync WHERE user_id = 'u' || CAST(@id AS INTEGER)",
    "DELETE FROM users WHERE id = @id",
  ];
  db.transaction(() => {
    for (const sql of statements) db.prepare(sql).run({ id: userId });
  })();
}

/** Look up a user by primary key — used by GET /api/auth/me to return fresh data. */
export function getUserById(id: number): User {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
  if (!user) throw new AppError(404, "User not found");
  return user;
}

/**
 * Find or create a user from a verified OAuth identity.
 *
 * Resolution rules:
 *   1. If a row with (provider, provider_id) exists → return it (and refresh
 *      name/avatar if the IdP sent newer values).
 *   2. Else if a row with the same email exists AND it has *no provider yet*
 *      (legacy/empty account), adopt it once. We deliberately do NOT auto-link
 *      across providers by email alone — Apple's "Hide My Email" relays and
 *      stale leaked emails make that a well-known account-takeover vector.
 *      A user wanting to switch providers must do an explicit linking flow.
 *   3. Else if a row with the same email exists with a *different* provider →
 *      reject with 409 so the client can prompt "sign in with X instead".
 *   4. Else insert a new row.
 */
export function findOrCreateOAuthUser(identity: OAuthIdentity): User {
  const existingByProvider = db
    .prepare("SELECT * FROM users WHERE provider = ? AND provider_id = ?")
    .get(identity.provider, identity.provider_id) as User | undefined;

  if (existingByProvider) {
    // Refresh display fields if the IdP returned newer values; never wipe what we have
    const newName = identity.name ?? existingByProvider.name;
    const newAvatar = identity.avatar_url ?? existingByProvider.avatar_url;
    if (newName !== existingByProvider.name || newAvatar !== existingByProvider.avatar_url) {
      db.prepare("UPDATE users SET name = ?, avatar_url = ? WHERE id = ?").run(
        newName,
        newAvatar,
        existingByProvider.id,
      );
    }
    return getUserById(existingByProvider.id);
  }

  const existingByEmail = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(identity.email) as User | undefined;

  if (existingByEmail) {
    if (existingByEmail.provider === null) {
      // Legacy unmigrated account (created before OAuth was enabled) — safe to adopt
      // because no other identity is currently bound to it.
      db.prepare(
        "UPDATE users SET provider = ?, provider_id = ?, name = COALESCE(name, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?",
      ).run(identity.provider, identity.provider_id, identity.name, identity.avatar_url, existingByEmail.id);
      return getUserById(existingByEmail.id);
    }
    // Account already bound to another provider — refuse to silently adopt
    throw new AppError(
      409,
      `An account with this email already exists under a different sign-in provider (${existingByEmail.provider}). Please sign in with ${existingByEmail.provider}.`,
    );
  }

  const result = db
    .prepare(
      `INSERT INTO users (email, name, avatar_url, provider, provider_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(identity.email, identity.name, identity.avatar_url, identity.provider, identity.provider_id);

  return getUserById(result.lastInsertRowid as number);
}

// ── High-level entry points used by the auth controller ─────────────────────

export async function signInWithGoogle(idToken: string): Promise<AuthResponse> {
  const identity = await verifyGoogleIdToken(idToken);
  const user = findOrCreateOAuthUser(identity);
  return { token: signToken(user), user: toPublicUser(user) };
}

export async function signInWithApple(idToken: string, name?: string): Promise<AuthResponse> {
  const identity = await verifyAppleIdToken(idToken, name);
  const user = findOrCreateOAuthUser(identity);
  return { token: signToken(user), user: toPublicUser(user) };
}

/**
 * Dev-only: returns (creating if necessary) a fixed test user and signs a JWT
 * for them. Lets the web UI work end-to-end without configuring real OAuth
 * client IDs. Gated by NODE_ENV at the route layer.
 */
const DEV_USER: OAuthIdentity = {
  provider: "dev",
  provider_id: "local-dev-user",
  email: "dev@local.test",
  name: "Dev User",
  avatar_url: null,
};

export function signInAsDevUser(): AuthResponse {
  const user = findOrCreateOAuthUser(DEV_USER);
  return { token: signToken(user), user: toPublicUser(user) };
}

/**
 * Guest sign-in: lets a user use the app without creating an account. Each
 * guest is keyed on the device ID the client sends (x-device-id header), so
 * data persists on that device across sessions, but is "lost" if the user
 * clears storage / switches devices / signs in for real.
 *
 * Available in all environments — guest mode is a real product feature, not a
 * dev bypass. The user can always promote a guest account by signing in with
 * Google/Apple later (account linking is future work).
 *
 * Privacy: the raw device ID is never stored or echoed in the JWT. We HMAC it
 * with a JWT_SECRET-derived key (domain-separated by a fixed prefix) and use
 * the resulting hex digest as both `provider_id` and the synthetic email
 * local-part. So even if the DB or a token leaks, the original device ID
 * cannot be recovered.
 */
function hashDeviceId(deviceId: string): string {
  return createHmac("sha256", getJwtSecret())
    .update(`guest-device-id:v1:${deviceId}`)
    .digest("hex")
    .slice(0, 32);
}

export function signInAsGuest(deviceId: string): AuthResponse {
  if (!deviceId || deviceId.length < 8 || deviceId.length > 128) {
    throw new AppError(400, "A valid device ID is required for guest sign-in");
  }
  const hashed = hashDeviceId(deviceId);
  const identity: OAuthIdentity = {
    provider: "guest",
    provider_id: hashed,
    // Synthetic email keeps the UNIQUE(email) constraint satisfied; using the
    // HMAC digest (not the raw device ID) means the row contains no
    // recoverable client identifier.
    email: `guest-${hashed}@guest.local`,
    name: "Guest",
    avatar_url: null,
  };
  const user = findOrCreateOAuthUser(identity);
  return { token: signToken(user), user: toPublicUser(user) };
}

/** Email + password registration (local dev / tests / optional web clients). */
export function signUpWithEmailPassword(username: string, email: string, password: string): AuthResponse {
  const u = username.trim();
  const normEmail = email.trim().toLowerCase();
  if (!u) throw new AppError(400, "username is required");
  if (!normEmail) throw new AppError(400, "email is required");
  if (!password || password.length < 8) {
    throw new AppError(400, "password must be at least 8 characters");
  }

  const dup = db.prepare("SELECT id FROM users WHERE email = ?").get(normEmail) as { id: number } | undefined;
  if (dup) throw new AppError(409, "Email already registered");

  const hash = bcrypt.hashSync(password, 10);
  const ins = db
    .prepare(
      `INSERT INTO users (username, email, password_hash, provider, provider_id, name)
       VALUES (?, ?, ?, 'email', ?, ?)`,
    )
    .run(u, normEmail, hash, normEmail, u);

  const user = getUserById(ins.lastInsertRowid as number);
  return { token: signToken(user), user: toPublicUser(user) };
}

export function signInWithEmailPassword(email: string, password: string): AuthResponse {
  const normEmail = email.trim().toLowerCase();
  if (!normEmail || !password) throw new AppError(400, "email and password are required");

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normEmail) as User | undefined;
  if (!user?.password_hash) throw new AppError(401, "Invalid email or password");
  if (!bcrypt.compareSync(password, user.password_hash)) {
    throw new AppError(401, "Invalid email or password");
  }
  if (user.provider && user.provider !== "email") {
    throw new AppError(401, "Invalid email or password");
  }
  return { token: signToken(user), user: toPublicUser(user) };
}
