import { expect, test } from "@playwright/test";

/**
 * Browser smoke over the real stack: Studio's production build in external
 * mode → the /api/mecatl proxy → the fixture daemon (tests/e2e/
 * fixture-daemon.mjs). Assertions are mostly read-only renders of fixture
 * content; the prompts that DO stream here (the authorization takeover, the
 * subagent lifecycle) exercise the fixture's SSE relay end to end, while the
 * approval mechanics stay with the protocol unit suite and the hermetic
 * server-tier suite.
 */

test("the chat list and transcript come from the daemon", async ({ page }) => {
  await page.goto("/workspace/chat");
  // The draft route's tab names the draft, then the app (no chat open yet).
  await expect(page).toHaveTitle(/^New chat — Mecatl Studio$/);
  // The sidebar row is the daemon's session inventory.
  await page.getByText("Fix the flaky scheduler test").first().click();
  // Opening the chat rehydrates the authoritative transcript.
  await expect(
    page.getByText("the test races the claim sentinel", { exact: false }),
  ).toBeVisible();
  // The tab title follows the open chat (mecatui's window title): the title
  // leads, the app name trails; the fixture chat is idle, so no phase word.
  await expect(page).toHaveTitle(
    /^Fix the flaky scheduler test — Mecatl Studio$/,
  );
});

test("the live chat's model pill shows the daemon's effective reasoning-effort tier", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  await page.getByText("Fix the flaky scheduler test").first().click();
  await expect(
    page.getByText("the test races the claim sentinel", { exact: false }),
  ).toBeVisible();
  // The composer's model + effort trigger reads "{model} · {effort}" from
  // the snapshot's resolved_model (the fixture echoes reasoning_effort
  // "medium"); the ContextMeter needs counted tokens and is not the oracle.
  await expect(
    page.locator('button[title="fixture-model · Medium"]').first(),
  ).toBeVisible();
});

test("a tool call parked on a browser sign-in shows the authorization card and re-check resumes the run", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  await page.getByText("Fix the flaky scheduler test").first().click();
  await expect(
    page.getByText("the test races the claim sentinel", { exact: false }),
  ).toBeVisible();
  // The fixture parks any prompt that mentions authorization: the stream
  // ends on authorization.required with no result, and the takeover card
  // replaces the composer.
  const composer = page.locator(".composer-editor .ProseMirror").first();
  await composer.click();
  await page.keyboard.type("Run the Fixture MCP authorization flow");
  await page.getByRole("button", { name: "Send message" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Browser authorization required" }),
  ).toBeVisible();
  await expect(
    page.getByText("Fixture MCP needs you to sign in", { exact: false }),
  ).toBeVisible();
  // Re-check streams the continuation run (bodyless POST — the fixture 400s
  // any body byte, like the daemon) and the card gives the composer back.
  await page.getByRole("button", { name: "I've finished — re-check" }).click();
  await expect(
    page.getByText("Authorized: continuing from the fixture.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Browser authorization required" }),
  ).toBeHidden();
});

test("schedules render the registry with humanized triggers", async ({
  page,
}) => {
  await page.goto("/workspace/schedules");
  // The responsive tables render each row twice (desktop columns + the
  // CSS-collapsed mobile cell), so scope to the visible instance.
  await expect(
    page.getByText("nightly-fixture-digest").filter({ visible: true }),
  ).toBeVisible();
  // The fixture's cron is "0 9 * * *" — the table renders it in plain English.
  await expect(
    page.getByText("Daily at", { exact: false }).first(),
  ).toBeVisible();
});

test("schedules show fire count and last run, and the text filter narrows the list", async ({
  page,
}) => {
  await page.goto("/workspace/schedules");
  // The fixture state carries fire_count 3 and a last_fire_at; both land as
  // columns on the desktop table (the mobile cell is CSS-hidden here).
  await expect(page.getByRole("button", { name: "Runs" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Last run" })).toBeVisible();
  await expect(page.getByRole("cell", { name: /^\d+d ago$/ })).toBeVisible();

  // A query nothing matches names itself in the empty state.
  await page.getByPlaceholder("Filter by name or schedule").fill("zzz");
  await expect(page.getByText("No scheduled tasks match “zzz”.")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect(
    page.getByText("nightly-fixture-digest").filter({ visible: true }),
  ).toBeVisible();
});

test("the new scheduled task form offers write access, off by default", async ({
  page,
}) => {
  await page.goto("/workspace/schedules");
  await page.getByRole("button", { name: "New scheduled task" }).click();
  const dialog = page.getByRole("dialog");
  // The TUI form's y/n mutating toggle: a labelled switch, read-only until
  // opted in, which then reveals the permission-mode picker.
  const writes = dialog.getByRole("switch", {
    name: "Allow file and shell writes",
  });
  await expect(writes).toBeVisible();
  await expect(writes).not.toBeChecked();
  await expect(
    dialog.getByText("Read-only: the task runs in plan mode", { exact: false }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("combobox", { name: "Permission mode" }),
  ).toHaveCount(0);

  await writes.click();
  await expect(writes).toBeChecked();
  await expect(
    dialog.getByRole("combobox", { name: "Permission mode" }),
  ).toBeVisible();
});

test("the new scheduled task form compiles a natural-language phrase", async ({
  page,
}) => {
  await page.goto("/workspace/schedules");
  await page.getByRole("button", { name: "New scheduled task" }).click();
  const dialog = page.getByRole("dialog");
  // The TUI Create form's phrase input: the phrase compiles into the cron the
  // builder then shows as an interval, with a plain-English preview.
  await dialog.getByLabel("Describe the schedule").fill("every 30 minutes");
  await expect(dialog.getByText("Every 30 minutes")).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Repeat" })).toHaveText(
    "Every…",
  );
  await expect(dialog.getByRole("spinbutton", { name: "Every" })).toHaveValue(
    "30",
  );
});

test("skills render the resolved inventory", async ({ page }) => {
  await page.goto("/workspace/skills");
  await expect(
    page
      .getByText("Review a diff for correctness.", { exact: false })
      .filter({ visible: true }),
  ).toBeVisible();
});

test("memory renders the user model, read-only", async ({ page }) => {
  await page.goto("/workspace/settings/memory");
  await expect(
    page
      .getByText("prefers tabs over spaces", { exact: false })
      .filter({ visible: true }),
  ).toBeVisible();
});

test("external mode marks runtime settings as deployment-owned", async ({
  page,
}) => {
  // Settings is subpages now; the runtime sections live under their own
  // routes, so the assertion targets the provider page directly.
  await page.goto("/workspace/settings/provider");
  await expect(
    page.getByText("Managed by the external mecated deployment").first(),
  ).toBeVisible();
  // The daemon's own provider_status rows still render read-only in
  // external mode; the fixture's row is state=ok, so it carries NO hint line.
  const fixtureStatus = page.locator("li[data-provider-status='fixture']");
  await expect(fixtureStatus).toBeVisible();
  await expect(fixtureStatus).toContainText("ok");
  await expect(fixtureStatus.locator("[data-role='hint']")).toHaveCount(0);
  // The About card puts Studio's own build stamp (inlined at `next build`)
  // and the external server mode next to the daemon's safe identity from
  // GET /v1/info — the fixture's build id and composition family.
  await expect(page.getByTestId("about-studio-build")).not.toBeEmpty();
  await expect(page.getByTestId("about-server-mode")).toHaveText("external");
  await expect(page.getByTestId("about-server-build")).toHaveText("fixture");
  await expect(page.getByTestId("about-server-implementation")).toHaveText(
    "fixture-daemon",
  );
  await expect(page.getByTestId("about-posture")).toHaveText("trusted");
});

test("diagnostics shows the daemon-reported posture and its defenses", async ({
  page,
}) => {
  // The fixture advertises `posture: "trusted"` in its compatibility
  // document; the card renders that tier and the four defense rows off it
  // (project trust on at trusted+), with the external-mode managed note in
  // place of a change link.
  await page.goto("/workspace/settings/diagnostics");
  await expect(page.getByTestId("posture-tier")).toHaveText("trusted");
  await expect(page.getByText("Project trust")).toBeVisible();
  await expect(page.getByTestId("posture-defense-projectTrust")).toHaveText(
    "on",
  );
  await expect(page.getByTestId("posture-defense-allowAll")).toHaveText("off");
  await expect(
    page.getByText("Managed by the external mecated deployment").first(),
  ).toBeVisible();
});

test("the help reference reflects the daemon's features", async ({ page }) => {
  await page.goto("/workspace/shortcuts");
  await expect(page.getByText("Features on this daemon")).toBeVisible();
  // The fixture advertises steer (capability + the http_steer feature) but
  // not image, so one row is plain and the other carries the tag.
  const steer = page.locator("li[data-feature='steer']");
  await expect(steer).toBeVisible();
  await expect(steer).toHaveAttribute("data-enabled", "true");
  await expect(steer.getByText("not enabled")).toHaveCount(0);
  const image = page.locator("li[data-feature='image']");
  await expect(image.getByText("not enabled")).toBeVisible();
});

test("Settings → Keyboard lists the keymap with a recorder per rebindable row", async ({
  page,
}) => {
  await page.goto("/workspace/settings/keyboard");
  const card = page.locator("section", {
    has: page.getByRole("heading", { name: "Keyboard shortcuts" }),
  });
  await expect(
    card.getByRole("heading", { name: "Keyboard shortcuts" }),
  ).toBeVisible();
  await expect(card.getByText("New chat", { exact: true })).toBeVisible();
  await expect(
    card.getByRole("button", { name: /Change shortcut for New chat/ }),
  ).toBeVisible();
  // Esc is dispatched but locked: listed read-only, no recorder.
  await expect(card.getByText(/Not rebindable — Esc/)).toBeVisible();
  await expect(card.getByRole("button", { name: "Reset all" })).toBeDisabled();
});

test("typing /help in the composer opens the help reference", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  const composer = page.locator(".composer-editor .ProseMirror").first();
  await composer.click();
  await page.keyboard.type("/help");
  // The `/` menu lists Studio's builtin; ONE Enter picks it and navigates
  // (no chip is inserted, nothing reaches the daemon).
  await expect(page.getByText("show keys & features")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/workspace\/shortcuts$/);
  await expect(page.getByText("Features on this daemon")).toBeVisible();
});

test("the / palette lists Studio's built-ins ahead of the daemon's commands and /clear opens the successor chat", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  await page.getByText("Fix the flaky scheduler test").first().click();
  await expect(
    page.getByText("the test races the claim sentinel", { exact: false }),
  ).toBeVisible();
  const composer = page.locator(".composer-editor .ProseMirror").first();
  await composer.click();
  await page.keyboard.type("/");
  // The client-owned layer comes first, in the TUI's fixed order; the
  // fixture daemon advertises manual compaction, so /compact is offered.
  const rows = page.locator("button", { hasText: /^\// });
  await expect(rows.first()).toContainText("/clear");
  await expect(page.getByText("clear the conversation")).toBeVisible();
  await expect(
    page.getByText("compact this session's model history"),
  ).toBeVisible();
  // Typing the rest and pressing Enter runs the built-in locally: the
  // ClearSession successor is minted and the UI moves to it; nothing is
  // sent as a prompt.
  await page.keyboard.type("clear");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/workspace\/chat\/session-fixture-clear$/);
  await expect(
    page.getByText(
      "Conversation cleared — continuing in a fresh chat with the same settings",
    ),
  ).toBeVisible();
});

test("Clear conversation in the chat menu mints a successor and re-enables the composer", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  await page.getByText("Fix the flaky scheduler test").first().click();
  await expect(
    page.getByText("the test races the claim sentinel", { exact: false }),
  ).toBeVisible();
  // The fixture row offers `fork`, so the item is enabled (the same daemon
  // verdict that gates the model/effort switch).
  await page.getByRole("button", { name: "Chat options" }).click();
  await page
    .getByRole("menuitem", { name: "Clear conversation", exact: true })
    .click();
  // The scrollback switches only after the daemon answered with the
  // successor; the old chat stays in the list and the composer is usable.
  await expect(page).toHaveURL(/\/workspace\/chat\/session-fixture-clear$/);
  await expect(
    page.getByText(
      "Conversation cleared — continuing in a fresh chat with the same settings",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Fix the flaky scheduler test").first(),
  ).toBeVisible();
  await expect(
    page.locator(".composer-editor .ProseMirror").first(),
  ).toHaveAttribute("contenteditable", "true");
});

test("Switch worktree… lists the fixture worktrees and moves to the picked one", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  await page.getByText("Fix the flaky scheduler test").first().click();
  await expect(
    page.getByText("the test races the claim sentinel", { exact: false }),
  ).toBeVisible();
  // Gated on the fixture's `worktrees` capability AND the row's `fork`
  // verdict (the same daemon verdict that gates Clear conversation).
  await page.getByRole("button", { name: "Chat options" }).click();
  await page
    .getByRole("menuitem", { name: "Switch worktree…", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Switch worktree" });
  // The two fixture worktrees, in daemon order, with branch and short rev.
  const main = dialog.getByRole("radio", { name: /^main main/ });
  const feature = dialog.getByRole("radio", { name: /feature-x/ });
  await expect(main).toBeVisible();
  await expect(feature).toBeVisible();
  await expect(dialog.getByText("feature/x")).toBeVisible();
  await expect(dialog.getByText("0123456")).toBeVisible();
  // Nothing picked: Switch stays disabled until a worktree is chosen.
  const confirm = dialog.getByRole("button", { name: "Switch", exact: true });
  await expect(confirm).toBeDisabled();
  await feature.check();
  await confirm.click();
  // The default is a fresh (clear) successor: the fixture's clear route
  // answers the cleared id and the UI moves there; the old chat stays.
  await expect(page).toHaveURL(/\/workspace\/chat\/session-fixture-clear$/);
  await expect(
    page.getByText("Now working in feature-x (feature/x)"),
  ).toBeVisible();
  await expect(
    page.getByText("Fix the flaky scheduler test").first(),
  ).toBeVisible();
});

test("Debug with AI in the row menu opens the consent dialog naming the chat, its reporting servers and the opening message", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  // The row menu's item is gated on the fixture's `session_debug`; its
  // options button reveals on hover (≥500px), so hover the row first.
  const row = page.getByRole("button", {
    name: /^Open chat: Fix the flaky scheduler test/,
  });
  await row.hover();
  await page
    .getByRole("button", {
      name: "Options for chat: Fix the flaky scheduler test",
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Debug with AI", exact: true })
    .click();
  // The consent names the target chat; the attach section lists the daemon's
  // configured server (GET /v1/mcp/sources, gated on `debug_mcp`), unpicked.
  const dialog = page.getByRole("dialog", {
    name: "Debug with AI: Fix the flaky scheduler test",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("will be sent to the model as debugging evidence", {
      exact: false,
    }),
  ).toBeVisible();
  const server = dialog.getByRole("checkbox", { name: "fixture-mcp" });
  await expect(server).toBeVisible();
  await expect(server).not.toBeChecked();
  // The runtime-context report is on by default, and the opening message the
  // debug chat will submit on its own is shown before it leaves.
  await expect(
    dialog.getByRole("switch", {
      name: "Include a Studio/daemon diagnostics report as runtime context",
    }),
  ).toBeChecked();
  await expect(
    dialog.getByText("Diagnose the bound target session", { exact: false }),
  ).toBeVisible();
  // Picking the server re-spells the message with the TUI's suffix.
  await server.check();
  await expect(
    dialog.getByText("Selected reporting servers are available: fixture-mcp.", {
      exact: false,
    }),
  ).toBeVisible();
  // Nothing was created: Cancel closes without a daemon call.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("a scheduled task's delivery note renders as an attributed card", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  await page.getByText("Fix the flaky scheduler test").first().click();
  // The fixture transcript's third message is the daemon's fenced note.
  const card = page.getByRole("article", {
    name: "Scheduled task nightly-fixture-digest",
  });
  await expect(card).toBeVisible();
  await expect(
    card.getByRole("link", { name: "nightly-fixture-digest" }),
  ).toHaveAttribute("href", "/workspace/schedules/nightly-fixture-digest");
  await expect(card.getByText("fire fire-1")).toBeVisible();
  await expect(card.getByText("completed")).toBeVisible();
  await expect(
    card.getByText("Digest: 3 PRs merged", { exact: false }),
  ).toBeVisible();
  // The fence and the header are machine markers for the model, never shown.
  await expect(page.getByText("<<<UNTRUSTED")).toHaveCount(0);
  await expect(page.getByText("[scheduled task", { exact: false })).toHaveCount(
    0,
  );
});

test("the first-run welcome card shows once and stays dismissed across reloads", async ({
  page,
}) => {
  // A fresh browser context (no localStorage) on a connected daemon: the
  // card renders on the draft chat, with its way out.
  await page.goto("/workspace/chat");
  await expect(
    page.getByRole("heading", { name: "Welcome to Mecatl Studio" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Keyboard shortcuts & features" }),
  ).toHaveAttribute("href", "/workspace/shortcuts");
  await page.getByRole("button", { name: "Dismiss welcome" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to Mecatl Studio" }),
  ).toBeHidden();
  // The greeting and its starter prompts stay — only the card is one-time.
  await expect(
    page.getByRole("heading", { name: "What can I help you with?" }),
  ).toBeVisible();
  // Dismissal is persisted browser-locally, so a reload does not bring it back.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What can I help you with?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Welcome to Mecatl Studio" }),
  ).toHaveCount(0);
});

test("storage settings show aggregate health and the clean-up plan", async ({
  page,
}) => {
  // The fixture advertises storage_health / storage_migration /
  // storage_cleanup, so the maintenance block renders: the always-visible
  // health card off GET /v1/storage/health, the read-only migration estimate,
  // and the clean-up plan → typed CLEAN UP → apply flow over its static jobs.
  await page.goto("/workspace/settings/storage");
  await expect(page.getByTestId("storage-health-status")).toHaveText("Healthy");
  await expect(page.getByTestId("storage-health-sessions")).toContainText("3");
  await expect(page.getByTestId("storage-health-size")).toHaveText("20 KB");
  await expect(page.getByTestId("storage-health-active-job")).toHaveText(
    "none",
  );

  await page.getByRole("button", { name: "Estimate", exact: true }).click();
  await expect(page.getByTestId("storage-migration-plan")).toContainText(
    "Legacy (v1) families",
  );
  await expect(
    page.getByRole("button", { name: "Optimize now", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Plan clean-up", exact: true })
    .click();
  await expect(page.getByTestId("storage-cleanup-eligible")).toContainText("1");
  await expect(page.getByTestId("storage-cleanup-protected")).toContainText(
    "2",
  );
  await page.getByRole("button", { name: "Clean up…", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  const confirm = dialog.getByRole("button", { name: "Clean up", exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("textbox").fill("clean up");
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("textbox").fill("CLEAN UP");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByTestId("storage-cleanup-job-state")).toHaveText(
    "Completed",
  );
  await expect(page.getByTestId("storage-cleanup-progress")).toContainText(
    "1 deleted",
  );
});

test("a prompt's subagent lifecycle feeds the inline card, the fleet chip, and the Agents panel", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  await page.getByText("Fix the flaky scheduler test").first().click();
  await expect(
    page.getByText("the test races the claim sentinel", { exact: false }),
  ).toBeVisible();
  // No child has run in this chat yet, so the composer strip has no chip.
  await expect(
    page.getByRole("list", { name: "Agents in this chat" }),
  ).toHaveCount(0);
  const composer = page.locator(".composer-editor .ProseMirror").first();
  await composer.click();
  await page.keyboard.type("Scan the scheduler tests for me");
  await page.getByRole("button", { name: "Send message" }).first().click();
  // The fixture streams subagent.start → tool → end inside the turn: the
  // turn's delegation card names the child, and the persistent chip beside
  // the context meter tallies it once the end frame lands.
  await expect(
    page.getByText("subagent: Scan the scheduler tests", { exact: false }),
  ).toBeVisible();
  const chip = page.getByRole("button", {
    name: "subagents · 0 running · 1 done",
  });
  await expect(chip).toBeVisible();
  // The chip opens the Agents panel on its family's tab.
  await chip.click();
  await expect(
    page.getByText("subagents · 0 running · 1 done", { exact: true }),
  ).toBeVisible();
});

test("the chat status strip shows the session handle, the resolved model and the posture badge", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  await page.getByText("Fix the flaky scheduler test").first().click();
  const strip = page.getByTestId("chat-status-strip");
  // The bare 12-column handle of `session-fixture-1` (docs/tui.md: no `#`);
  // its accessible name carries the copy affordance.
  await expect(
    strip.getByRole("button", {
      name: "Session session-fixt: copy the full session id",
    }),
  ).toHaveText("session-fixt");
  // The daemon-RESOLVED model off the snapshot's resolved_model (the fixture
  // lists it as "fixture-model"), never "resolving model…" once the read lands.
  await expect(page.getByTestId("chat-status-model")).toHaveText(
    /fixture-model/,
  );
  // The fixture's compatibility document reports posture "trusted": a muted
  // badge whose tooltip is the `/posture` sentence.
  const badge = page.getByTestId("chat-posture-badge");
  await expect(badge).toHaveText("posture trusted");
  await expect(badge).toHaveAttribute("data-tone", "muted");
  await expect(badge).toHaveAttribute(
    "title",
    /posture trusted — allow-all off/,
  );
});

test("the workspace-services notice connects through the daemon and clears", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  await page.getByText("Fix the flaky scheduler test").first().click();
  // The fixture advertises workspace_enrollment and its connector inventory
  // reads not_started: the TUI's "workspace services not connected" notice
  // shows above the composer with the /tools-connect action as a button.
  const notice = page.getByTestId("workspace-enrollment-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Workspace services aren't connected");
  // Connect opens the consent window on the click, then POSTs the bodyless
  // connect; the fixture answers "connected" outright, so the window closes
  // again, the notice clears and the toast confirms.
  await notice.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText("Workspace services connected")).toBeVisible();
  await expect(notice).toHaveCount(0);
});

test("the Permissions page reads the daemon-reported posture in external mode and offers no launch flags", async ({
  page,
}) => {
  // Posture, project trust and shell-less mode are spawn flags of the
  // MANAGED daemon; the external deployment owns its own. So the page shows
  // only the EFFECTIVE tier off the fixture's compatibility document
  // (`posture: "trusted"`) and the managed note — no tier picker, no trust
  // switch, nothing that would pretend to change a flag Studio cannot pass.
  await page.goto("/workspace/settings/permissions");
  const effectiveRow = page
    .getByText("Effective posture", { exact: true })
    .locator("xpath=ancestor::div[2]");
  await expect(
    effectiveRow.getByText("trusted", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Managed by the external mecated deployment").first(),
  ).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Operator posture" }),
  ).toHaveCount(0);
});

test("the Runs tab lists the fixture subagent and opens its read-only transcript", async ({
  page,
}) => {
  await page.goto("/workspace/chat");
  // The fixture inventory holds one chat, one subagent and one scheduled
  // fire: the Chats tab shows only the chat, and the fixture advertises
  // `session_activity_inventory`, so a Drafts tab is offered too.
  const tablist = page.getByRole("tablist", { name: "Session kinds" });
  await expect(tablist.getByRole("tab", { name: /Chats/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(tablist.getByRole("tab", { name: /Drafts/ })).toBeVisible();
  await expect(page.getByText("Scan the scheduler tests")).toHaveCount(0);

  await tablist.getByRole("tab", { name: /Runs/ }).click();
  const row = page.getByRole("button", {
    name: "Inspect run: Scan the scheduler tests",
  });
  await expect(row).toBeVisible();
  // The row is read-only inventory: the chat did not change.
  await expect(page).toHaveTitle(/^New chat — Mecatl Studio$/);
  await row.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("two tests race the claim sentinel", { exact: false }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Subagent of session-fixture-1 · call call-fixture-1"),
  ).toBeVisible();
  // The parent link opens the parent chat as a live conversation.
  await dialog.getByRole("button", { name: "Open parent chat" }).click();
  await expect(
    page.getByText("the test races the claim sentinel", { exact: false }),
  ).toBeVisible();

  // The Scheduled tab lists the fire by what it is (it has no title).
  await tablist.getByRole("tab", { name: /Scheduled/ }).click();
  await page
    .getByRole("button", {
      name: "Inspect run: Fire of schedule nightly-fixture-digest",
    })
    .click();
  await expect(
    page.getByRole("dialog").getByText("digest sent", { exact: false }),
  ).toBeVisible();
});

test("Settings → Help & about shows Studio's version, the docs link and the configuration reference", async ({
  page,
}) => {
  await page.goto("/workspace/settings/help");
  // The web `--version`: Studio's own version and the SDK's, inlined at
  // `next build`, so they are real values before any daemon call.
  await expect(page.getByTestId("about-studio-version")).toHaveText(
    /^\d+\.\d+\.\d+/,
  );
  await expect(page.getByTestId("about-sdk-version")).not.toHaveText("unknown");
  await expect(
    page.getByRole("link", { name: "Documentation" }),
  ).toHaveAttribute("href", "https://mecatl.dev/docs/");
  await expect(
    page.getByRole("link", { name: "Keyboard shortcuts" }),
  ).toHaveAttribute("href", "/workspace/shortcuts");
  // The daemon's identity card shares the page (the fixture answers /v1/info).
  await expect(page.getByTestId("about-server-build")).toHaveText("fixture");
  // The configuration reference names what THIS deployment set — the e2e
  // stack sets MECATL_BASE_URL and MECATL_STUDIO_PUBLIC_ORIGIN — and never a
  // value: the fixture's base URL does not appear anywhere on the page.
  const table = page.getByRole("table", {
    name: "Studio configuration reference",
  });
  await expect(table).toBeVisible();
  await expect(page.getByTestId("config-status-MECATL_BASE_URL")).toHaveText(
    "Set",
  );
  await expect(
    page.getByTestId("config-status-MECATL_STUDIO_PUBLIC_ORIGIN"),
  ).toHaveText("Set");
  await expect(page.getByText("127.0.0.1:8099")).toHaveCount(0);
});
