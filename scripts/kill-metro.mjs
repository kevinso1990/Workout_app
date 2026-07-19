/**
 * Free Metro ports (8081/8082) by stopping listeners. Safe to run before npm start.
 */
import { execSync } from "node:child_process";

const PORTS = (process.env.EXPO_METRO_PORTS ?? "8081,8082")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

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

let killed = 0;
for (const port of PORTS) {
  for (const pid of pidsListeningOnPort(port)) {
    try {
      killPid(pid);
      console.log(`[metro] Stopped PID ${pid} on port ${port}`);
      killed++;
    } catch {
      console.warn(`[metro] Could not stop PID ${pid} on port ${port}`);
    }
  }
}

if (killed === 0) {
  console.log(`[metro] Ports ${PORTS.join(", ")} are free.`);
}
