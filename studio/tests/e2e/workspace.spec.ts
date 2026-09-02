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
