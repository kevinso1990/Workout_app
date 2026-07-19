#!/usr/bin/env node
/**
 * Post-process `expo export --platform web` output:
 * - versioned service worker (network-first for HTML/JS)
 * - build id injected into index.html for cache busting
 */
import fs from "fs";
import path from "path";

const root = path.resolve(process.cwd());
const distDir = path.join(root, "dist");
const buildId =
  process.env.FITPLAN_BUILD_ID ??
  new Date().toISOString().replace(/[:.]/g, "-");

const swSource = `/* fitplan build ${buildId} */
const CACHE_NAME = "fitplan-static-${buildId}";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.includes("/api/")) return;

  const isAppShell =
    url.pathname === "/" ||
    url.pathname.endsWith(".html") ||
    url.pathname.includes("/_expo/static/js/");

  if (isAppShell) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }),
    ),
  );
});
`;

function patchIndexHtml() {
  const indexPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error("patch-web-dist: dist/index.html not found");
    process.exit(1);
  }
  let html = fs.readFileSync(indexPath, "utf8");

  const inject = `<script>window.__FITPLAN_BUILD_ID=${JSON.stringify(buildId)};</script>`;
  if (!html.includes("__FITPLAN_BUILD_ID")) {
    html = html.replace("<head>", `<head>\n    ${inject}`);
  }

  if (!html.includes('http-equiv="Cache-Control"')) {
    html = html.replace(
      "<head>",
      `<head>\n    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />\n    <meta http-equiv="Pragma" content="no-cache" />\n    <meta http-equiv="Expires" content="0" />`,
    );
  }

  fs.writeFileSync(indexPath, html, "utf8");
}

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "sw.js"), swSource, "utf8");
patchIndexHtml();

console.log(`patch-web-dist: buildId=${buildId}`);
