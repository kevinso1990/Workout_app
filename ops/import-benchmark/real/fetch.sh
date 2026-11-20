#!/usr/bin/env bash
# Downloads the public plans from sources.txt into <dir> (outside the repo).
#   ops/import-benchmark/real/fetch.sh ~/import-bench-pdfs
set -eu
DIR=$1; mkdir -p "$DIR"
grep -v '^#' "$(dirname "$0")/sources.txt" | while read -r name url; do
  [ -n "$name" ] && [ ! -f "$DIR/$name" ] && curl -sfL -o "$DIR/$name" "$url" && echo "$name"
done
