#!/usr/bin/env bash
#
# Muxes a recorded human narration track onto the silent walkthrough video.
#
#     npm run demo:voice ~/Desktop/narration.m4a
#
# Playwright records video only, so the voice-over is performed separately —
# against demo-recordings/NARRATION.md, which carries the real beat timings — and
# joined here. The video is copied, not re-encoded, so this is fast and lossless;
# only the audio is transcoded to AAC for QuickTime/Slack/Keynote.
#
# Takes any audio ffmpeg can read (m4a, wav, mp3, aiff). If the narration is
# shorter than the video the tail is silent; if longer it is cut at the video's
# end (-shortest), so start the take on the first frame.

set -euo pipefail
cd "$(dirname "$0")/.."

AUDIO="${1:-}"
VIDEO="${VIDEO:-demo-recordings/mecatl-studio-walkthrough.mp4}"
OUT="${OUT:-demo-recordings/mecatl-studio-walkthrough-narrated.mp4}"

if [[ -z "$AUDIO" ]]; then
  echo "usage: npm run demo:voice <narration-audio-file>" >&2
  exit 1
fi
if [[ ! -f "$AUDIO" ]]; then
  echo "No such audio file: $AUDIO" >&2
  exit 1
fi
if [[ ! -f "$VIDEO" ]]; then
  echo "No recording at $VIDEO — run \`npm run demo:record\` first." >&2
  exit 1
fi

vlen=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
alen=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$AUDIO")
printf 'video %.1fs · narration %.1fs\n' "$vlen" "$alen"
awk -v v="$vlen" -v a="$alen" 'BEGIN{ d=a-v; if (d>5) printf "  note: narration is %.0fs longer than the video; the tail will be cut.\n", d; else if (d<-5) printf "  note: narration is %.0fs shorter; the tail will be silent.\n", -d }'

ffmpeg -nostdin -loglevel error -y -i "$VIDEO" -i "$AUDIO" \
  -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 192k \
  -movflags +faststart -shortest \
  "$OUT"

echo "  → $OUT"
