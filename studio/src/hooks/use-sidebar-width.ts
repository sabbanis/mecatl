"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "workspace-sidebar-width";
const DEFAULT_WIDTH = 340;
const MIN_WIDTH = 200;
const MAX_WIDTH = 720;

const listeners = new Set<() => void>();

function getSnapshot(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_WIDTH;
  const n = Number(stored);
  return Number.isFinite(n)
    ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n))
    : DEFAULT_WIDTH;
}

function getServerSnapshot(): number {
  return DEFAULT_WIDTH;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useSidebarWidth() {
  const width = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setWidth = useCallback((next: number) => {
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, next));
    localStorage.setItem(STORAGE_KEY, String(clamped));
    for (const fn of listeners) fn();
  }, []);

  return [width, setWidth] as const;
}
