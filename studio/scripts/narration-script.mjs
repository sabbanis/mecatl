/**
 * Turns the recording's caption cue sheet into a timed narration script.
 *
 * Playwright records silent video, so the voice-over is performed by a person
 * against the finished cut. What makes that workable is knowing exactly when
 * each beat lands and how many seconds it holds — a line that runs longer than
 * its beat is the main way a voice-over drifts out of sync.
 *
 * Words-per-beat assumes a relaxed narration pace of ~2.6 words/second; the
 * budget is advisory, not a limit.
 */

import { readFile, writeFile } from "node:fs/promises";

const WORDS_PER_SECOND = 2.6;
const IN = "demo-recordings/cues.json";
const OUT = "demo-recordings/NARRATION.md";

const clock = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const { cues, total } = JSON.parse(await readFile(IN, "utf8"));

const lines = [
  "# Mecatl Studio walkthrough — narration script",
  "",
  `Recorded cut: **${clock(total)}** · ${cues.length} beats.`,
  "",
  "Read each line during its window. The **budget** is roughly how many words fit",
  "at a relaxed pace — going long is the usual way a voice-over drifts out of sync.",
  "The on-screen caption is shown so you can see what the viewer is reading.",
  "",
  "Record to a single continuous take, start it on the first frame, then:",
  "",
  "```bash",
  "npm run demo:voice ~/path/to/narration.m4a",
  "```",
  "",
  "| # | in | hold | budget | on screen | narration |",
  "|--:|:--|--:|--:|:--|:--|",
];

cues.forEach((c, i) => {
  const end = i + 1 < cues.length ? cues[i + 1].t : total;
  const hold = Math.max(0, end - c.t);
  const budget = Math.round(hold * WORDS_PER_SECOND);
  lines.push(
    `| ${i + 1} | \`${clock(c.t)}\` | ${hold.toFixed(1)}s | ~${budget}w | ${c.text} | _write here_ |`,
  );
});

lines.push(
  "",
  "## Notes",
  "",
  "- Act V is a live agent turn, so its length varies between takes. Re-run this",
  "  script after any re-record — the timings shift.",
  "- If a line needs more room, lengthen the matching `beat()` in",
  "  `tests/demo/mecatl-studio.demo.ts` and re-record rather than rushing the read.",
  "",
);

await writeFile(OUT, lines.join("\n"));
console.log(`  narration script → ${OUT} (${cues.length} beats, ${clock(total)})`);
