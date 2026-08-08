import type { Request, Response, NextFunction } from "express";
import { getCount, increment, pruneOldUsage } from "../services/aiUsageService";

/**
 * Cost/abuse guard for AI endpoints. Enforces a global monthly call cap (the
 * hard cost ceiling) and a per-user/device daily cap, both persisted so they
 * survive restarts. Increments on entry (counts attempts) — conservative for
 * cost. Configure via env:
 *   AI_MONTHLY_CALL_CAP  (default 10000) — global kill-switch
 *   AI_USER_DAILY_CAP    (default 40)    — per identity per day, all AI combined
 */
const GLOBAL_MONTHLY_CAP = parseInt(process.env.AI_MONTHLY_CALL_CAP || "10000", 10);
const USER_DAILY_CAP = parseInt(process.env.AI_USER_DAILY_CAP || "40", 10);

function identity(req: Request): string {
  const sub = req.user?.sub;
  if (sub) return `user:${sub}`;
  const ip = (req.ip || req.socket?.remoteAddress || "unknown").trim();
  return `ip:${ip}`;
}

export function aiUsageGuard(req: Request, res: Response, next: NextFunction): void {
  const now = new Date();
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const globalKey = `global:${month}`;
  const userKey = `${identity(req)}:${day}`;

  if (getCount(globalKey) >= GLOBAL_MONTHLY_CAP) {
    // Global budget spent — protect the API bill. Clients already handle this
    // gracefully (fallback template / error toast).
    res.status(503).json({ error: "AI temporarily unavailable — monthly limit reached" });
    return;
  }

  if (getCount(userKey) >= USER_DAILY_CAP) {
    res.setHeader("Retry-After", 3600);
    res.status(429).json({ error: "Daily AI limit reached — please try again tomorrow" });
    return;
  }

  increment(globalKey);
  increment(userKey);

  // Opportunistic cleanup (~1% of calls) so old buckets don't accumulate.
  if (Math.random() < 0.01) {
    try {
      pruneOldUsage();
    } catch {
      /* non-critical */
    }
  }

  next();
}
