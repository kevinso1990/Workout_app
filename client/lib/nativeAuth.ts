import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { getApiUrl } from "@/lib/query-client";

export const TOKEN_KEY = "workoutapp_auth_token";
const DEVICE_ID_KEY = "device_id";

// The guest account is keyed on this id. It lives in the iOS Keychain, which
// survives deleting the app, so a reinstall gets the same account and its
// cloud backup back. AsyncStorage keeps a copy (and is where ids from builds
// before the Keychain move are migrated from).
const KEYCHAIN = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
let deviceIdPromise: Promise<string> | null = null;

async function readKeychain(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(DEVICE_ID_KEY, KEYCHAIN);
  } catch {
    return null;
  }
}

async function loadDeviceId(): Promise<string> {
  const kept = await readKeychain();
  let id = kept ?? (await AsyncStorage.getItem(DEVICE_ID_KEY));
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}`;
  }
  if (!kept) await SecureStore.setItemAsync(DEVICE_ID_KEY, id, KEYCHAIN).catch(() => {});
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export async function getDeviceId(): Promise<string> {
  if (!deviceIdPromise) {
    deviceIdPromise = loadDeviceId().catch((err) => {
      deviceIdPromise = null;
      throw err;
    });
  }
  return deviceIdPromise;
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

function decodeJwtPayload(token: string): { sub?: number; provider?: string } | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const padded = segment + "=".repeat((4 - (segment.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as { sub?: number; provider?: string };
  } catch {
    return null;
  }
}

/** Best-effort JWT payload decode — server is source of truth for auth. */
export function decodeJwtSub(token: string): number | null {
  const sub = decodeJwtPayload(token)?.sub;
  return typeof sub === "number" ? sub : null;
}

/** "guest", "apple", … for the stored token, or null without one. */
export async function getAuthProvider(): Promise<string | null> {
  const token = await getStoredToken();
  return (token && decodeJwtPayload(token)?.provider) || null;
}

let bootstrapPromise: Promise<string | null> | null = null;

async function guestLogin(): Promise<string | null> {
  try {
    const url = new URL("/api/auth/guest", getApiUrl()).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": await getDeviceId(),
      },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { token: string };
    await setStoredToken(body.token);
    return body.token;
  } catch {
    return null;
  }
}

/**
 * Ensures every native client has a JWT (guest or OAuth) so server-side
 * features (split-refresh, recovery, structured sync) can scope data by user.
 */
export async function ensureAuthToken(): Promise<string | null> {
  const existing = await getStoredToken();
  if (existing) return existing;
  if (!bootstrapPromise) {
    bootstrapPromise = guestLogin().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

/** Swaps an expired token for a fresh one for the same user, or null. */
async function renewLogin(token: string): Promise<string | null> {
  try {
    const res = await fetch(new URL("/api/auth/refresh", getApiUrl()).toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { token: string };
    await setStoredToken(body.token);
    return body.token;
  } catch {
    return null;
  }
}

/**
 * Replaces a dead token after a 401. JWTs expire after 7 days; without this a
 * client keeps sending its dead token forever — every request 401s and server
 * features silently fall back. The same account is renewed first (so an Apple
 * sign-in isn't silently swapped for a guest), else a guest token is minted.
 * De-duplicated via bootstrapPromise so a burst of 401s re-logs in only once.
 */
export async function refreshAuthToken(): Promise<string | null> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const old = await getStoredToken();
      await setStoredToken(null);
      return (old && (await renewLogin(old))) || guestLogin();
    })().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}

/**
 * Sign in with Apple. Returns the account token, or null when the user
 * cancelled; throws when Apple or our server refuse. The token is NOT stored:
 * the caller first compares the account's backup with this phone, because a
 * background sync under the new token would overwrite that backup.
 */
export async function signInWithApple(): Promise<string | null> {
  const AppleAuthentication = await import("expo-apple-authentication");
  let credential: Awaited<ReturnType<typeof AppleAuthentication.signInAsync>>;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (err) {
    if ((err as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw err;
  }
  if (!credential.identityToken) throw new Error("Apple returned no identity token");
  const name = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(" ");
  const res = await fetch(new URL("/api/auth/apple", getApiUrl()).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: credential.identityToken, name: name || undefined }),
  });
  if (!res.ok) throw new Error(`Apple sign-in failed (${res.status})`);
  return ((await res.json()) as { token: string }).token;
}

/** Back to this device's guest account; local data stays on the phone. */
export async function signOutToGuest(): Promise<string | null> {
  await setStoredToken(null);
  return ensureAuthToken();
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await ensureAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-device-id": await getDeviceId(),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function deleteSignedIn(token: string): Promise<void> {
  const res = await fetch(new URL("/api/auth/account", getApiUrl()).toString(), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Account deletion failed (${res.status})`);
}

/**
 * Deletes the account and its server data. Signed in with Apple, this
 * device's guest account goes too, since it may hold the same history from
 * before the sign-in. Local data is the caller's to clear.
 */
export async function deleteAccount(): Promise<void> {
  const token = await ensureAuthToken();
  if (!token) throw new Error("No account to delete");
  const provider = decodeJwtPayload(token)?.provider;
  try {
    await deleteSignedIn(token);
  } catch {
    // An expired token: renew once, then retry.
    const fresh = await refreshAuthToken();
    if (!fresh || decodeJwtPayload(fresh)?.provider !== provider) throw new Error("Account deletion failed");
    await deleteSignedIn(fresh);
  }
  await setStoredToken(null);
  if (provider !== "guest") {
    const guest = await guestLogin();
    if (guest) await deleteSignedIn(guest).catch(() => {});
    await setStoredToken(null);
  }
}
