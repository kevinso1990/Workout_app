import type { Request, Response, NextFunction } from "express";

interface Window {
  count: number;
  resetAt: number;
}

function clientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0] ?? req.socket?.remoteAddress ?? "unknown";
  return raw.trim();
}

/**
 * Lightweight sliding-window rate limiter (in-process, resets on restart).
 * Each call returns a NEW middleware with its OWN isolated store — rate limits
 * for different routes cannot bleed into each other.
 *
 * Suitable for a single-process SQLite/Express MVP.
 *
 * Usage:
 *   router.post("/login",         rateLimit(10, 60_000), controller.login);
 *   router.post("/auto-generate", rateLimit(5,  60_000), controller.autoGenerate);
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  // Each invocation of rateLimit() owns its own private store so limits are
  // fully isolated — no cross-route counting pollution.
  const store = new Map<string, Window>();

  // Prune expired entries once per window to prevent unbounded growth.
  // Cast through NodeJS.Timeout to access .unref() (don't hold the event loop open).
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, w] of store) {
      if (now >= w.resetAt) store.delete(key);
    }
  }, windowMs) as unknown as NodeJS.Timeout;
  pruneInterval.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = clientKey(req);
    const now = Date.now();
    const existing = store.get(key);

    if (!existing || now >= existing.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > maxRequests) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({ error: "Too many requests — please try again later" });
      return;
    }

    next();
  };
}
