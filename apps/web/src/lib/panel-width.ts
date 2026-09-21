// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useState } from "react";

const storageKey = "studio.chat.panelWidth";
const changedEvent = "studio:panel-width-changed";
export const defaultPanelWidth = 256;
export const minPanelWidth = 220;
export const maxPanelWidth = 420;

export function clampPanelWidth(value: number) {
  return Math.round(Math.min(maxPanelWidth, Math.max(minPanelWidth, value)));
}

export function usePanelWidth() {
  const [value, setValueState] = useState(readPanelWidth);
  useEffect(() => {
    const synchronize = () => setValueState(readPanelWidth());
    window.addEventListener(changedEvent, synchronize);
    window.addEventListener("storage", synchronize);
    return () => {
      window.removeEventListener(changedEvent, synchronize);
      window.removeEventListener("storage", synchronize);
    };
  }, []);

  const setValue = useCallback((next: number) => {
    const value = clampPanelWidth(next);
    setValueState(value);
    try {
      if (value === defaultPanelWidth) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, String(value));
    } catch {
      // Resizing still works for this page if browser storage is unavailable.
    }
    window.dispatchEvent(new Event(changedEvent));
  }, []);
  return { setValue, value };
}

function readPanelWidth() {
  try {
    const stored = Number.parseFloat(window.localStorage.getItem(storageKey) ?? "");
    return Number.isFinite(stored) ? clampPanelWidth(stored) : defaultPanelWidth;
  } catch {
    return defaultPanelWidth;
  }
}
