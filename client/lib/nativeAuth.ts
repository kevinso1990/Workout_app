import AsyncStorage from "@react-native-async-storage/async-storage";

import { getApiUrl } from "@/lib/query-client";

export const TOKEN_KEY = "workoutapp_auth_token";
const DEVICE_ID_KEY = "device_id";

export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setStoredToken(token: string | null): Promise<void> {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

/** Best-effort JWT payload decode — server is source of truth for auth. */
export function decodeJwtSub(token: string): number | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const padded = segment + "=".repeat((4 - (segment.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { sub?: number };
    return typeof payload.sub === "number" ? payload.sub : null;
  } catch {
    return null;
  }
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

/**
 * Force a brand-new guest token, discarding the stored one. Guest JWTs expire
 * after 7 days; without this a client keeps sending its dead token forever —
 * every request 401s and server features silently fall back. Callers use this
 * to recover from a 401 and retry once. De-duplicated via bootstrapPromise so a
 * burst of 401s triggers only one re-login.
 */
export async function refreshAuthToken(): Promise<string | null> {
  await setStoredToken(null);
  if (!bootstrapPromise) {
    bootstrapPromise = guestLogin().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
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
