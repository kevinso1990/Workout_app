import { getApiUrl } from "@/lib/query-client";
import { ensureAuthToken, getAuthHeaders } from "@/lib/nativeAuth";

const REQUEST_TIMEOUT_MS = 20_000;

export async function nativeRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  await ensureAuthToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const url = new URL(path, getApiUrl()).toString();
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(await getAuthHeaders()),
        ...(init?.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Request failed (${res.status})`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
