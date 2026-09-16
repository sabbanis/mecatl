import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShortcutsProvider, useShortcut } from "./use-shortcuts";

/** A component that registers one shortcut handler, like ChatView does. */
function Bind({ id, onFire }: { id: string; onFire: () => void }) {
  useShortcut(id, onFire);
  return null;
}

function mount(bindings: Record<string, () => void>) {
  return render(
    <ShortcutsProvider>
      {Object.entries(bindings).map(([id, fn]) => (
        <Bind key={id} id={id} onFire={fn} />
      ))}
      <textarea aria-label="composer" />
    </ShortcutsProvider>,
  );
}

function focusComposer(): HTMLTextAreaElement {
  const composer = screen.getByLabelText("composer") as HTMLTextAreaElement;
  composer.focus();
  expect(document.activeElement).toBe(composer);
  return composer;
}

describe("ShortcutsProvider dispatch while typing", () => {
  it("fires transcript.pageUp on PageUp while the caret sits in a text field", () => {
    const pageUp = vi.fn();
    mount({ "transcript.pageUp": pageUp });
    const composer = focusComposer();

    // fireEvent returns false when a listener called preventDefault — the
    // dispatcher claims the key so the field's caret doesn't also move.
    const notPrevented = fireEvent.keyDown(composer, { key: "PageUp" });

    expect(pageUp).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it("fires transcript.pageDown on PageDown while typing", () => {
    const pageDown = vi.fn();
    mount({ "transcript.pageDown": pageDown });
    fireEvent.keyDown(focusComposer(), { key: "PageDown" });
    expect(pageDown).toHaveBeenCalledTimes(1);
  });

  it("routes ⇧PageUp / ⇧PageDown to the top/bottom jumps, not the page steps", () => {
    const pageUp = vi.fn();
    const pageDown = vi.fn();
    const top = vi.fn();
    const bottom = vi.fn();
    mount({
      "transcript.pageUp": pageUp,
      "transcript.pageDown": pageDown,
      "transcript.top": top,
      "transcript.bottom": bottom,
    });
    const composer = focusComposer();

    fireEvent.keyDown(composer, { key: "PageUp", shiftKey: true });
    fireEvent.keyDown(composer, { key: "PageDown", shiftKey: true });

    expect(top).toHaveBeenCalledTimes(1);
    expect(bottom).toHaveBeenCalledTimes(1);
    expect(pageUp).not.toHaveBeenCalled();
    expect(pageDown).not.toHaveBeenCalled();
  });

  it("leaves the browser's Ctrl+PageUp tab-switch chord alone", () => {
    const pageUp = vi.fn();
    const top = vi.fn();
    mount({ "transcript.pageUp": pageUp, "transcript.top": top });
    const notPrevented = fireEvent.keyDown(focusComposer(), {
      key: "PageUp",
      ctrlKey: true,
    });
    expect(pageUp).not.toHaveBeenCalled();
    expect(top).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
  });

  it("keeps a plain letter as text while typing, but fires it elsewhere", () => {
    const next = vi.fn();
    mount({ "chat.next.vim": next });

    fireEvent.keyDown(focusComposer(), { key: "j" });
    expect(next).not.toHaveBeenCalled();

    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(document.body, { key: "j" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("treats a contenteditable editor (the TipTap composer) as typing", () => {
    const next = vi.fn();
    const pageUp = vi.fn();
    const { container } = mount({
      "chat.next.vim": next,
      "transcript.pageUp": pageUp,
    });
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    editor.tabIndex = 0;
    // jsdom's ElementContentEditable is a stub, so `isContentEditable` is
    // undefined there; the dispatcher reads exactly that property.
    Object.defineProperty(editor, "isContentEditable", { value: true });
    container.appendChild(editor);
    editor.focus();
    expect(document.activeElement).toBe(editor);

    fireEvent.keyDown(editor, { key: "j" });
    fireEvent.keyDown(editor, { key: "PageUp" });

    expect(next).not.toHaveBeenCalled();
    expect(pageUp).toHaveBeenCalledTimes(1);
  });

  it("ignores an event a closer layer already consumed", () => {
    const pageUp = vi.fn();
    mount({ "transcript.pageUp": pageUp });
    const composer = focusComposer();

    const consumed = new KeyboardEvent("keydown", {
      key: "PageUp",
      bubbles: true,
      cancelable: true,
    });
    consumed.preventDefault();
    composer.dispatchEvent(consumed);

    expect(pageUp).not.toHaveBeenCalled();
  });

  it("does nothing for an id without a registered handler", () => {
    const pageUp = vi.fn();
    mount({ "transcript.pageUp": pageUp });
    const notPrevented = fireEvent.keyDown(focusComposer(), {
      key: "PageDown",
    });
    expect(pageUp).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
  });
});
