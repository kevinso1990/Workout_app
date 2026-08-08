import db from "../db";

/**
 * Persistent AI-usage accounting for cost control. Unlike the in-process
 * rate limiter (per-IP, wiped on restart), this survives restarts and enforces:
 *   - a GLOBAL monthly call cap  → hard cost ceiling / kill-switch
 *   - a per-user (or per-device) DAILY cap → abuse / runaway protection
 *
 * Buckets are keyed by period so the table stays tiny; old rows are pruned.
 */

db.exec(`
  CREATE TABLE IF NOT EXISTS ai_usage (
    bucket TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
`);

const getStmt = db.prepare("SELECT count FROM ai_usage WHERE bucket = ?");
const incStmt = db.prepare(`
  INSERT INTO ai_usage (bucket, count, updated_at) VALUES (?, 1, ?)
  ON CONFLICT(bucket) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at
`);

export function getCount(bucket: string): number {
  const row = getStmt.get(bucket) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function increment(bucket: string): void {
  incStmt.run(bucket, Date.now());
}

/** Drop usage rows untouched for >45 days so the table can't grow unbounded. */
export function pruneOldUsage(): void {
  const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
  db.prepare("DELETE FROM ai_usage WHERE updated_at < ?").run(cutoff);
}
