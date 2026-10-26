#!/usr/bin/env bash
# Deploy individual server source files to the VPS and rebuild.
#
# The VPS checkout (/root/Workout_app) is a divergent snapshot with local
# changes, so `git pull` there is unsafe. This copies only the named files,
# rebuilds dist/, restarts pm2, and rolls back to the previous dist if the
# health check fails.
#
#   ops/deploy-server-files.sh server/services/coachService.ts server/routes/coach.ts
set -euo pipefail
HOST=root@187.77.89.8
APP=/root/Workout_app
[ $# -gt 0 ] || { echo "usage: $0 <repo-relative files...>"; exit 1; }
cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M%S)
ssh "$HOST" "cp $APP/server/dist/index.js $APP/server/dist/index.js.bak-$STAMP"
for f in "$@"; do
  ssh "$HOST" "cp $APP/$f $APP/$f.bak-$STAMP 2>/dev/null || true"
  scp -q "$f" "$HOST:$APP/$f"
  echo "copied $f"
done
ssh "$HOST" "cd $APP/server && npm run build --silent && pm2 restart workout-api >/dev/null && sleep 4 && curl -sf -m 5 localhost:5000/health >/dev/null" \
  && echo "deployed, health OK" \
  || { echo "health check failed - rolling back"; ssh "$HOST" "cp $APP/server/dist/index.js.bak-$STAMP $APP/server/dist/index.js && pm2 restart workout-api"; exit 1; }
