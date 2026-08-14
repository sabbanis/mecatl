/**
 * Shared machinery for the Mecatl Studio demo recording.
 *
 * Adapted from the Stacklok Enterprise prototype's demo harness. These are not
 * tests — they are scripted walkthroughs Playwright records to video. They live
 * outside the `node --test` suite entirely and only run via `npm run demo:record`.
 *
 * Two affordances make raw Playwright capture watchable, since the video shows
 * neither a mouse cursor nor any sense of where you are in the story:
 *
 *   - `installCursor` draws a synthetic pointer that tracks the virtual mouse
 *     and ripples on click.
 *   - `say` pins a caption naming the current beat, which doubles as a chapter
 *     list when someone scrubs the video.
 *
 * Unlike the enterprise prototype there is no sign-in and no console switch:
 * Studio is a local single-surface app. What replaces them is `openPanel`
 * (the top-bar dialogs) and `runTurn` (a real agent turn against real models).
 */

import type { Locator, Page } from "@playwright/test";

/** Recording frame. 16:9, wide enough that the top-bar labels stay visible. */
export const VIEWPORT = { width: 1600, height: 900 };

export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

/** Scale every pause, so `DEMO_SPEED=3` checks the path without the real-time wait. */
const SPEED = Number(process.env.DEMO_SPEED || "1") || 1;

export function ms(base: number): number {
  return Math.max(50, Math.round(base / SPEED));
}

/** Hold the frame so a viewer can read what just changed. */
export async function beat(page: Page, duration = 1600): Promise<void> {
  await page.waitForTimeout(ms(duration));
}

// ─── Cursor overlay ──────────────────────────────────────────────────────────

/** Registers the synthetic cursor. Must be called before the first navigation. */
export async function installCursor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const attach = () => {
      if (document.getElementById("__demo_cursor")) return;
      const dot = document.createElement("div");
      dot.id = "__demo_cursor";
      dot.style.cssText = [
        "position:fixed", "top:0", "left:0", "width:22px", "height:22px",
        "margin:-11px 0 0 -11px", "border-radius:50%",
        "border:2px solid rgba(255,255,255,.95)",
        "background:rgba(31,122,72,.55)",
        "box-shadow:0 0 0 1px rgba(0,0,0,.35), 0 2px 10px rgba(0,0,0,.35)",
        "pointer-events:none", "z-index:2147483647",
        "transition:transform .05s linear", "opacity:0",
      ].join(";");
      document.body.appendChild(dot);

      let shown = false;
      addEventListener("mousemove", (e) => {
        if (!shown) { dot.style.opacity = "1"; shown = true; }
        dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }, true);

      addEventListener("mousedown", (e) => {
        const r = document.createElement("div");
        r.style.cssText = [
          "position:fixed", `left:${e.clientX}px`, `top:${e.clientY}px`,
          "width:14px", "height:14px", "margin:-7px 0 0 -7px",
          "border-radius:50%", "border:2px solid rgba(31,122,72,.9)",
          "pointer-events:none", "z-index:2147483646",
        ].join(";");
        document.body.appendChild(r);
        r.animate(
          [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(4)", opacity: 0 }],
          { duration: 450, easing: "ease-out" },
        ).onfinish = () => r.remove();
      }, true);
    };
    if (document.body) attach();
    else addEventListener("DOMContentLoaded", attach, { once: true });
  });
}

// ─── Caption ─────────────────────────────────────────────────────────────────

async function paintCaption(page: Page, text: string): Promise<void> {
  await page.evaluate((label) => {
    let el = document.getElementById("__demo_caption");
    if (!label) { el?.remove(); return; }
    if (!el) {
      el = document.createElement("div");
      el.id = "__demo_caption";
      el.style.cssText = [
        "position:fixed", "left:50%", "bottom:28px", "transform:translateX(-50%)",
        "max-width:80vw", "padding:10px 20px", "border-radius:9999px",
        "font:600 15px/1.35 ui-sans-serif,system-ui,-apple-system,sans-serif",
        "color:#fff", "background:rgba(17,17,23,.92)",
        "box-shadow:0 8px 30px rgba(0,0,0,.45)", "backdrop-filter:blur(6px)",
        "pointer-events:none", "z-index:2147483645", "text-align:center",
      ].join(";");
      document.body.appendChild(el);
    }
    el.textContent = label;
  }, text);
}

let lastChapter = "";

// ─── Cue sheet ───────────────────────────────────────────────────────────────
//
// Playwright records silent video, so narration is recorded separately and muxed
// in afterwards. To make that practical, every caption is stamped with the
// elapsed time at which it appeared; `writeCues` dumps them as a timed script a
// person can actually read along to.

let clockStart = 0;
const cues: Array<{ t: number; text: string }> = [];

export function startClock(): void {
  clockStart = Date.now();
  cues.length = 0;
}

function stamp(text: string): void {
  if (!clockStart || !text) return;
  cues.push({ t: (Date.now() - clockStart) / 1000, text });
}

/** Write the caption cue sheet next to the recording. */
export async function writeCues(file = "demo-recordings/cues.json"): Promise<void> {
  const { writeFile, mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ cues, total: (Date.now() - clockStart) / 1000 }, null, 2));
  console.log(`\n  cue sheet → ${file} (${cues.length} cues)`);
}

/** Set the caption naming the current beat. */
export async function say(page: Page, label: string): Promise<void> {
  stamp(label);
  lastChapter = label;
  try {
    await paintCaption(page, label);
  } catch {
    // A caption is decoration — never fail a recording over it.
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await paintCaption(page, label).catch(() => {});
  }
}

export async function go(page: Page, path = "/", label?: string): Promise<void> {
  if (label !== undefined) lastChapter = label;
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
  // Studio hydrates before it is interactive; the first click is swallowed
  // otherwise (observed while building this recording).
  await page.waitForTimeout(ms(1800));
  if (lastChapter) await say(page, lastChapter);
}

// ─── Interaction ─────────────────────────────────────────────────────────────

/** Hover, pause, then click — an instant click reads as the page changing itself. */
export async function click(target: Locator, opts: { settle?: number } = {}): Promise<void> {
  const page = target.page();
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.hover().catch(() => {});
  await page.waitForTimeout(ms(420));
  await target.click();
  await page.waitForTimeout(ms(opts.settle ?? 1100));
}

export async function clickIfPresent(target: Locator, what: string): Promise<boolean> {
  const first = target.first();
  try {
    await first.waitFor({ state: "visible", timeout: 8000 });
  } catch {
    console.log(`  ⤵ skipped (not found): ${what}`);
    return false;
  }
  await click(first);
  return true;
}

/** Scroll in steps so a long panel reads as a pan, not a jump. */
export async function pan(page: Page, distance = 500, steps = 7): Promise<void> {
  const per = Math.round(distance / steps);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, per);
    await page.waitForTimeout(ms(140));
  }
  await page.waitForTimeout(ms(700));
}

/** Scroll inside a scrollable element (the skills list) rather than the window. */
export async function panWithin(page: Page, selector: string, distance = 300): Promise<void> {
  const box = await page.locator(selector).first().boundingBox().catch(() => null);
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, Math.round(distance / steps));
    await page.waitForTimeout(ms(160));
  }
  await page.waitForTimeout(ms(700));
}

// ─── Studio-specific ─────────────────────────────────────────────────────────

/** Open one of the top-bar dialogs by its visible label. */
export async function openPanel(
  page: Page,
  name: "Provider" | "Model Router" | "MCP Gateway" | "Skills",
): Promise<boolean> {
  // The top-bar buttons carry no aria-label — their accessible name is the glyph
  // concatenated with the label ("⇄Model Router"), so match on class + text.
  const opened = await clickIfPresent(
    page.locator("button.topbar-button").filter({ hasText: name }),
    `${name} panel`,
  );
  if (opened) await beat(page, 900);
  return opened;
}

export async function closePanel(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => {});
  await clickIfPresent(page.getByRole("button", { name: /^Close$/ }), "close");
  await beat(page, 700);
}

/**
 * Type a prompt at a human cadence and submit it. Typing character by character
 * matters here: the composer is the one place a viewer should believe a person
 * is driving.
 */
export async function typePrompt(page: Page, text: string): Promise<void> {
  const box = page.getByRole("textbox", { name: /Task prompt/i });
  await click(box, { settle: 300 });
  // pressSequentially, not fill(): the point is to look typed, not pasted.
  await box.pressSequentially(text, { delay: ms(28) });
  await beat(page, 1200);
}

/**
 * Submit the prompt and hold while the real agent loop runs. Returns when the
 * turn looks settled — the send button re-enables — or when `budgetMs` expires.
 *
 * Deliberately tolerant: this is a live model call over a live MCP gateway, so
 * the run is not deterministic and a recording that hard-fails on a slow turn
 * is a recording nobody re-runs.
 */
export async function runTurn(page: Page, budgetMs = 240_000): Promise<void> {
  await click(page.getByRole("button", { name: /Send prompt/i }), { settle: 1200 });

  // While a turn runs, the send button is REPLACED by a stop button. That
  // swap is the reliable signal — the send button's disabled state is not,
  // since it is also disabled whenever the composer is empty, which is exactly
  // the state immediately after submitting.
  const stop = page.getByRole("button", { name: /Stop task/i });
  try {
    await stop.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    console.log("  ⤵ turn never started (no stop button); continuing");
    return;
  }

  // The turn parks on a permission ask until a human answers it. Left
  // unanswered the loop simply stalls, so the recording answers it — and holds
  // on the card first, because the approval gate is part of the story, not an
  // obstacle to route around.
  const deadline = Date.now() + budgetMs;
  let approvals = 0;
  while (Date.now() < deadline) {
    if (await stop.isHidden().catch(() => true)) {
      await page.waitForTimeout(ms(1200));
      return;
    }
    const allow = page.getByRole("button", { name: /^Allow once$/ }).first();
    if (await allow.isVisible().catch(() => false)) {
      approvals += 1;
      await say(page, "Every tool call is gated — you approve it");
      await beat(page, 2600);
      await click(allow, { settle: 1200 });
      await say(page, "Approved — the loop continues");
    }
    await page.waitForTimeout(400);
  }
  console.log(`  ⤵ turn still running at budget (${approvals} approvals answered)`);
}
