"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchHarnessSessionMode,
  setHarnessSessionMode,
} from "@/lib/harness/client";
import type { SessionPermissionMode } from "@/lib/protocol";
import { useRuntimeStatus } from "../runtime-status";

/**
 * The permission mode for one chat's composer Mode selector.
 *
 * Two shapes, one seam:
 * - A LIVE session (`sessionId` set): the mode is read from the session
 *   snapshot on open, and a change round-trips through POST /mode, adopting
 *   the daemon's echo (and rolling back when the daemon refuses — e.g. the
 *   aggregate rejects a mid-turn change).
 * - A DRAFT (`sessionId` null): the selection is held as pending local state;
 *   the caller reads it via `modeRef` at session-creation time and passes it
 *   into the create body.
 */
export function useSessionMode(
  sessionId: string | null,
  options?: {
    /**
     * True while the session's run is live (streaming, or parked on an
     * approval/authorization). The daemon rejects a mid-turn mode change, so
     * a change made while busy is HELD as `pendingMode` — the TUI's
     * `mode <target> pending` — and POSTed once busy clears.
     */
    busy?: boolean;
  },
) {
  const busy = options?.busy ?? false;
  const { connected } = useRuntimeStatus();
  const [mode, setMode] = useState<SessionPermissionMode>("default");
  // Mirror for callers that need the value at an async boundary (the chat
  // hook mints the draft's session mid-send, after this render's closure).
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // The deferred switch, keyed to the chat it was made on: a switch held for
  // one chat must never land on the next one, so a stale entry is ignored
  // (never flushed) rather than raced against the reset below.
  const [pending, setPending] = useState<{
    sessionId: string;
    mode: SessionPermissionMode;
  } | null>(null);
  const pendingMode =
    pending && pending.sessionId === sessionId ? pending.mode : null;

  /** The live round-trip: optimistic set, then the echo or the rollback. */
  const applyMode = useCallback((id: string, next: SessionPermissionMode) => {
    const previous = modeRef.current;
    setMode(next); // optimistic; the echo or the rollback settles it
    void (async () => {
      try {
        const echoed = await setHarnessSessionMode(id, next);
        setMode(echoed);
      } catch {
        // The daemon refused (mid-turn, or the session vanished): the
        // selector snaps back rather than lying about the posture.
        setMode(previous);
      }
    })();
  }, []);

  // Switching chats drops a held switch (a reconnect blip does NOT: the
  // pending value survives `connected` flapping and lands once reachable).
  useEffect(() => {
    setPending((held) => (held && held.sessionId === sessionId ? held : null));
  }, [sessionId]);

  // The held switch lands once the run has ended and the daemon is
  // reachable; the echo/rollback then settles the label exactly as a direct
  // change does. Busy is the caller's `isStreaming` — a run parked on an
  // approval is still busy, so the switch keeps waiting there.
  useEffect(() => {
    if (busy || !connected || !sessionId || !pendingMode) return;
    setPending(null);
    applyMode(sessionId, pendingMode);
  }, [busy, connected, sessionId, pendingMode, applyMode]);

  useEffect(() => {
    // Opening a chat (or going back to the draft) resets, then adopts the
    // snapshot's mode. A just-minted draft re-fetches its own creation mode —
    // momentarily "default", then self-consistent.
    setMode("default");
    if (!sessionId || !connected) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const fetched = await fetchHarnessSessionMode(
          sessionId,
          controller.signal,
        );
        if (!controller.signal.aborted) setMode(fetched);
      } catch {
        // Unknown snapshot mode: keep the default label. Changing the mode
        // still round-trips normally.
      }
    })();
    return () => controller.abort();
  }, [sessionId, connected]);

  const changeMode = useCallback(
    (next: SessionPermissionMode) => {
      if (!sessionId) {
        // Draft: held pending; applied when the session is created.
        setMode(next);
        return;
      }
      if (busy) {
        // Mid-run: hold it (picking the confirmed mode back cancels the hold
        // instead of queuing a no-op round-trip).
        setPending(next === modeRef.current ? null : { sessionId, mode: next });
        return;
      }
      applyMode(sessionId, next);
    },
    [sessionId, busy, applyMode],
  );

  /**
   * Re-reads the snapshot's mode. The daemon flips a session's mode on its
   * own at a plan-run terminal (plan approved → default / acceptEdits), so
   * the composer's Mode pill must re-adopt the daemon's word once a run ends
   * — a stale "Plan" would claim a posture the execution run no longer has.
   * No-op for a draft; a failed read keeps the current label.
   */
  const refreshMode = useCallback(() => {
    if (!sessionId || !connected) return;
    void (async () => {
      try {
        setMode(await fetchHarnessSessionMode(sessionId));
      } catch {
        // Unknown or unreadable snapshot mode: keep what we show.
      }
    })();
  }, [sessionId, connected]);

  return { mode, modeRef, changeMode, refreshMode, pendingMode };
}
