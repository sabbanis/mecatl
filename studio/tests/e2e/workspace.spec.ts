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
  await expect(
    page.getByText("Keyboard shortcuts and daemon features (Studio)"),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/workspace\/shortcuts$/);
  await expect(page.getByText("Features on this daemon")).toBeVisible();
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
