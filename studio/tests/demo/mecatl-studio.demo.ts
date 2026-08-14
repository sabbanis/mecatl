/**
 * Mecatl Studio walkthrough — one recording, five beats.
 *
 * The through-line is *what the harness actually does with a request*: it picks
 * a model, reaches real tools over a real gateway, loads a skill when the task
 * calls for one, and shows every step while it happens.
 *
 *   Act I    the workspace, wired to a local mecated
 *   Act II   semantic model routing — one classifier, three tiers
 *   Act III  the MCP gateway on Stacklok staging
 *   Act IV   skills — progressive disclosure, workspace-scoped
 *   Act V    a real turn: skill + gateway tools + the agent loop, live
 *
 * Acts I–IV are deterministic UI. Act V is a live model call over a live
 * gateway, so it is written to tolerate a slow or differently-shaped run.
 *
 * PREREQUISITES (the recording is honest only if these hold):
 *   - `npm run dev` up on BASE_URL
 *   - Provider connected (OpenRouter), not offline mock
 *   - MCP Gateway signed in — check /api/mecatl-control/status
 *
 * PRIVACY: Act V summarizes a REAL Read.ai meeting. The video will contain
 * whatever that meeting contains. Set DEMO_PROMPT to steer it somewhere safe,
 * or review before sharing.
 */

import { test } from "@playwright/test";
import {
  beat,
  click,
  closePanel,
  go,
  installCursor,
  openPanel,
  pan,
  panWithin,
  runTurn,
  say,
  startClock,
  typePrompt,
  writeCues,
} from "./helpers";

const PROMPT =
  process.env.DEMO_PROMPT ||
  "List my most recent Read.ai meeting and summarize it — decisions, commitments with owners, and open questions. Ground each point in a quote and cite the meeting id.";

test("mecatl studio walkthrough", async ({ page }) => {
  test.setTimeout(900_000);
  startClock();
  await installCursor(page);

  // ── Act I — the workspace ─────────────────────────────────────────────────

  await go(page, "/", "Mecatl Studio — a local web client for the mecatl harness");
  await beat(page, 3000);

  await say(page, "One local daemon, one repository — every action visible");
  await beat(page, 2800);

  // ── Act II — semantic model routing ───────────────────────────────────────

  await say(page, "Routing is on: three tiers, chosen per delegation");
  await beat(page, 2400);

  if (await openPanel(page, "Model Router")) {
    await say(page, "Semantic routing — a classifier reads each task's intent");
    await beat(page, 3200);
    await say(page, "Each tier binds a category to a model: large, medium, small");
    await pan(page, 320);
    await beat(page, 3000);
    await say(page, "Policy lives in operator settings, so the tiers stay authoritative");
    await beat(page, 2800);
    await closePanel(page);
  }

  // ── Act III — the MCP gateway ─────────────────────────────────────────────

  if (await openPanel(page, "MCP Gateway")) {
    await say(page, "Tools come from an MCP gateway — Stacklok staging");
    await beat(page, 3200);
    await say(page, "Signed in with OAuth; no token is stored in the browser");
    await beat(page, 3000);
    await pan(page, 260);
    await beat(page, 2400);
    await closePanel(page);
  }

  // ── Act IV — skills ───────────────────────────────────────────────────────

  if (await openPanel(page, "Skills")) {
    await say(page, "Skills — instruction bundles the model loads on demand");
    await beat(page, 3200);
    await say(page, "It sees only names and summaries until it chooses one");
    await beat(page, 3000);
    await panWithin(page, ".skills-list", 300);
    await say(page, "Including one for summarizing Read.ai transcripts");
    await beat(page, 3400);
    await say(page, "Discovery is workspace-scoped — a SKILL.md steers like AGENTS.md");
    await beat(page, 2800);
    await closePanel(page);
  }

  // ── Act V — the live turn ─────────────────────────────────────────────────

  await say(page, "Now the whole thing at once — one request");
  await beat(page, 2400);

  await typePrompt(page, PROMPT);
  await say(page, "The router picks a tier, then the loop begins");

  await runTurn(page, 300_000);

  await say(page, "Tool calls, results, and the model's reasoning — all in the open");
  await beat(page, 3600);
  await pan(page, 420);
  await beat(page, 3000);

  await say(page, "Skill loaded, gateway tools called, answer grounded in the transcript");
  await beat(page, 4000);

  // Land on the composer so the recording ends where a user would start.
  await click(page.getByRole("textbox", { name: /Task prompt/i }), { settle: 800 });
  await say(page, "Mecatl Studio — tool calling, routing, gateway, and skills");
  await beat(page, 3600);
  await say(page, "");

  // Timed caption list, so narration can be recorded against the real cut.
  await writeCues();
});
