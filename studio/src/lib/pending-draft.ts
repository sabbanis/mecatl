/**
 * A one-shot handoff of composer text ACROSS a route change: a surface
 * outside the chat (Settings → About → "Send to a new chat") stashes the text
 * it wants sent, navigates to the draft chat, and the workspace pre-fills its
 * composer from the stash on mount. The user still presses Enter — in a web
 * UI the report is visible before it leaves.
 *
 * sessionStorage, like draft-store.ts: survives the in-app navigation, dies
 * with the tab. Take-once semantics (`takePendingDraft` clears on read) so a
 * later visit to the draft never resurrects an old handoff. Every access is
 * try/catch-guarded (storage disabled, full, or the SSR pass) and degrades
 * to "nothing pending"; nothing here ever leaves the browser on its own.
 */

export const PENDING_DRAFT_KEY = "mecatl-studio.pending-draft";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** Stores `text` for the next draft composer to pick up. False when the
 *  browser has no usable storage — the caller then tells the user to paste. */
export function stashPendingDraft(text: string): boolean {
  const store = storage();
  if (!store) return false;
  try {
    if (text === "") {
      store.removeItem(PENDING_DRAFT_KEY);
    } else {
      store.setItem(PENDING_DRAFT_KEY, text);
    }
    return true;
  } catch {
    return false;
  }
}

/** The pending text, cleared as it is read; null when nothing is pending. */
export function takePendingDraft(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const text = store.getItem(PENDING_DRAFT_KEY);
    if (text === null) return null;
    store.removeItem(PENDING_DRAFT_KEY);
    return text === "" ? null : text;
  } catch {
    return null;
  }
}
