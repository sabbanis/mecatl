import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatInput } from "./chat-input";

/**
 * The composer's mode-coloured rail and its row policy, proved through the
 * rendered components (the pure tables live in composer-frame.test.ts and
 * lib/permission-mode.test.ts):
 *
 * - The editor's wrapper carries `--composer-min-rows` only when a caller
 *   sets `rows` or `compact`; otherwise the stylesheet's three-row default
 *   stands alone.
 */

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

afterEach(() => {
  vi.restoreAllMocks();
});

async function editorWrapper(props: Parameters<typeof ChatInput>[0] = {}) {
  const utils = render(<ChatInput {...props} />);
  // useEditor with immediatelyRender:false mounts the ProseMirror view in an
  // effect, so the DOM arrives a tick after render.
  await waitFor(() => {
    if (!utils.container.querySelector(".ProseMirror")) {
      throw new Error("editor not mounted yet");
    }
  });
  const wrapper =
    utils.container.querySelector<HTMLElement>(".composer-editor");
  if (!wrapper) throw new Error("no .composer-editor wrapper");
  return { ...utils, wrapper };
}

describe("the composer's resting rows", () => {
  it("leaves the stylesheet's three-row default alone when nothing is asked", async () => {
    const { wrapper } = await editorWrapper();
    expect(wrapper.style.getPropertyValue("--composer-min-rows")).toBe("");
  });

  it("carries an explicit rows through the custom property the stylesheet reads", async () => {
    const { wrapper } = await editorWrapper({ rows: 5 });
    expect(wrapper.style.getPropertyValue("--composer-min-rows")).toBe("5");
  });

  it("pins a compact (side-panel) composer to one row", async () => {
    const { wrapper } = await editorWrapper({ compact: true });
    expect(wrapper.style.getPropertyValue("--composer-min-rows")).toBe("1");
  });

  it("tints the box for Plan through the shared frame table", async () => {
    const { container } = await editorWrapper({
      mode: "plan",
      onModeChange: () => {},
    });
    expect(container.querySelector('[class*="border-info/50"]')).not.toBeNull();
  });
});
