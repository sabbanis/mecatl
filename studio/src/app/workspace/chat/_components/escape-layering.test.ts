import { describe, expect, it } from "vitest";
import { type EscapeState, resolveEscapeAction } from "./escape-layering";

/**
 * Esc resolves to exactly one action, in the TUI's layering: a transcript
 * selection drops first, then an open side panel closes, then a streaming
 * run is cancelled, then an unsent draft is cleared; with nothing to do it
 * is a no-op. An Esc pressed to drop a selection can therefore never stop a
 * run.
 */

const none: EscapeState = {
  hasSelection: false,
  panelOpen: false,
  isStreaming: false,
  hasDraft: false,
};

describe("resolveEscapeAction", () => {
  it("does nothing when there is nothing to do", () => {
    expect(resolveEscapeAction(none)).toBe("none");
  });

  it("resolves each layer alone", () => {
    expect(resolveEscapeAction({ ...none, hasSelection: true })).toBe(
      "clear-selection",
    );
    expect(resolveEscapeAction({ ...none, panelOpen: true })).toBe(
      "close-panel",
    );
    expect(resolveEscapeAction({ ...none, isStreaming: true })).toBe(
      "cancel-run",
    );
    expect(resolveEscapeAction({ ...none, hasDraft: true })).toBe(
      "clear-draft",
    );
  });

  it("selection beats panel beats run beats draft", () => {
    const all: EscapeState = {
      hasSelection: true,
      panelOpen: true,
      isStreaming: true,
      hasDraft: true,
    };
    expect(resolveEscapeAction(all)).toBe("clear-selection");
    expect(resolveEscapeAction({ ...all, hasSelection: false })).toBe(
      "close-panel",
    );
    expect(
      resolveEscapeAction({ ...all, hasSelection: false, panelOpen: false }),
    ).toBe("cancel-run");
    expect(
      resolveEscapeAction({
        ...all,
        hasSelection: false,
        panelOpen: false,
        isStreaming: false,
      }),
    ).toBe("clear-draft");
  });

  it("never cancels a run while a selection is up, even mid-stream", () => {
    expect(
      resolveEscapeAction({ ...none, hasSelection: true, isStreaming: true }),
    ).toBe("clear-selection");
  });
});
