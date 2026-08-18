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

test("schedules render the registry with its posture badges", async ({
  page,
}) => {
  await page.goto("/workspace/schedules");
  await expect(page.getByText("nightly-fixture-digest")).toBeVisible();
  await expect(page.getByText("Plan", { exact: false }).first()).toBeVisible();
});

test("skills render the resolved inventory", async ({ page }) => {
  await page.goto("/workspace/skills");
  await expect(
    page.getByText("Review a diff for correctness.", { exact: false }),
  ).toBeVisible();
});

test("memory renders the user model, read-only", async ({ page }) => {
  await page.goto("/workspace/memory");
  await expect(
    page.getByText("prefers tabs over spaces", { exact: false }),
  ).toBeVisible();
});

test("external mode marks runtime settings as deployment-owned", async ({
  page,
}) => {
  await page.goto("/workspace/settings");
  await expect(
    page.getByText("Managed by the external mecated deployment").first(),
  ).toBeVisible();
});
