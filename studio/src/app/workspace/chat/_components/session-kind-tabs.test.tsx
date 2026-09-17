import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionTab } from "@/lib/session-kinds";
import { memoryStorage } from "@/test/memory-storage";
import {
  SESSION_TAB_STORAGE_KEY,
  SessionKindTabs,
  StorageMaintenanceLink,
  useSessionTab,
  visibleSessionTabs,
} from "./session-kind-tabs";

/**
 * The sidebar's kind tabs: Drafts appears only when the daemon can classify
 * drafts, Other only while it has rows, counts ride each tab, the arrow
 * keys move the selection, and the chosen tab is remembered per browser —
 * falling back to Chats (without overwriting the memory) when the
 * remembered tab is not offered.
 */

const counts: Record<SessionTab, number> = {
  chats: 12,
  runs: 3,
  scheduled: 0,
  drafts: 1,
  other: 2,
};

// jsdom here has no localStorage of its own; the same in-memory stand-in the
// appearance page's tests use.
beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("visibleSessionTabs", () => {
  it("offers Drafts on the feature and Other only when populated", () => {
    expect(visibleSessionTabs({ showDrafts: false, showOther: false })).toEqual(
      ["chats", "runs", "scheduled"],
    );
    expect(visibleSessionTabs({ showDrafts: true, showOther: true })).toEqual([
      "chats",
      "runs",
      "scheduled",
      "drafts",
      "other",
    ]);
  });
});

describe("SessionKindTabs", () => {
  it("renders a tablist with counts, hiding Drafts and Other when not offered", () => {
    const onChange = vi.fn();
    render(
      <SessionKindTabs
        value="chats"
        onChange={onChange}
        counts={counts}
        showDrafts={false}
        showOther={false}
      />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Chats12",
      "Runs3",
      "Scheduled",
    ]);
    expect(screen.getByRole("tab", { name: /Chats/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.queryByRole("tab", { name: /Drafts/ })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Runs/ }));
    expect(onChange).toHaveBeenCalledWith("runs");
  });

  it("offers Drafts and Other when told to, and the arrow keys move the selection", () => {
    const onChange = vi.fn();
    render(
      <SessionKindTabs
        value="runs"
        onChange={onChange}
        counts={counts}
        showDrafts
        showOther
      />,
    );
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    const tablist = screen.getByRole("tablist", { name: "Session kinds" });
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("scheduled");
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("chats");
    fireEvent.keyDown(tablist, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("other");
    fireEvent.keyDown(tablist, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("chats");
    // Only the selected tab sits in the Tab order (roving tabindex).
    expect(screen.getByRole("tab", { name: /Runs/ })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("tab", { name: /Chats/ })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});

describe("useSessionTab", () => {
  it("defaults to Chats, remembers a pick, and reads it back on mount", () => {
    const first = renderHook(() =>
      useSessionTab({ showDrafts: true, showOther: true }),
    );
    expect(first.result.current.tab).toBe("chats");
    act(() => first.result.current.setTab("runs"));
    expect(first.result.current.tab).toBe("runs");
    expect(window.localStorage.getItem(SESSION_TAB_STORAGE_KEY)).toBe("runs");

    const second = renderHook(() =>
      useSessionTab({ showDrafts: true, showOther: true }),
    );
    expect(second.result.current.tab).toBe("runs");
  });

  it("falls back to Chats when the remembered tab is not offered, without forgetting it", () => {
    window.localStorage.setItem(SESSION_TAB_STORAGE_KEY, "drafts");
    const { result, rerender } = renderHook(
      (props: { showDrafts: boolean; showOther: boolean }) =>
        useSessionTab(props),
      { initialProps: { showDrafts: false, showOther: false } },
    );
    expect(result.current.tab).toBe("chats");
    expect(window.localStorage.getItem(SESSION_TAB_STORAGE_KEY)).toBe("drafts");
    // The daemon starts advertising drafts: the remembered tab comes back.
    rerender({ showDrafts: true, showOther: false });
    expect(result.current.tab).toBe("drafts");
  });

  it("ignores a stored value outside the tab vocabulary", () => {
    window.localStorage.setItem(SESSION_TAB_STORAGE_KEY, "bogus");
    const { result } = renderHook(() =>
      useSessionTab({ showDrafts: true, showOther: true }),
    );
    expect(result.current.tab).toBe("chats");
  });
});

describe("StorageMaintenanceLink", () => {
  it("points at the Storage settings page", () => {
    render(<StorageMaintenanceLink />);
    expect(
      screen.getByRole("link", { name: "Storage & maintenance" }),
    ).toHaveAttribute("href", "/workspace/settings/storage");
  });
});
