import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KEYMAP_STORAGE_KEY } from "@/lib/shortcuts/keymap";
import { SHORTCUTS } from "@/lib/shortcuts/registry";
import { memoryStorage } from "@/test/memory-storage";
import KeyboardSettingsPage from "./page";

/**
 * Settings → Keyboard is the complete keymap: every registry row is listed,
 * rebindable rows carry a recorder that writes this browser's keymap, fixed
 * and locked rows are read-only with a note, a refused key stores nothing,
 * and Reset all asks first.
 */

const stored = () => {
  const raw = window.localStorage.getItem(KEYMAP_STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
};

const newChatButton = () =>
  screen.getByRole("button", { name: /Change shortcut for New chat/ });

describe("KeyboardSettingsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("lists every shortcut — recorders for rebindable rows, read-only notes for fixed and locked ones", () => {
    render(<KeyboardSettingsPage />);
    expect(
      screen.getByRole("heading", { name: "Keyboard shortcuts" }),
    ).toBeInTheDocument();
    for (const def of SHORTCUTS) {
      expect(screen.getByText(def.description)).toBeInTheDocument();
    }
    expect(newChatButton()).toBeInTheDocument();

    // Locked: Esc is dispatched but not rebindable.
    const escRow = screen
      .getByText(
        "Clear the selection, close the side panel — or stop the running turn",
      )
      .closest("div");
    if (!escRow) throw new Error("no Esc row");
    expect(
      within(escRow).getByText(/Not rebindable — Esc stays the fallback/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Change shortcut for Clear the/ }),
    ).toBeNull();

    // Fixed: the composer's Enter is documentation-only.
    expect(
      screen.queryByRole("button", { name: /Change shortcut for Send/ }),
    ).toBeNull();
    expect(
      screen.getAllByText(/Not rebindable — handled by the composer/).length,
    ).toBeGreaterThan(0);

    expect(screen.getByRole("button", { name: "Reset all" })).toBeDisabled();
    expect(
      screen.getByRole("link", { name: /View the shortcuts reference/ }),
    ).toHaveAttribute("href", "/workspace/shortcuts");
  });

  it("records a new key into this browser's keymap and offers a per-row reset", async () => {
    render(<KeyboardSettingsPage />);
    expect(newChatButton()).toHaveTextContent("⌘⇧O");

    await userEvent.click(newChatButton());
    fireEvent.keyDown(window, { key: "K", metaKey: true, shiftKey: true });

    expect(stored()).toEqual({ "chat.new": "mod+shift+k" });
    expect(toast.success).toHaveBeenCalledWith("Shortcut updated");
    expect(newChatButton()).toHaveTextContent("⌘⇧K");
    expect(screen.getByRole("button", { name: "Reset all" })).toBeEnabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Reset to default" }),
    );
    expect(stored()).toBeNull();
    expect(newChatButton()).toHaveTextContent("⌘⇧O");
    expect(screen.getByRole("button", { name: "Reset all" })).toBeDisabled();
  });

  it("refuses a key another shortcut uses and stores nothing", async () => {
    render(<KeyboardSettingsPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /Change shortcut for Open search/ }),
    );
    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(toast.error).toHaveBeenCalledWith(
      "Already used by “Toggle the chat list”",
    );
    expect(stored()).toBeNull();
  });

  it("refuses a browser-reserved chord", async () => {
    render(<KeyboardSettingsPage />);
    await userEvent.click(newChatButton());
    fireEvent.keyDown(window, { key: "n", metaKey: true });
    expect(toast.error).toHaveBeenCalledWith(
      "Reserved by the browser — Studio may never receive it",
    );
    expect(stored()).toBeNull();

    // The broadened set: a ⌘-digit tab switch and Ctrl+Shift+Delete are
    // refused the same way, as the recorder spells them.
    await userEvent.click(newChatButton());
    fireEvent.keyDown(window, { key: "1", metaKey: true });
    await userEvent.click(newChatButton());
    fireEvent.keyDown(window, { key: "Delete", ctrlKey: true, shiftKey: true });
    expect(toast.error).toHaveBeenCalledTimes(3);
    expect(stored()).toBeNull();
  });

  it("accepts a bare letter but says it won't fire while typing — on the toast and beneath the row", async () => {
    render(<KeyboardSettingsPage />);
    await userEvent.click(newChatButton());
    fireEvent.keyDown(window, { key: "n" });

    expect(stored()).toEqual({ "chat.new": "n" });
    expect(toast.success).toHaveBeenLastCalledWith("Shortcut updated", {
      description: expect.stringMatching(/Won't fire while typing/),
    });
    const row = screen.getByText("New chat").closest("div");
    if (!row) throw new Error("no New chat row");
    expect(
      within(row).getByText(/Custom shortcut\. Won't fire while typing/),
    ).toBeInTheDocument();

    // A ⌘ chord is custom too, but carries no caution.
    await userEvent.click(newChatButton());
    fireEvent.keyDown(window, { key: "K", metaKey: true, shiftKey: true });
    expect(toast.success).toHaveBeenLastCalledWith("Shortcut updated");
    expect(within(row).getByText("Custom shortcut.")).toBeInTheDocument();

    // Back on the default there is no note at all.
    await userEvent.click(
      screen.getByRole("button", { name: "Reset to default" }),
    );
    expect(within(row).queryByText(/Custom shortcut/)).toBeNull();
  });

  it("Reset all asks first, then clears the whole keymap", async () => {
    window.localStorage.setItem(
      KEYMAP_STORAGE_KEY,
      JSON.stringify({ "chat.new": "mod+shift+k" }),
    );
    const user = userEvent.setup();
    render(<KeyboardSettingsPage />);
    expect(newChatButton()).toHaveTextContent("⌘⇧K");

    await user.click(screen.getByRole("button", { name: "Reset all" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("Reset all shortcuts?"),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Reset all" }));

    expect(stored()).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("Shortcuts reset to defaults");
    expect(newChatButton()).toHaveTextContent("⌘⇧O");
  });
});
