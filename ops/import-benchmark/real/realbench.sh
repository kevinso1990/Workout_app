#!/usr/bin/env bash
# Real-plan benchmark: public trainer PDFs (sources.txt) through a LOCAL
# server's /api/import-workout, scored against the hand-read ground truth in
# real_plans.py. Never runs against production.
#
#   ops/import-benchmark/real/realbench.sh <pdf-dir> [plan ids...]
#   PDF_ONLY=1 ...   skips the simulated phone photos
#
# <pdf-dir> must stay outside the repo (copyright); fetch it with fetch.sh.
set -u
PDFS=$(cd "$1" && pwd); shift
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
WORK=$(mktemp -d)
swiftc -O "$HERE/pdf2png.swift" -o "$WORK/pdf2png" 2>/dev/null || { echo "swiftc fehlt"; exit 1; }
cd "$ROOT"
cp workout.db "$WORK/test.db"
set -a; . ./.env; set +a
PORT=5055 DB_PATH="$WORK/test.db" GEMINI_MODEL_CHAIN=gemini-flash-latest,gemini-flash-lite-latest AI_USER_DAILY_CAP=100000 NODE_ENV=development \
  npx tsx server/index.ts > "$WORK/server.log" 2>&1 &
PID=$!
for _ in $(seq 1 40); do grep -q "Server running" "$WORK/server.log" 2>/dev/null && break; sleep 1; done
PDF2PNG="$WORK/pdf2png" python3 "$HERE/realrun.py" "$PDFS" "$WORK/res" "$@" > /dev/null
kill "$PID" 2>/dev/null
(cd "$HERE" && python3 realscore.py "$WORK/res")
echo "Wiederholte Lesungen (dünnes Ergebnis): $(grep -c 'looks incomplete' "$WORK/server.log")"
echo "Dateien und Log: $WORK"
