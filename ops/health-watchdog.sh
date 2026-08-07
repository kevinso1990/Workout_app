#!/bin/bash
# API health watchdog. Runs from cron every few minutes: checks the public
# /health endpoint; after 2 consecutive failures it auto-restarts the API and
# (optionally) posts to ALERT_WEBHOOK (read from /root/Workout_app/.env).
# Self-healing for hangs/crashes between the daily restarts.
URL="http://127.0.0.1:5000/health"
LOG="/root/backups/health.log"
FAILFILE="/tmp/tyl-health-fails"

ALERT_WEBHOOK=""
if [ -f /root/Workout_app/.env ]; then
  # Expects an unquoted value, e.g. ALERT_WEBHOOK=https://hooks.slack.com/...
  ALERT_WEBHOOK=$(grep -E '^ALERT_WEBHOOK=' /root/Workout_app/.env | head -1 | cut -d= -f2-)
fi

ts=$(date -Iseconds)
code=$(curl -s -m 8 -o /dev/null -w "%{http_code}" "$URL")

if [ "$code" = "200" ]; then
  echo 0 > "$FAILFILE"
  exit 0
fi

fails=$(( $(cat "$FAILFILE" 2>/dev/null || echo 0) + 1 ))
echo "$fails" > "$FAILFILE"
echo "$ts DOWN http=$code fails=$fails" >> "$LOG"

if [ "$fails" -ge 2 ]; then
  echo "$ts RESTART workout-api after $fails consecutive failures" >> "$LOG"
  pm2 restart workout-api >> "$LOG" 2>&1
  echo 0 > "$FAILFILE"
  if [ -n "$ALERT_WEBHOOK" ]; then
    curl -s -m 8 -X POST "$ALERT_WEBHOOK" -H "content-type: application/json" \
      -d "{\"text\":\"TrackYourLift API was down (http=$code) - auto-restarted at $ts\"}" >/dev/null 2>&1
  fi
fi
