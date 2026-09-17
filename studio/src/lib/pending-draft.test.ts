import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PENDING_DRAFT_KEY,
  stashPendingDraft,
  takePendingDraft,
} from "./pending-draft";

/**
 * The cross-route composer handoff: stash → take round-trips the text
 * exactly once (take clears), an empty stash clears, and a browser without
 * usable storage degrades to "nothing pending" instead of throwing.
 */

afterEach(() => {
  // Restore the accessor spy FIRST — clearing through a throwing getter
  // would fail the teardown itself.
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("pending draft", () => {
  it("round-trips the text and clears on take", () => {
    expect(stashPendingDraft("Mecatl diagnostics:\nplatform: macOS")).toBe(
      true,
    );
    expect(window.sessionStorage.getItem(PENDING_DRAFT_KEY)).toBe(
      "Mecatl diagnostics:\nplatform: macOS",
    );
    expect(takePendingDraft()).toBe("Mecatl diagnostics:\nplatform: macOS");
    expect(takePendingDraft()).toBeNull();
    expect(window.sessionStorage.getItem(PENDING_DRAFT_KEY)).toBeNull();
  });

  it("reads null when nothing is pending", () => {
    expect(takePendingDraft()).toBeNull();
  });

  it("clears the stash when given empty text", () => {
    stashPendingDraft("old");
    expect(stashPendingDraft("")).toBe(true);
    expect(takePendingDraft()).toBeNull();
  });

  it("degrades when storage is unusable", () => {
    // A browser with site data blocked throws on the accessor itself.
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(stashPendingDraft("text")).toBe(false);
    expect(takePendingDraft()).toBeNull();
  });
});
