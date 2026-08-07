#!/usr/bin/env node
/* Daily consistent backup of workout.db (WAL-safe via VACUUM INTO), gzipped,
   with 14-day rotation. Run by cron. Optionally pushes each backup off-site
   when /root/backups/offsite-upload.sh exists (see offsite-upload.sh.template). */
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const DB = "/root/Workout_app/workout.db";
const DIR = "/root/backups";
const KEEP_DAYS = 14;

fs.mkdirSync(DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const out = path.join(DIR, `workout-${stamp}.db`);

const db = new Database(DB);
db.exec(`VACUUM INTO '${out}'`);
db.close();
execSync(`gzip -f "${out}"`);
const gz = out + ".gz";
const size = fs.statSync(gz).size;
console.log(`[backup] ${gz} (${size} bytes)`);

// Optional off-site copy. Create an executable /root/backups/offsite-upload.sh
// that pushes its first argument (the .gz path) to remote storage — the whole
// local box can then die without losing the data. See the .template file.
const hook = "/root/backups/offsite-upload.sh";
if (fs.existsSync(hook)) {
  try {
    execSync(`bash "${hook}" "${gz}"`, { stdio: "inherit" });
    console.log("[backup] off-site upload hook completed");
  } catch (e) {
    console.error("[backup] off-site upload hook FAILED:", e.message);
  }
}

// Rotation.
const cutoff = Date.now() - KEEP_DAYS * 86400000;
let pruned = 0;
for (const f of fs.readdirSync(DIR)) {
  if (!f.startsWith("workout-")) continue;
  const p = path.join(DIR, f);
  if (fs.statSync(p).mtimeMs < cutoff) { fs.unlinkSync(p); pruned++; }
}
if (pruned) console.log(`[backup] pruned ${pruned} old`);
