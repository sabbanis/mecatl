"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Cosmetic, browser-local identity preferences: the agent's display name and
 * an optional profile picture. Neither has a daemon concept — there is no
 * server-side "agent name" or user-identity record — so these live in
 * localStorage only, same as the appearance/notification prefs on this page.
 */
const AGENT_NAME_KEY = "mecatl-studio.agent-name";
const AVATAR_KEY = "mecatl-studio.user-avatar";
const SESSION_LIST_SIDE_KEY = "mecatl-studio.session-list-side";
const DEFAULT_AGENT_NAME = "Mecatl";

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

/** The agent's display name shown in chat, e.g. "Mecatl" or "Astra". */
export function useAgentDisplayName() {
  const [name, setNameState] = useState(DEFAULT_AGENT_NAME);
  useEffect(() => {
    const stored = readLocalStorage(AGENT_NAME_KEY);
    if (stored) setNameState(stored);
  }, []);

  const setName = useCallback((next: string) => {
    const trimmed = next.trim();
    const value = trimmed || DEFAULT_AGENT_NAME;
    setNameState(value);
    writeLocalStorage(AGENT_NAME_KEY, trimmed ? value : null);
  }, []);

  return { name, setName, defaultName: DEFAULT_AGENT_NAME };
}

/** The user's profile picture, stored as a data URL (no upload endpoint exists). */
export function useUserAvatar() {
  const [avatarUrl, setAvatarUrlState] = useState<string | null>(null);
  useEffect(() => {
    setAvatarUrlState(readLocalStorage(AVATAR_KEY));
  }, []);

  const setAvatarUrl = useCallback((next: string | null) => {
    setAvatarUrlState(next);
    writeLocalStorage(AVATAR_KEY, next);
  }, []);

  return { avatarUrl, setAvatarUrl };
}

export type FontScale = "s" | "m" | "l" | "xl";

const FONT_SCALE_KEY = "mecatl-studio.font-scale";
/** Root font-size per step; everything downstream is rem-based, so scaling
 *  the root scales the whole UI. */
const FONT_SCALE_SIZE: Record<FontScale, string> = {
  s: "87.5%",
  m: "",
  l: "112.5%",
  xl: "125%",
};

function applyFontScale(scale: FontScale) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = FONT_SCALE_SIZE[scale];
}

/**
 * UI text-size preference, browser-local. The hook both stores the choice
 * and applies it to the root element; mount one instance app-wide (see
 * ClientProviders) so the stored scale takes effect on load.
 */
export function useFontScale() {
  const [scale, setScaleState] = useState<FontScale>("m");
  useEffect(() => {
    const stored = readLocalStorage(FONT_SCALE_KEY);
    if (stored && stored in FONT_SCALE_SIZE) {
      const value = stored as FontScale;
      setScaleState(value);
      applyFontScale(value);
    }
  }, []);

  const setScale = useCallback((next: FontScale) => {
    setScaleState(next);
    writeLocalStorage(FONT_SCALE_KEY, next === "m" ? null : next);
    applyFontScale(next);
  }, []);

  return { scale, setScale };
}

export type SessionListSide = "left" | "right";

/**
 * Which side of the chat the session list docks on. The thread and document
 * panels stay on the right regardless — only the list moves.
 */
export function useSessionListSide() {
  const [side, setSideState] = useState<SessionListSide>("right");
  useEffect(() => {
    if (readLocalStorage(SESSION_LIST_SIDE_KEY) === "left") {
      setSideState("left");
    }
  }, []);

  const setSide = useCallback((next: SessionListSide) => {
    setSideState(next);
    writeLocalStorage(SESSION_LIST_SIDE_KEY, next === "left" ? "left" : null);
  }, []);

  return { side, setSide };
}
