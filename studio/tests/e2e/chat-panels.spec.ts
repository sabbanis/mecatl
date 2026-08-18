import { expect, test } from "./fixtures";

/**
 * Smoke path for the chat side-panel + composer flows most likely to regress
 * during the refactor: open a chat, open a file preview, maximize it, open a
 * thread, and type an @-mention. Uses resilient role/text selectors rather than
 * pixel assertions so it survives styling changes.
 *
 * The chat surface only exists in the Atrium presentation, which the server
 * route gate reads from the `demo-presentation-mode` cookie — so we set it
 * (and mirror it into localStorage) before the first navigation.
 */
test.describe("chat side panels", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.context().addCookies([
      {
        name: "demo-presentation-mode",
        value: "atrium",
        url: "http://localhost:3000",
      },
    ]);
    await page.addInitScript(() => {
      window.localStorage.setItem("demo-presentation-mode", "atrium");
    });
  });

  test("preview panel, maximize, thread, and @-mention", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/workspace/chat");

    // Open the first project's first chat (which carries attachments).
    await page.getByText("Platform Engineering").click();
    await expect(
      page.getByRole("heading", { name: "Refactor auth middleware" }),
    ).toBeVisible();

    // Open a code attachment → the preview panel shows highlighted code.
    await page.getByRole("button", { name: "auth-middleware.ts" }).click();
    await expect(page.getByText("requireAuth")).toBeVisible();

    // Maximize hides the conversation; the "You" author label disappears.
    await page.getByRole("button", { name: "Maximize panel" }).click();
    await expect(page.getByText("Send a message...")).toBeHidden();

    // Restore the split view and close the panel.
    await page.getByRole("button", { name: "Restore split view" }).click();
    await page.getByRole("button", { name: "Close file" }).click();

    // Start a thread from a message → the Thread panel opens with its composer.
    await page.getByRole("button", { name: "Reply in thread" }).first().click();
    await expect(page.getByPlaceholder("Reply in thread…")).toBeVisible();

    // Typing a resolved @-mention renders it as a green connected chip.
    const composer = page.getByPlaceholder("Send a message...");
    await composer.click();
    await composer.fill("ask @code-reviewer");
    await expect(
      page.locator("span", { hasText: "@code-reviewer" }),
    ).toHaveClass(/emerald/);
  });
});
