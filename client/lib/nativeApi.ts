import { getApiUrl } from "@/lib/query-client";
import { ensureAuthToken, getAuthHeaders, refreshAuthToken } from "@/lib/nativeAuth";

const REQUEST_TIMEOUT_MS = 20_000;

async function fetchOnce(
  url: string,
  init: RequestInit | undefined,
  authHeaders: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...authHeaders,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function nativeRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  await ensureAuthToken();
  const url = new URL(path, getApiUrl()).toString();

  let res = await fetchOnce(url, init, await getAuthHeaders());

  // Guest JWTs expire after 7 days. On a 401 the stored token is dead, so mint a
  // fresh guest token and retry once — otherwise the client would 401 forever
  // and every server-backed feature (AI generation, sync) would silently fail.
  if (res.status === 401) {
    const refreshed = await refreshAuthToken();
    if (refreshed) {
      res = await fetchOnce(url, init, await getAuthHeaders());
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }

  return (await res.json()) as T;
}
