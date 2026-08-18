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
