/**
 * Expo Go over Cloudflare quick tunnel (ngrok v2 in `expo start --tunnel` is broken).
 * Sets EXPO_PACKAGER_PROXY_URL so manifest + bundle URLs use the public HTTPS host.
 */
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import http from "node:http";
import https from "node:https";

const METRO_PORT = process.env.EXPO_METRO_PORT?.trim() || "8081";
const here = dirname(fileURLToPath(import.meta.url));
const clearCache = process.argv.includes("--clear");

function waitForMetro(port, ms = 120_000) {
  const deadline = Date.now() + ms;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}/status`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else if (Date.now() > deadline) reject(new Error("Metro status timeout"));
        else setTimeout(tick, 500).unref();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("Metro not reachable"));
        else setTimeout(tick, 500).unref();
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (Date.now() > deadline) reject(new Error("Metro status timeout"));
        else setTimeout(tick, 500).unref();
      });
    };
    tick();
  });
}

function prewarmBundleHttp(url, label) {
  return new Promise((resolve) => {
    console.log(`[expo] Pre-building iOS bundle (${label})...`);
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, (res) => {
      res.resume();
      console.log(`[expo] ${label} HTTP ${res.statusCode}`);
      resolve(res.statusCode);
    });
    req.on("error", (e) => {
      console.warn(`[expo] ${label} failed:`, e.message);
      resolve(0);
    });
    req.setTimeout(300_000, () => {
      req.destroy();
      console.warn(`[expo] ${label} timed out`);
      resolve(0);
    });
  });
}

function bundleQuery() {
  return "platform=ios&dev=true&hot=false&lazy=false&minify=false";
}

function parseTunnelUrl(chunk, current) {
  const m = chunk.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  return m ? m[0] : current;
}

try {
  execSync(`node "${join(here, "kill-metro.mjs")}"`, { stdio: "inherit", shell: true });
} catch {
  /* best effort */
}
await sleep(400);

let tunnelUrl = "";
const cfArgs = [
  "--yes",
  "cloudflared",
  "tunnel",
  "--url",
  `http://127.0.0.1:${METRO_PORT}`,
  "--http-host-header",
  "localhost",
  "--proxy-connect-timeout",
  "120s",
];

const cf = spawn("npx", cfArgs, { shell: true, stdio: ["ignore", "pipe", "pipe"] });
cf.stdout.on("data", (d) => {
  tunnelUrl = parseTunnelUrl(d.toString(), tunnelUrl);
});
cf.stderr.on("data", (d) => {
  tunnelUrl = parseTunnelUrl(d.toString(), tunnelUrl);
});

for (let i = 0; i < 90 && !tunnelUrl; i++) await sleep(500);
if (!tunnelUrl) {
  console.error("[expo] Cloudflare tunnel URL not received.");
  cf.kill();
  process.exit(1);
}

console.log(`[expo] Cloudflare tunnel: ${tunnelUrl}`);

const expoArgs = ["expo", "start", "--go", "--port", METRO_PORT];
if (clearCache) expoArgs.push("--clear");

const expo = spawn("npx", expoArgs, {
  shell: true,
  stdio: "inherit",
  env: {
    ...process.env,
    EXPO_OFFLINE: "1",
    EXPO_PACKAGER_PROXY_URL: tunnelUrl,
  },
});

cf.on("exit", (code) => {
  if (code && code !== 0) console.warn(`[expo] cloudflared exited (${code})`);
});

process.on("SIGINT", () => {
  cf.kill();
  expo.kill("SIGINT");
});
process.on("SIGTERM", () => {
  cf.kill();
  expo.kill("SIGTERM");
});

try {
  await waitForMetro(METRO_PORT);
  const q = bundleQuery();
  await prewarmBundleHttp(
    `http://127.0.0.1:${METRO_PORT}/client/index.bundle?${q}`,
    "local Metro",
  );
  await prewarmBundleHttp(
    `${tunnelUrl}/client/index.bundle?${q}`,
    "Cloudflare tunnel",
  );
  const expUrl = tunnelUrl.replace(/^https:\/\//, "exp://");
  console.log("\n========================================");
  console.log("Expo Go URL (copy as plain text):");
  console.log(expUrl);
  console.log("========================================\n");
} catch (e) {
  console.warn("[expo]", e.message);
}

expo.on("exit", (code) => {
  cf.kill();
  process.exit(code ?? 0);
});
