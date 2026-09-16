import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStorage } from "@/test/memory-storage";
import {
  useShowStarterPrompts,
  useShowToolCalls,
  useWelcomeDismissed,
} from "./profile-preferences";

const KEY = "mecatl-studio.show-tool-calls";

/**
 * The Show Tools preference is GLOBAL and persisted: it must round-trip
 * through localStorage (survive a "reload" = a fresh hook mount), keep two
 * simultaneously mounted instances in sync (the chat view and the thread
 * panel both show the toggle), and store nothing while off.
 */
describe("useShowToolCalls", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("defaults off and stores nothing until enabled", () => {
    const { result } = renderHook(() => useShowToolCalls());
    expect(result.current.showToolCalls).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("round-trips through storage across mounts", () => {
    const first = renderHook(() => useShowToolCalls());
    act(() => first.result.current.setShowToolCalls(true));
    expect(window.localStorage.getItem(KEY)).toBe("1");
    first.unmount();

    // A fresh mount (a reload, a different session's chat) reads it back.
    const second = renderHook(() => useShowToolCalls());
    expect(second.result.current.showToolCalls).toBe(true);

    // Turning it off removes the key rather than storing "0" forever.
    act(() => second.result.current.setShowToolCalls(false));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(second.result.current.showToolCalls).toBe(false);
  });

  it("keeps two mounted instances in sync (chat menu + thread panel)", () => {
    const chat = renderHook(() => useShowToolCalls());
    const thread = renderHook(() => useShowToolCalls());
    act(() => thread.result.current.setShowToolCalls(true));
    expect(chat.result.current.showToolCalls).toBe(true);
    expect(thread.result.current.showToolCalls).toBe(true);
  });
});

/**
 * The first-run welcome card is a ONE-TIME decision: dismissing it persists
 * (a reload — a fresh mount — must not bring it back), a fresh browser shows
 * it (nothing stored), and Settings' "Show again" clears the key rather than
 * storing "0".
 */
describe("useWelcomeDismissed", () => {
  const WELCOME_KEY = "mecatl-studio.welcome-dismissed";

  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("defaults to not dismissed and stores nothing", () => {
    const { result } = renderHook(() => useWelcomeDismissed());
    expect(result.current.dismissed).toBe(false);
    expect(window.localStorage.getItem(WELCOME_KEY)).toBeNull();
  });

  it("persists a dismissal across mounts and clears it on show-again", () => {
    const first = renderHook(() => useWelcomeDismissed());
    act(() => first.result.current.setDismissed(true));
    expect(first.result.current.dismissed).toBe(true);
    expect(window.localStorage.getItem(WELCOME_KEY)).toBe("1");
    first.unmount();

    // A reload (fresh mount) reads the dismissal back — the card stays gone.
    const second = renderHook(() => useWelcomeDismissed());
    expect(second.result.current.dismissed).toBe(true);

    // "Show again" returns to the default by removing the key.
    act(() => second.result.current.setDismissed(false));
    expect(second.result.current.dismissed).toBe(false);
    expect(window.localStorage.getItem(WELCOME_KEY)).toBeNull();
  });
});

/**
 * Starter prompts are SHOWN by default (the --no-banner analogue is an
 * opt-out): the key exists only while hidden, and turning them back on
 * removes it.
 */
describe("useShowStarterPrompts", () => {
  const HIDE_KEY = "mecatl-studio.hide-starter-prompts";

  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });

  it("defaults to shown and stores nothing", () => {
    const { result } = renderHook(() => useShowStarterPrompts());
    expect(result.current.show).toBe(true);
    expect(window.localStorage.getItem(HIDE_KEY)).toBeNull();
  });

  it("round-trips hidden across mounts and removes the key when shown again", () => {
    const first = renderHook(() => useShowStarterPrompts());
    act(() => first.result.current.setShow(false));
    expect(first.result.current.show).toBe(false);
    expect(window.localStorage.getItem(HIDE_KEY)).toBe("1");
    first.unmount();

    const second = renderHook(() => useShowStarterPrompts());
    expect(second.result.current.show).toBe(false);

    act(() => second.result.current.setShow(true));
    expect(second.result.current.show).toBe(true);
    expect(window.localStorage.getItem(HIDE_KEY)).toBeNull();
  });
});
