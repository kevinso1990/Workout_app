import express from "express";
import { rateLimit } from "../middleware/rateLimiter";
import db from "../db";

const router = express.Router();

/**
 * Anonymous product events — only these names, no user id, no plan or
 * exercise content. They feed the STRATEGY.md metrics (services/productMetrics).
 */
export const EVENT_NAMES = new Set([
  "first_open",
  "first_set_logged",
  "workout_completed",
  "import_succeeded",
  "import_failed",
  "ai_plan_adjusted",
  "pro_purchased",
]);

const MAX_BATCH = 50;
const eventsLimiter = rateLimit(60, 60 * 1000);
const ANON_ID = /^[a-z0-9-]{8,64}$/i;

function cleanProps(props: unknown): string | null {
  if (!props || typeof props !== "object" || Array.isArray(props)) return null;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props).slice(0, 10)) {
    if (typeof v === "number" || typeof v === "boolean") out[k.slice(0, 32)] = v;
    else if (typeof v === "string") out[k.slice(0, 32)] = v.slice(0, 40);
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

router.post("/events", eventsLimiter, (req, res) => {
  const { anonId, platform, appVersion, events } = req.body ?? {};
  if (typeof anonId !== "string" || !ANON_ID.test(anonId) || !Array.isArray(events)) {
    return res.status(400).json({ error: "Invalid payload" });
  }
  const insert = db.prepare(
    "INSERT INTO events (anon_id, name, props, client_ts, platform, app_version) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const rows = events.slice(0, MAX_BATCH).filter(
    (e: unknown): e is { name: string; ts: string; props?: unknown } =>
      !!e &&
      typeof (e as { name?: unknown }).name === "string" &&
      EVENT_NAMES.has((e as { name: string }).name) &&
      typeof (e as { ts?: unknown }).ts === "string" &&
      Number.isFinite(Date.parse((e as { ts: string }).ts)),
  );
  db.transaction(() => {
    for (const e of rows) {
      insert.run(
        anonId,
        e.name,
        cleanProps(e.props),
        e.ts,
        typeof platform === "string" ? platform.slice(0, 10) : null,
        typeof appVersion === "string" ? appVersion.slice(0, 20) : null,
      );
    }
  })();
  return res.status(204).end();
});

export default router;
