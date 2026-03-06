import db from "../db";

const DEFAULT_THRESHOLD_WEEKS = 4;

interface SplitAge {
  planId: number;
  planName: string;
  weeksOnPlan: number;
  shouldPrompt: boolean;
}

export function getSplitAge(deviceId: string, thresholdWeeks = DEFAULT_THRESHOLD_WEEKS): SplitAge | null {
  // Find the plan the user has used most in the last 8 weeks
  const row = db
    .prepare(
      `SELECT s.plan_id, p.name as plan_name,
              MIN(s.started_at) as first_session, MAX(s.started_at) as last_session,
              COUNT(*) as session_count
       FROM sessions s
       JOIN plans p ON p.id = s.plan_id
       WHERE s.started_at >= datetime('now', '-56 days')
         AND s.finished_at IS NOT NULL
       GROUP BY s.plan_id
       ORDER BY session_count DESC, last_session DESC
       LIMIT 1`,
    )
    .get() as
    | { plan_id: number; plan_name: string; first_session: string; last_session: string; session_count: number }
    | undefined;

  if (!row) return null;

  const firstMs = new Date(row.first_session).getTime();
  const lastMs = new Date(row.last_session).getTime();
  const weeksOnPlan = Math.floor((lastMs - firstMs) / (7 * 24 * 60 * 60 * 1000));

  // Check snooze
  const snooze = db
    .prepare("SELECT snoozed_until FROM split_refresh_snooze WHERE device_id = ?")
    .get(deviceId) as { snoozed_until: string } | undefined;
  const isSnoozed = snooze && new Date(snooze.snoozed_until) > new Date();

  return {
    planId: row.plan_id,
    planName: row.plan_name,
    weeksOnPlan,
    shouldPrompt: weeksOnPlan >= thresholdWeeks && !isSnoozed,
  };
}

export function snooze(deviceId: string, weeks = 1): void {
  const until = new Date();
  until.setDate(until.getDate() + weeks * 7);
  db.prepare(
    `INSERT INTO split_refresh_snooze (device_id, snoozed_until)
     VALUES (?, ?)
     ON CONFLICT(device_id) DO UPDATE SET snoozed_until = excluded.snoozed_until`,
  ).run(deviceId, until.toISOString());
}
