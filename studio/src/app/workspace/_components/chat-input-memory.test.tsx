import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInput } from "./chat-input";

/**
 * The composer's toolbar carries the daemon-derived memory indicator where
 * the inert Memory On/Off toggle used to be: the pill reads the daemon's
 * `capabilities.memory` / `capabilities.user_model` flags, opens a read-only
 * popover, and offers no On/Off choice (the old toggle was local React state
 * that never reached the daemon).
 */

type Runtime = {
  connected: boolean;
  mode: "managed" | "external";
  serverCapabilities: Record<string, unknown>;
};

const runtime = vi.hoisted(() => ({
  status: null as Runtime | null,
}));

vi.mock("@/features/agent/runtime-status", () => ({
  useOptionalRuntimeStatus: () => runtime.status,
}));

// jsdom lays nothing out: ProseMirror's scroll-into-view after a focus asks
// the selection for its rects, so give it empty ones.
const zeroRect = () =>
  ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  }) as DOMRect;
for (const proto of [Element.prototype, Range.prototype]) {
  if (!proto.getClientRects) {
    proto.getClientRects = () => [] as unknown as DOMRectList;
  }
  if (!proto.getBoundingClientRect) {
    proto.getBoundingClientRect = zeroRect;
  }
}

async function renderComposer() {
  const utils = render(<ChatInput />);
  // useEditor with immediatelyRender:false mounts the ProseMirror view in an
  // effect, so the DOM arrives a tick after render.
  await waitFor(() => {
    if (!utils.container.querySelector(".ProseMirror")) {
      throw new Error("editor not mounted yet");
    }
  });
  return utils;
}

beforeEach(() => {
  runtime.status = {
    connected: true,
    mode: "managed",
    serverCapabilities: { memory: true, user_model: true },
  };
});

afterEach(() => {
  runtime.status = null;
  vi.restoreAllMocks();
});

describe("the composer's Memory pill", () => {
  it("reads Memory On from the daemon's capabilities and opens a read-only popover linking to Settings → Memory", async () => {
    const user = userEvent.setup();
    await renderComposer();
    const pill = screen.getByRole("button", { name: "Memory On" });
    await user.click(pill);
    const popover = await screen.findByRole("dialog");
    expect(popover).toHaveTextContent("Project memory (Remember/Recall)");
    expect(popover).toHaveTextContent("User model (facts about you)");
    expect(
      within(popover).getByRole("link", { name: "Settings → Memory" }),
    ).toHaveAttribute("href", "/workspace/settings/memory");
    // No On/Off choice anywhere: the toggle that changed nothing is gone.
    expect(screen.queryAllByRole("menuitem")).toEqual([]);
    expect(within(popover).queryAllByRole("button")).toEqual([]);
    expect(screen.queryByRole("button", { name: /^Off$/ })).toBeNull();
  });

  it("reads Memory Off when the daemon reports both stores off", async () => {
    runtime.status = {
      connected: true,
      mode: "managed",
      serverCapabilities: { memory: false, user_model: false },
    };
    await renderComposer();
    expect(
      screen.getByRole("button", { name: "Memory Off" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Memory On" })).toBeNull();
  });

  it("hides the pill outside the RuntimeStatusProvider rather than inventing a state", async () => {
    runtime.status = null;
    await renderComposer();
    expect(screen.queryByRole("button", { name: /^Memory/ })).toBeNull();
  });
});
