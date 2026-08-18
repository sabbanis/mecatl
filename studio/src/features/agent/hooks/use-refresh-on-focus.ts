"use client";

import { useEffect } from "react";

/**
 * Re-runs `refresh` when the tab regains focus.
 *
 * These pages probe a local daemon once on mount, and a probe that happens to
 * land during an auth redirect (or while the daemon is restarting) resolves as
 * "not live" — leaving the page showing demo data with no way back except a
 * manual reload. Re-probing on focus makes that state self-healing.
 */
export function useRefreshOnFocus(refresh: () => Promise<void>) {
  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);
}
