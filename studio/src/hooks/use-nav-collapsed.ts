"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether the console's main left nav rail is collapsed to its icons-only
 * state. This is an explicit user choice — a toggle in the rail footer — kept
 * separate from the drag-to-resize width (`use-rail-width`): the toggle is
 * authoritative, so a collapsed rail stays icon-only regardless of its
 * remembered width. Backed by a localStorage external store so the choice
 * persists across reloads and stays in sync between every mounted rail.
 * Defaults to expanded (false).
 */
const STORAGE_KEY = "console-rail-collapsed";

const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useNavCollapsed() {
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setCollapsed = useCallback((next: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(next));
    for (const fn of listeners) fn();
  }, []);

  return [collapsed, setCollapsed] as const;
}
