import type { Request, Response, NextFunction } from "express";

interface Window {
  count: number;
  resetAt: number;
}

// In-process sliding-window store — acceptable for a single-process MVP server.
const store = new Map<string, Window>();

// Prune stale entries periodically so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [key, w] of store) {
    if (now >= w.resetAt) store.delete(key);
  }
}, 60_000);

function clientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(",")[0] ?? req.socket?.remoteAddress ?? "unknown";
  return raw.trim();
}

/**
 * Lightweight rate limiter: max `maxRequests` per `windowMs` per IP.
 *
 * Usage:
 *   router.post("/login", rateLimit(10, 60_000), controller.login);
 */
export function rateLimit(maxRequests: number, windowMs: number) {
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
