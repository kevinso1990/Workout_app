# Ops scripts (VPS: root@187.77.89.8, /root/Workout_app)

Operational scripts that run on the production VPS via cron. Kept here so they
survive even if the box is lost. Deploy by copying to the VPS and adding cron.

## backup-db.js
Daily consistent SQLite backup (`VACUUM INTO`, WAL-safe), gzipped, 14-day
rotation into `/root/backups`. Calls `offsite-upload.sh` if present.

- **On VPS:** `/root/Workout_app/scripts/backup-db.js`
- **Cron:** `30 3 * * * cd /root/Workout_app && /usr/bin/node scripts/backup-db.js >> /root/backups/backup.log 2>&1`
- **Restore:** `gunzip -c /root/backups/workout-<ts>.db.gz > /root/Workout_app/workout.db && pm2 restart workout-api`

## health-watchdog.sh
Every 3 min: checks `http://127.0.0.1:5000/health`; after 2 consecutive
failures auto-restarts `workout-api` and (optionally) posts to `ALERT_WEBHOOK`
(read from `/root/Workout_app/.env`). Logs to `/root/backups/health.log`.

- **On VPS:** `/root/Workout_app/scripts/health-watchdog.sh`
- **Cron:** `*/3 * * * * /root/Workout_app/scripts/health-watchdog.sh`
- **Enable alerts:** add `ALERT_WEBHOOK=https://…` (Slack/Discord webhook) to `/root/Workout_app/.env`

## offsite-upload.sh.template
Template for pushing each backup to remote storage (rclone / S3 / scp / B2).
Fill in one method, save as `/root/backups/offsite-upload.sh`, `chmod +x`.
Until then backups are local-only (same box) — a full-disk failure loses them.

## Sentry (crash/error reporting)
Wired in code, **DSN-gated** (no-op until configured):
- **Server:** set `SENTRY_DSN=…` in `/root/Workout_app/.env`, restart. (`server/lib/sentry.ts`)
- **Client:** set `EXPO_PUBLIC_SENTRY_DSN=…` and ship a new native build (the
  native module links at build time). (`client/lib/sentry.ts`)
