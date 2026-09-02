"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Cosmetic, browser-local identity preferences: the agent's display name and
 * an optional profile picture. Neither has a daemon concept — there is no
 * server-side "agent name" or user-identity record — so these live in
 * localStorage only, same as the appearance/notification prefs on this page.
 */

function readLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage disabled or full — the preference just doesn't persist.
  }
}

const UI_SCALE_MIN = 0.85;
const UI_SCALE_MAX = 1.3;

const UI_SCALE_KEY = "mecatl-studio.ui-scale";

/** The root font-size is calc()'d against --ui-scale (see globals.css), so
 *  the multiplier composes with the per-viewport defaults instead of
 *  replacing them. */
function applyUiScale(scale: number) {
  if (typeof document === "undefined") return;
  if (scale === 1) {
    document.documentElement.style.removeProperty("--ui-scale");
  } else {
    document.documentElement.style.setProperty("--ui-scale", String(scale));
  }
}

function clampUiScale(value: number): number {
  const stepped = Math.round(value * 20) / 20;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, stepped));
}

/**
 * Interface scale preference, browser-local: a multiplier over the UI's
 * default type scale (everything downstream is rem-based). Mount one
 * instance app-wide (see ClientProviders) so the stored scale applies on
 * load.
 */
export function useUiScale() {
  const [scale, setScaleState] = useState(1);
  useEffect(() => {
    const stored = Number.parseFloat(readLocalStorage(UI_SCALE_KEY) ?? "");
    if (Number.isFinite(stored)) {
      const value = clampUiScale(stored);
      setScaleState(value);
      applyUiScale(value);
    }
  }, []);

  const setScale = useCallback((next: number) => {
    const value = clampUiScale(next);
    setScaleState(value);
    writeLocalStorage(UI_SCALE_KEY, value === 1 ? null : String(value));
    applyUiScale(value);
  }, []);

  return { scale, setScale };
}
