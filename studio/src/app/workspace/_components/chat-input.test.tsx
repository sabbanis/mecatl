import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "./chat-input";

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
