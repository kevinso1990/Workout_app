#!/usr/bin/env bash
# Import benchmark: renders six realistic plans (trainer PDF, 3-week kurz/lang
# rotation, hand-written photo, Excel, physio sheet, Insta screenshot), sends
# them through a LOCAL server's /api/import-workout and scores the result
# against the ground truth in plans.py. Never runs against production.
#
#   ops/import-benchmark/bench.sh [runs] [gemini-model-chain]
#
# Needs: Google Chrome (rendering), python3 with Pillow + openpyxl, .env with
# GEMINI_API_KEY. Uses a copy of workout.db so nothing local is touched.
set -u
RUNS=${1:-2}
CHAIN=${2:-gemini-flash-latest,gemini-flash-lite-latest}
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
WORK=$(mktemp -d)
cd "$ROOT"
cp workout.db "$WORK/test.db"
python3 "$HERE/render.py" "$WORK/files" > /dev/null
set -a; . ./.env; set +a
PORT=5055 DB_PATH="$WORK/test.db" GEMINI_MODEL_CHAIN="$CHAIN" AI_USER_DAILY_CAP=100000 NODE_ENV=development \
  npx tsx server/index.ts > "$WORK/server.log" 2>&1 &
PID=$!
for _ in $(seq 1 40); do grep -q "Server running" "$WORK/server.log" 2>/dev/null && break; sleep 1; done
for n in $(seq 1 "$RUNS"); do
  python3 "$HERE/run.py" "$WORK/files" "$WORK/res-$n" > /dev/null
  echo "== Lauf $n"
  (cd "$HERE" && python3 score.py "$WORK/res-$n")
done
echo "Wiederholte Lesungen (dünnes Ergebnis): $(grep -c 'looks incomplete' "$WORK/server.log")"
echo "Dateien und Log: $WORK"
kill "$PID" 2>/dev/null
