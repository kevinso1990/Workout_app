import { QueryClient, QueryFunction } from "@tanstack/react-query";

import { getApiUrl } from "@/constants/api";
import { formatApiResponseError } from "@/lib/httpErrors";
import { parseJsonFromText, readResponseBodyAsText } from "@/lib/fetchBody";

export {
  getApiUrl,
  resolveDevLanHost,
  isLoopbackHost,
  isLegacyCloudHost,
  DEFAULT_LOCAL_API_URL,
} from "@/constants/api";

async function readJsonResponse<T>(res: Response, url: string): Promise<T> {
  const text = await readResponseBodyAsText(res);
  if (!res.ok) {
    throw new Error(formatApiResponseError(res.status, text || res.statusText, url));
  }
  const data = parseJsonFromText<T>(text);
  if (data == null) {
    throw new Error(formatApiResponseError(res.status, text, url));
  }
  return data;
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl).toString();

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const text = await readResponseBodyAsText(res);
    throw new Error(formatApiResponseError(res.status, text, url));
  }
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export function getQueryFn<T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> {
  const { on401: unauthorizedBehavior } = options;
  const queryFn: QueryFunction<T> = async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl).toString();

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as T;
    }

    return readJsonResponse<T>(res, url);
  };
  return queryFn;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
