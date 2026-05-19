import { Platform } from "react-native";
import Constants from "expo-constants";

/** Local Cursor / Express dev server (LAN). Override via `EXPO_PUBLIC_API_URL`. */
export const DEFAULT_LOCAL_API_URL = "http://192.168.178.102:5000/";

const LEGACY_CLOUD_HOST =
  /replit\.dev$|\.repl\.co$|\.repl\.it$|exp\.direct$|ngrok\.io$|ngrok-free\.app$/i;

/** Metro / Expo dev server LAN host (e.g. 192.168.x.x) — not localhost on device. */
export function resolveDevLanHost(): string | null {
  const rawCandidates: (string | undefined)[] = [
    Constants.expoConfig?.hostUri,
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost,
    (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost,
    (
      Constants as {
        manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
      }
    ).manifest2?.extra?.expoClient?.hostUri,
  ];

  for (const raw of rawCandidates) {
    if (!raw) continue;
    const host = String(raw).split("/")[0]?.split(":")[0]?.trim();
    if (host && !isLoopbackHost(host) && !isLegacyCloudHost(host)) return host;
  }
  return null;
}

export function isLoopbackHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.startsWith("127.0.0.1") ||
    h === "10.0.2.2"
  );
}

export function isLegacyCloudHost(hostOrUrl: string): boolean {
  const raw = hostOrUrl.trim().toLowerCase();
  if (!raw) return false;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    const host = new URL(withProto).hostname;
    return LEGACY_CLOUD_HOST.test(host) || host.includes("replit");
  } catch {
    return LEGACY_CLOUD_HOST.test(raw) || raw.includes("replit");
  }
}

function hostOnly(domain: string): string {
  return domain.split(":")[0] ?? domain;
}

function normalizeApiBase(url: string): string {
  let base = url.trim();
  if (!base.endsWith("/")) base += "/";
  try {
    const parsed = new URL(base);
    if (isLegacyCloudHost(parsed.hostname)) {
      return DEFAULT_LOCAL_API_URL;
    }
    if (
      Platform.OS !== "web" &&
      isLoopbackHost(parsed.hostname) &&
      resolveDevLanHost()
    ) {
      const lan = resolveDevLanHost()!;
      const port = parsed.port || "5000";
      return `http://${lan}:${port}/`;
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname) && parsed.protocol === "https:") {
      return `http://${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}/`;
    }
  } catch {
    /* keep normalized trailing slash */
  }
  return base;
}

function apiUrlFromDomain(host: string): string {
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return normalizeApiBase(host);
  }

  if (Platform.OS !== "web" && isLoopbackHost(hostOnly(host))) {
    const lan = resolveDevLanHost();
    if (lan) {
      const port = host.includes(":") ? host.split(":")[1] : "5000";
      host = `${lan}:${port}`;
    }
  }

  const useHttp =
    isLoopbackHost(hostOnly(host)) ||
    /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host);

  const protocol = useHttp ? "http" : "https";
  return normalizeApiBase(`${protocol}://${host}`);
}

/**
 * Base URL for the Express API (direct LAN to local dev server).
 *
 * Priority:
 * 1. `EXPO_PUBLIC_API_URL` — full override (legacy cloud hosts are ignored)
 * 2. `EXPO_PUBLIC_DOMAIN` — host[:port] (legacy cloud hosts are ignored)
 * 3. Metro LAN host + port 5000 on physical devices
 * 4. `DEFAULT_LOCAL_API_URL`
 */
export function getApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (explicit && !isLegacyCloudHost(explicit)) {
    return normalizeApiBase(explicit);
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (domain && !isLegacyCloudHost(domain)) {
    return apiUrlFromDomain(domain);
  }

  if (Platform.OS !== "web") {
    const lan = resolveDevLanHost();
    if (lan) {
      return `http://${lan}:5000/`;
    }
  }

  return DEFAULT_LOCAL_API_URL;
}
