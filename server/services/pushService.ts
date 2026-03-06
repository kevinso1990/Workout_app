// @ts-ignore – no type declarations for web-push
import webpush from "web-push";
import db from "../db";
import { AppError } from "../middleware/errorHandler";
import type { SubscribePushBody, PushSubscriptionRow } from "../models";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:workoutapp@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
}

// ── Public service functions ─────────────────────────────────────────────────

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export function subscribe(body: SubscribePushBody): void {
  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new AppError(400, "endpoint and keys (p256dh, auth) required");
  }
  db.prepare(
    "INSERT OR REPLACE INTO push_subscriptions (endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?)",
  ).run(endpoint, keys.p256dh, keys.auth);
}

export function unsubscribe(endpoint: string): void {
  if (!endpoint) throw new AppError(400, "endpoint required");
  db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function wasNotificationSentToday(type: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return !!db
    .prepare(
      "SELECT id FROM notification_log WHERE notification_type = ? AND sent_date = ?",
    )
    .get(type, today);
}

function markNotificationSent(type: string): void {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    "INSERT OR IGNORE INTO notification_log (notification_type, sent_date) VALUES (?, ?)",
  ).run(type, today);
}

function sendPushToAll(payload: string): void {
  const subscriptions = db
    .prepare("SELECT * FROM push_subscriptions")
    .all() as PushSubscriptionRow[];

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
    };
    (webpush.sendNotification(pushSubscription, payload) as Promise<void>).catch(
      (err: { statusCode?: number }) => {
        // Remove stale subscriptions (gone / unsubscribed)
        if (err.statusCode === 410 || err.statusCode === 404) {
          db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(sub.endpoint);
        }
      },
    );
  }
}

// ── Schedulers ───────────────────────────────────────────────────────────────

function checkInactivity(): void {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const lastSession = db
      .prepare(
        "SELECT finished_at FROM sessions WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1",
      )
      .get() as { finished_at: string } | undefined;

    if (!lastSession) return;

    const daysSince =
      (Date.now() - new Date(lastSession.finished_at).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince >= 3 && !wasNotificationSentToday("inactivity")) {
      markNotificationSent("inactivity");
      sendPushToAll(
        JSON.stringify({
          title: "Time to Train!",
          body: `It's been ${Math.floor(daysSince)} days since your last workout. Ready to get back at it?`,
          url: "/",
        }),
      );
    }
  } catch (err) {
    console.error("Inactivity notification error:", err);
  }
}

function checkWeeklySummary(): void {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  try {
    const now = new Date();
    // Run on Sundays at 9 am
    if (now.getDay() !== 0 || now.getHours() !== 9) return;
    if (wasNotificationSentToday("weekly_summary")) return;

    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const sessionCount = (
      db
        .prepare(
          "SELECT COUNT(*) as count FROM sessions WHERE finished_at IS NOT NULL AND finished_at >= ?",
        )
        .get(weekAgo) as { count: number }
    ).count;

    const volumeRow = db
      .prepare(
        `SELECT SUM(st.weight * st.reps) as totalVolume
         FROM sets st
         JOIN sessions s ON s.id = st.session_id
         WHERE s.finished_at IS NOT NULL AND s.finished_at >= ?`,
      )
      .get(weekAgo) as { totalVolume: number | null };

    const totalVolume = Math.round(volumeRow.totalVolume ?? 0);

    markNotificationSent("weekly_summary");
    sendPushToAll(
      JSON.stringify({
        title: "Weekly Summary",
        body: `This week: ${sessionCount} workout${sessionCount !== 1 ? "s" : ""}, ${totalVolume.toLocaleString()} kg total volume. Keep it up!`,
        url: "/progress",
      }),
    );
  } catch (err) {
    console.error("Weekly summary notification error:", err);
  }
}

/**
 * Starts background notification schedulers. Call once at server startup.
 */
export function startPushScheduler(): void {
  setInterval(checkInactivity, 6 * 60 * 60 * 1000);  // every 6 hours
  setInterval(checkWeeklySummary, 60 * 60 * 1000);    // every 1 hour
}
