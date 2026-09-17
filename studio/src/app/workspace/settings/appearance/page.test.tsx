import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaletteProvider } from "@/components/palette-provider";
import { memoryStorage } from "@/test/memory-storage";
import AppearanceSettingsPage from "./page";

const HIDE_STARTER_PROMPTS_KEY = "mecatl-studio.hide-starter-prompts";
const WELCOME_DISMISSED_KEY = "mecatl-studio.welcome-dismissed";

/**
 * Personalize owns the two new-chat preferences: the starter-prompt switch
 * (the --no-banner analogue, default ON) and the welcome card's "Show again"
 * (only actionable once the card was dismissed). Both are browser-local, so
 * the page writes the same keys the chat reads.
 */
describe("AppearanceSettingsPage — new chat preferences", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("offers starter prompts on by default and hides them via the switch", async () => {
    render(<AppearanceSettingsPage />);
    const toggle = screen.getByRole("switch", { name: "Starter prompts" });
    expect(toggle).toBeChecked();
    expect(window.localStorage.getItem(HIDE_STARTER_PROMPTS_KEY)).toBeNull();

    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(window.localStorage.getItem(HIDE_STARTER_PROMPTS_KEY)).toBe("1");

    await userEvent.click(toggle);
    expect(toggle).toBeChecked();
    expect(window.localStorage.getItem(HIDE_STARTER_PROMPTS_KEY)).toBeNull();
  });

  it("reports the welcome card as showing while it was never dismissed", () => {
    render(<AppearanceSettingsPage />);
    expect(screen.getByRole("button", { name: "Showing" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Show again" }),
    ).not.toBeInTheDocument();
  });

  it("brings a dismissed welcome card back with Show again", async () => {
    window.localStorage.setItem(WELCOME_DISMISSED_KEY, "1");
    render(<AppearanceSettingsPage />);
    const showAgain = await screen.findByRole("button", { name: "Show again" });
    expect(showAgain).toBeEnabled();

    await userEvent.click(showAgain);
    expect(window.localStorage.getItem(WELCOME_DISMISSED_KEY)).toBeNull();
    expect(screen.getByRole("button", { name: "Showing" })).toBeDisabled();
  });
});

/**
 * The Enter preference changes what a key DOES; which keys fire what is the
 * keymap on Settings → Keyboard. Personalize points there so the two are
 * found together.
 */
describe("AppearanceSettingsPage — keyboard shortcuts", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("links to Settings → Keyboard for rebinding", () => {
    render(<AppearanceSettingsPage />);
    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Customize/ })).toHaveAttribute(
      "href",
      "/workspace/settings/keyboard",
    );
  });
});

/**
 * The Palette row is the web form of mecatui's `--theme` / `--list-themes`:
 * it enumerates every built-in palette by name and description, and picking
 * one lands `data-palette` on <html> at once AND persists it, while the
 * light/dark Theme row stays a separate axis. A deployment pin
 * (`BRAND_PALETTE`) is named in the row so a user knows why a fresh browser
 * is not Stacklok green.
 */
describe("AppearanceSettingsPage — palette", () => {
  const PALETTE_KEY = "mecatl-studio.palette";

  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });
  afterEach(() => {
    document.documentElement.removeAttribute("data-palette");
  });

  it("lists the built-in palettes with descriptions and applies a choice", async () => {
    const user = userEvent.setup();
    render(<AppearanceSettingsPage />);
    const trigger = screen.getByRole("button", { name: "Palette" });
    expect(trigger).toHaveTextContent("Default");

    await user.click(trigger);
    for (const label of ["Default", "Aztec", "Mono", "Solar"]) {
      expect(
        await screen.findByRole("menuitem", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole("menuitem", { name: /Aztec/ })).toHaveTextContent(
      "Jade, turquoise and gold on obsidian.",
    );

    await user.click(screen.getByRole("menuitem", { name: /Aztec/ }));
    expect(screen.getByRole("button", { name: "Palette" })).toHaveTextContent(
      "Aztec",
    );
    expect(window.localStorage.getItem(PALETTE_KEY)).toBe("aztec");
    expect(document.documentElement.getAttribute("data-palette")).toBe("aztec");
    // The light/dark axis is untouched by a palette choice.
    expect(screen.getByRole("button", { name: "Theme" })).toHaveTextContent(
      "System",
    );
  });

  it("shows the stored palette on load and names a deployment pin", () => {
    window.localStorage.setItem(PALETTE_KEY, "solar");
    render(
      <PaletteProvider defaultPalette="mono">
        <AppearanceSettingsPage />
      </PaletteProvider>,
    );
    expect(screen.getByRole("button", { name: "Palette" })).toHaveTextContent(
      "Solar",
    );
    expect(
      screen.getByText(/This deployment's default is Mono\./),
    ).toBeInTheDocument();
  });
});
