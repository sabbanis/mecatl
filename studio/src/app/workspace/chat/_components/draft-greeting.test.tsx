import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DraftGreeting, STARTER_PROMPTS } from "./draft-greeting";

/**
 * The draft greeting has three independently controlled pieces: the
 * first-run welcome card (links out + a persisted Dismiss), the greeting
 * heading (always), and the starter-prompt chips (hideable — the
 * `--no-banner` analogue). Pins each prop's effect and the callbacks.
 */
describe("DraftGreeting", () => {
  function renderGreeting(
    overrides: Partial<React.ComponentProps<typeof DraftGreeting>> = {},
  ) {
    const onDismissWelcome = vi.fn();
    const onPickSeed = vi.fn();
    render(
      <DraftGreeting
        showWelcome
        onDismissWelcome={onDismissWelcome}
        showStarterPrompts
        onPickSeed={onPickSeed}
        {...overrides}
      />,
    );
    return { onDismissWelcome, onPickSeed };
  }

  it("renders the welcome card with its heading, links, and Dismiss", async () => {
    const { onDismissWelcome } = renderGreeting();
    expect(
      screen.getByRole("heading", { name: "Welcome to Mecatl Studio" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Keyboard shortcuts & features" }),
    ).toHaveAttribute("href", "/workspace/shortcuts");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/workspace/settings",
    );
    expect(screen.getByRole("link", { name: "Skills" })).toHaveAttribute(
      "href",
      "/workspace/skills",
    );
    // The operator-brandable mark rides along, so a branded deployment's
    // splash carries its own logo.
    expect(screen.getByRole("img")).toHaveAttribute("src", "/brand/logo");

    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss welcome" }),
    );
    expect(onDismissWelcome).toHaveBeenCalledTimes(1);
  });

  it("omits the card when showWelcome is false but keeps the greeting", () => {
    renderGreeting({ showWelcome: false });
    expect(
      screen.queryByRole("heading", { name: "Welcome to Mecatl Studio" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("welcome-card")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "What can I help you with?" }),
    ).toBeInTheDocument();
  });

  it("hides every starter chip when showStarterPrompts is false", () => {
    renderGreeting({ showWelcome: false, showStarterPrompts: false });
    expect(
      screen.getByRole("heading", { name: "What can I help you with?" }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("seeds the composer with the clicked starter prompt", async () => {
    const { onPickSeed } = renderGreeting({ showWelcome: false });
    const chips = screen.getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual([...STARTER_PROMPTS]);
    await userEvent.click(
      screen.getByRole("button", { name: STARTER_PROMPTS[1] }),
    );
    expect(onPickSeed).toHaveBeenCalledWith(STARTER_PROMPTS[1]);
  });
});
