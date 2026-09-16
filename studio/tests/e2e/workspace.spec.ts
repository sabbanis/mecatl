import { expect, test } from "@playwright/test";

/**
 * Browser smoke over the real stack: Studio's production build in external
 * mode → the /api/mecatl proxy → the fixture daemon (tests/e2e/
 * fixture-daemon.mjs). Assertions are read-only renders of fixture content;
 * the streaming/approval mechanics are covered by the protocol unit suite
 * and the hermetic server-tier suite.
 */

test("the chat list and transcript come from the daemon", async ({ page }) => {
  await page.goto("/workspace/chat");
  // The sidebar row is the daemon's session inventory.
  await page.getByText("Fix the flaky scheduler test").first().click();
  // Opening the chat rehydrates the authoritative transcript.
  await expect(
    page.getByText("the test races the claim sentinel", { exact: false }),
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
  await expect(page.getByText("Started a fresh chat")).toBeVisible();
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
