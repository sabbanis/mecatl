import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaletteProvider } from "@/components/palette-provider";
import {
  loadOperatorPalettes,
  resetCustomPalettesForTests,
} from "@/lib/custom-palettes";
import { memoryStorage } from "@/test/memory-storage";
import AppearanceSettingsPage from "./page";

const HIDE_STARTER_PROMPTS_KEY = "mecatl-studio.hide-starter-prompts";

// The page hosts the Custom palettes section, whose mount starts the
// one-per-page /api/palettes fetch: stub it and let it settle up front so no
// state update lands outside act in the tests below.
beforeEach(async () => {
  vi.stubGlobal("localStorage", memoryStorage());
  resetCustomPalettesForTests();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ palettes: [] }), {
          headers: { "content-type": "application/json" },
        }),
    ),
  );
  await loadOperatorPalettes();
});
afterEach(() => resetCustomPalettesForTests());

/**
 * Personalize owns the new-chat preference: the starter-prompt switch (the
 * --no-banner analogue, default ON). Browser-local, so the page writes the
 * same key the chat reads.
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
 * The Message queuing row carries the client-level never-steer switch as a
 * third option, "Queue only" (the web form of `mecatui --no-steer`): picking
 * it persists the "queue-only" preference the composer reads, and the row's
 * description stops promising that Shift+Enter "does the opposite".
 */
describe("AppearanceSettingsPage — message queuing", () => {
  const ENTER_KEY = "mecatl-studio.enter-send-behavior";

  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("offers Queue only and persists it with an honest description", async () => {
    const user = userEvent.setup();
    render(<AppearanceSettingsPage />);
    const trigger = screen.getByRole("button", { name: "Message queuing" });
    expect(trigger).toHaveTextContent("Queue message");
    expect(
      screen.getByText(/Shift\+Enter does the opposite/),
    ).toBeInTheDocument();

    await user.click(trigger);
    for (const label of ["Queue message", "Steer the agent", "Queue only"]) {
      expect(
        await screen.findByRole("menuitem", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
    await user.click(screen.getByRole("menuitem", { name: /Queue only/ }));

    expect(
      screen.getByRole("button", { name: "Message queuing" }),
    ).toHaveTextContent("Queue only");
    expect(window.localStorage.getItem(ENTER_KEY)).toBe("queue-only");
    expect(
      screen.getByText(/Never steer the in-flight run/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/does the opposite/)).not.toBeInTheDocument();
  });

  it("shows a stored Queue only choice on load", () => {
    window.localStorage.setItem(ENTER_KEY, "queue-only");
    render(<AppearanceSettingsPage />);
    expect(
      screen.getByRole("button", { name: "Message queuing" }),
    ).toHaveTextContent("Queue only");
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

describe("AppearanceSettingsPage — start on", () => {
  const LAUNCH_KEY = "mecatl-studio.launch-target";

  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("defaults to New chat and persists Most recent chat", async () => {
    const user = userEvent.setup();
    render(<AppearanceSettingsPage />);
    const trigger = screen.getByRole("button", { name: "Start on" });
    expect(trigger).toHaveTextContent("New chat");
    expect(window.localStorage.getItem(LAUNCH_KEY)).toBeNull();
    expect(
      screen.getByText(/skips chats that are running or waiting/),
    ).toBeInTheDocument();

    await user.click(trigger);
    await user.click(
      await screen.findByRole("menuitem", { name: /Most recent chat/ }),
    );
    expect(screen.getByRole("button", { name: "Start on" })).toHaveTextContent(
      "Most recent chat",
    );
    expect(window.localStorage.getItem(LAUNCH_KEY)).toBe("latest");

    await user.click(screen.getByRole("button", { name: "Start on" }));
    await user.click(await screen.findByRole("menuitem", { name: /New chat/ }));
    expect(window.localStorage.getItem(LAUNCH_KEY)).toBeNull();
  });

  it("shows the stored choice on load", async () => {
    window.localStorage.setItem(LAUNCH_KEY, "latest");
    render(<AppearanceSettingsPage />);
    expect(
      await screen.findByRole("button", { name: "Start on" }),
    ).toHaveTextContent("Most recent chat");
  });
});
