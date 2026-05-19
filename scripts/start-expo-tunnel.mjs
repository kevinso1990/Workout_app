/**
 * Default npm start — Metro via Expo tunnel (works when LAN/Safari fails).
 * Your API server still uses EXPO_PUBLIC_API_URL (LAN). Open port 5000 in firewall too.
 */
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setTimeout } from "node:timers/promises";

const METRO_PORT = process.env.EXPO_METRO_PORT?.trim() || "8081";
const here = dirname(fileURLToPath(import.meta.url));

try {
  execSync(`node "${join(here, "kill-metro.mjs")}"`, { stdio: "inherit", shell: true });
} catch {
  /* best effort */
}
await setTimeout(400);

console.log("[expo] TUNNEL mode (phone loads JS via Expo servers — not your LAN).");
console.log("[expo] Scan the QR in this terminal with Expo Go.");
console.log("[expo] API still uses EXPO_PUBLIC_API_URL — run npm run server:dev in another terminal.");
console.log("[expo] If API calls fail on phone, run as Admin: npm run metro:firewall");
console.log("[expo] LAN-only Metro: npm run start:lan\n");

const child = spawn(
  "npx",
  ["expo", "start", "--go", "--tunnel", "--port", METRO_PORT, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, CI: "1" },
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
