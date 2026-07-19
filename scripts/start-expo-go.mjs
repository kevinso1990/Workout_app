/**
 * Start Metro for Expo Go on LAN (physical iPhone).
 * Usage: node scripts/start-expo-go.mjs [--clear]
 */
import { networkInterfaces } from "node:os";
import { spawn, execSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const METRO_PORT = process.env.EXPO_METRO_PORT?.trim() || "8081";

function pickLanIPv4() {
  const nets = networkInterfaces();
  const candidates = [];

  for (const entries of Object.values(nets)) {
    for (const net of entries ?? []) {
      if (net.family !== "IPv4" || net.internal) continue;
      const ip = net.address;
      if (ip.startsWith("169.254.")) continue;
      candidates.push(ip);
    }
  }

  const preferred = candidates.find((ip) => ip.startsWith("192.168."));
  return preferred ?? candidates[0] ?? "127.0.0.1";
}

function pidsListeningOnPort(port) {
  if (process.platform === "win32") {
    try {
      const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split("\n")) {
        const upper = line.toUpperCase();
        if (!upper.includes("LISTENING") && !upper.includes("ABH")) continue;
        if (!new RegExp(`:${port}(\\s|$)`).test(line)) continue;
        const pid = parseInt(line.trim().split(/\s+/).pop() ?? "", 10);
        if (pid > 0 && pid !== process.pid) pids.add(pid);
      }
      return [...pids];
    } catch {
      return [];
    }
  }
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
    return out
      .trim()
      .split(/\s+/)
      .map((n) => parseInt(n, 10))
      .filter((n) => n > 0 && n !== process.pid);
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (process.platform === "win32") {
    execSync(`taskkill /PID ${pid} /F`, { stdio: "pipe" });
  } else {
    execSync(`kill -9 ${pid}`, { stdio: "pipe" });
  }
}

async function freePort(port) {
  const pids = pidsListeningOnPort(port);
  if (pids.length === 0) return;

  console.log(
    `[expo] Port ${port} busy — stopping old Metro (PID ${pids.join(", ")})...`,
  );
  for (const pid of pids) {
    try {
      killPid(pid);
    } catch {
      console.warn(`[expo] Could not stop PID ${pid} — close that terminal or run: npm run kill:metro`);
    }
  }
  await setTimeout(600);
}

const lanHost =
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME?.trim() || pickLanIPv4();

// Always free 8081 (and stale 8082 from earlier Expo prompts).
await freePort(METRO_PORT);
if (METRO_PORT === "8081") await freePort("8082");

const extraArgs = process.argv.slice(2);
const expoArgs = [
  "expo",
  "start",
  "--go",
  "--lan",
  "--port",
  METRO_PORT,
  ...extraArgs,
];

const expUrl = `exp://${lanHost}:${METRO_PORT}`;

console.log(`[expo] Metro port: ${METRO_PORT}`);
console.log(`[expo] LAN host:   ${lanHost}`);
console.log(`[expo] Connect: Expo Go → Scan QR  OR  Enter URL → ${expUrl}`);
console.log(`[expo] Settings → Expo Go → Local Network → ON`);
console.log(`[expo] If Safari cannot reach /status on your phone, use: npm start (tunnel)\n`);

const child = spawn("npx", expoArgs, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    EXPO_OFFLINE: "1",
    REACT_NATIVE_PACKAGER_HOSTNAME: lanHost,
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
