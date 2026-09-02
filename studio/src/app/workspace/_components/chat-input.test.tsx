import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttachmentPill, ChatInput } from "./chat-input";

// jsdom cannot host a live ProseMirror view (TipTap mounts asynchronously and
// owns its own capture-phase handlers), so the editor is stubbed to its
// pre-mount (null) state and this file covers the composer chrome around it.
vi.mock("@tiptap/react", () => ({
  useEditor: () => null,
  EditorContent: () => <div data-testid="composer-editor" />,
}));

describe("ChatInput", () => {
  it("renders the composer chrome with the send button disabled while empty", () => {
    const { getByLabelText, getByTestId } = render(<ChatInput />);
    expect(getByTestId("composer-editor")).toBeTruthy();
    expect((getByLabelText("Send message") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});

describe("AttachmentPill", () => {
  // jsdom has no object-URL implementation; stub the pair the pill uses.
  const createObjectURL = vi.fn(() => "blob:thumb");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a thumbnail for an image file and revokes its object URL on unmount", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    const { container, unmount } = render(
      <AttachmentPill file={file} onRemove={() => {}} />,
    );
    await waitFor(() =>
      expect(container.querySelector("img")?.getAttribute("src")).toBe(
        "blob:thumb",
      ),
    );
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:thumb");
  });

  it("shows a file-kind glyph, not a thumbnail, for a non-image file", () => {
    const file = new File(["x"], "report.pdf", { type: "application/pdf" });
    const { container } = render(
      <AttachmentPill file={file} onRemove={() => {}} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-label="PDF"]')).toBeTruthy();
    expect(container.textContent).toContain("report.pdf");
  });
});
