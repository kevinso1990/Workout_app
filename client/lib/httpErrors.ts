/** Detect proxy / CDN HTML error pages (e.g. 403 Forbidden) mistaken for JSON APIs. */
export function looksLikeHtmlBody(text: string): boolean {
  const t = text.trim().slice(0, 400).toLowerCase();
  if (!t) return false;
  return (
    t.startsWith("<!doctype") ||
    t.startsWith("<html") ||
    t.includes("<head>") ||
    t.includes("403 forbidden") ||
    t.includes("access denied") ||
    t.includes("x-requested-with")
  );
}

export function isProxyWaf403(body: string): boolean {
  const t = body.toLowerCase();
  return (
    t.includes("x-requested-with") ||
    (t.includes("expected:") && t.includes("header"))
  );
}

export function formatHtmlApiError(status: number, url: string): string {
  return (
    `API returned an HTML error page (${status}), not JSON. ` +
    `The app is not reaching your local Express server at ${url}. ` +
    `Set EXPO_PUBLIC_API_URL to http://YOUR_LAN_IP:5000/ in .env, run "npm run server:dev", ` +
    `and start Expo with "npm start" (--lan, not --tunnel).`
  );
}

export function formatApiResponseError(
  status: number,
  body: string,
  url: string,
): string {
  if (status === 403 && isProxyWaf403(body)) {
    return (
      `Import blocked (403). The request did not reach your local API at ${url}. ` +
      `Confirm EXPO_PUBLIC_API_URL is your PC LAN IP (http://192.168.x.x:5000), ` +
      `npm run server:dev is running, and you are not hitting a Replit/cloud URL.`
    );
  }
  if (looksLikeHtmlBody(body)) {
    return formatHtmlApiError(status, url);
  }
  const preview = body.trim().slice(0, 200);
  return preview ? `${status}: ${preview}` : `${status}`;
}
