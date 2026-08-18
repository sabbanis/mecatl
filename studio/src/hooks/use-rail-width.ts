"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Default storage key + expanded width, and the drag bounds. */
export const RAIL_STORAGE_KEY = "console-rail-width";
/** Chat starts collapsed, with its own remembered width. */
export const RAIL_STORAGE_KEY_CHAT = "console-rail-width-chat";
/** Floor for a non-collapsible rail — fits the longest nav label, never icons. */
export const RAIL_LABELED_MIN = 188;
/** Starting width: a little more than the labelled minimum. */
export const RAIL_DEFAULT_WIDTH = 204;
/** Floor for a collapsible rail (icon strip); kept for the opt-in collapse path. */
export const RAIL_MIN_WIDTH = 64;
export const RAIL_MAX_WIDTH = 400;
/** Below this dragged width a collapsible rail snaps to the icon-only strip. */
export const RAIL_COLLAPSE_AT = 176;

const listeners = new Set<() => void>();

function readWidth(storageKey: string, defaultWidth: number): number {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return defaultWidth;
  const n = Number(stored);
  return Number.isFinite(n)
    ? Math.max(RAIL_MIN_WIDTH, Math.min(RAIL_MAX_WIDTH, n))
    : defaultWidth;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Persisted width of the console's left rail, keyed so different contexts (e.g.
 * Chat vs the rest of the console) can remember their own width. Backed by a
 * localStorage external store; dragging below `RAIL_COLLAPSE_AT` collapses the
 * rail to the icon-only strip.
 */
export function useRailWidth(
  storageKey: string = RAIL_STORAGE_KEY,
  defaultWidth: number = RAIL_DEFAULT_WIDTH,
) {
  const width = useSyncExternalStore(
    subscribe,
    () => readWidth(storageKey, defaultWidth),
    () => defaultWidth,
  );

  const setWidth = useCallback(
    (next: number) => {
      const clamped = Math.max(RAIL_MIN_WIDTH, Math.min(RAIL_MAX_WIDTH, next));
      localStorage.setItem(storageKey, String(clamped));
      for (const fn of listeners) fn();
    },
    [storageKey],
  );

  return [width, setWidth] as const;
}
