#!/usr/bin/env bash
#
# Records the Mecatl Studio walkthrough and transcodes it to mp4.
#
# Requires the full local stack already running:
#
#     npm run dev          # vinext (3000) + controller (8788) + mecated (8081)
#     npm run demo:record
#
# The recording is only honest if the stack is really wired up, so this checks
# the provider and gateway before spending minutes on a take.
#
#   DEMO_SPEED=3   shorten every pause, to check the path without the real-time wait
#   DEMO_PROMPT=…  override the Act V prompt (it summarizes a REAL meeting)
#   SKIP_CHECKS=1  record anyway, e.g. to capture the offline-mock state on purpose
#
# Narration is recorded separately and muxed in with `npm run demo:voice`.

set -euo pipefail
cd "$(dirname "$0")/.."

BASE_URL="${BASE_URL:-http://localhost:3000}"
CONTROL="${CONTROL:-http://127.0.0.1:8788}"
OUT_DIR="demo-recordings"
RAW_DIR="$OUT_DIR/raw"

if ! curl -sfo /dev/null "$BASE_URL"; then
  echo "No Studio on $BASE_URL — start the stack with \`npm run dev\` first." >&2
  exit 1
fi

if [[ "${SKIP_CHECKS:-}" != "1" ]]; then
  status="$(curl -sf --max-time 5 "$CONTROL/status" || echo '{}')"
  fail=0
  if grep -q '"provider":"offline mock"' <<<"$status"; then
    echo "Provider is 'offline mock' — Act V would record a mock agent loop." >&2
    echo "  Connect OpenRouter via the Provider button first." >&2
    fail=1
  fi
  if grep -q '"gateway":null' <<<"$status"; then
    echo "MCP gateway is not connected — Acts III and V would be empty." >&2
    echo "  Sign in via the MCP Gateway button first." >&2
    fail=1
  fi
  if [[ "$fail" -eq 1 ]]; then
    echo >&2
    echo "Re-run with SKIP_CHECKS=1 to record this state deliberately." >&2
    exit 1
  fi
fi

# Stale videos from a previous run would get collected alongside the new ones.
rm -rf "$RAW_DIR"
mkdir -p "$OUT_DIR"

npx playwright test --config=playwright.demo.config.mts "$@"

echo
echo "Transcoding to mp4…"

shopt -s nullglob
found=0
for webm in "$RAW_DIR"/*/*.webm; do
  found=1
  ffmpeg -nostdin -loglevel error -y -i "$webm" \
    -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p \
    -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -movflags +faststart \
    "$OUT_DIR/mecatl-studio-walkthrough.mp4"
  echo "  → $OUT_DIR/mecatl-studio-walkthrough.mp4"
done

if [[ "$found" -eq 0 ]]; then
  echo "No video produced — check the Playwright output above." >&2
  exit 1
fi

if [[ -f "$OUT_DIR/cues.json" ]]; then
  node scripts/narration-script.mjs
fi

echo
echo "Done. Next: record narration against $OUT_DIR/NARRATION.md, then \`npm run demo:voice <audio>\`."
