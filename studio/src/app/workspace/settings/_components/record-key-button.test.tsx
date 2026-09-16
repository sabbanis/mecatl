import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { bindingErrorMessage, RecordKeyButton } from "./record-key-button";

/**
 * The per-row recorder on Settings → Keyboard: click arms it, the next real
 * key press is offered to `onRecord` and the verdict lands as a toast, Esc
 * cancels, a lone modifier is ignored, and recording always ends afterwards.
 */

const changeButton = () =>
  screen.getByRole("button", { name: /Change shortcut for New chat/ });

function mount(
  onRecord: (combo: string) => ReturnType<typeof bindingErrorMessage> | null,
  props: Partial<{ custom: boolean; onReset: () => void }> = {},
) {
  return render(
    <RecordKeyButton
      combo="mod+shift+o"
      custom={props.custom ?? false}
      label="New chat"
      onRecord={(combo) => {
        const message = onRecord(combo);
        return message === null
          ? null
          : { reason: "collision", withId: "x", withDescription: message };
      }}
      onReset={props.onReset}
    />,
  );
}

describe("RecordKeyButton", () => {
  it("shows the current keycaps and arms on click", async () => {
    mount(() => null);
    expect(changeButton()).toHaveTextContent("⌘⇧O");
    await userEvent.click(changeButton());
    const recording = screen.getByRole("button", { name: /Recording/ });
    expect(recording).toHaveTextContent("Press keys… (Esc cancels)");
    expect(recording).toHaveAttribute("aria-pressed", "true");
  });

  it("ignores a lone modifier, records the chord, consumes the key and disarms", async () => {
    const onRecord = vi.fn(() => null);
    mount(onRecord);
    await userEvent.click(changeButton());

    fireEvent.keyDown(window, { key: "Shift", shiftKey: true });
    expect(onRecord).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Recording/ })).toBeVisible();

    const notPrevented = fireEvent.keyDown(window, {
      key: "k",
      metaKey: true,
    });
    expect(onRecord).toHaveBeenCalledWith("mod+k");
    expect(notPrevented).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("Shortcut updated");
    expect(changeButton()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Recording/ })).toBeNull();

    // Disarmed: a further key press records nothing.
    fireEvent.keyDown(window, { key: "j", metaKey: true });
    expect(onRecord).toHaveBeenCalledTimes(1);
  });

  it("Escape cancels without recording", async () => {
    const onRecord = vi.fn(() => null);
    mount(onRecord);
    await userEvent.click(changeButton());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onRecord).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(changeButton()).toBeInTheDocument();
  });

  it("toasts the refusal (collision names the other shortcut) and disarms", async () => {
    mount(() => "Open search");
    await userEvent.click(changeButton());
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(toast.error).toHaveBeenCalledWith("Already used by “Open search”");
    expect(toast.success).not.toHaveBeenCalled();
    expect(changeButton()).toBeInTheDocument();
  });

  it("offers Reset to default only for a custom binding", async () => {
    const onReset = vi.fn();
    const { unmount } = mount(() => null, { custom: false, onReset });
    expect(
      screen.queryByRole("button", { name: "Reset to default" }),
    ).toBeNull();
    unmount();

    mount(() => null, { custom: true, onReset });
    await userEvent.click(
      screen.getByRole("button", { name: "Reset to default" }),
    );
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("phrases every refusal reason plainly", () => {
    expect(bindingErrorMessage({ reason: "invalid" })).toBe(
      "Not a valid shortcut",
    );
    // Preventability differs by browser and OS, so the message says "may",
    // not "will": a chord that works on one machine and silently doesn't on
    // another is exactly what the reserved set exists to refuse.
    expect(bindingErrorMessage({ reason: "reserved" })).toBe(
      "Reserved by the browser — Studio may never receive it",
    );
    expect(
      bindingErrorMessage({
        reason: "collision",
        withId: "search.open",
        withDescription: "Open search",
      }),
    ).toBe("Already used by “Open search”");
  });
});
