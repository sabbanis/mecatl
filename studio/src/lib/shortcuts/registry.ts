/**
 * The single source of truth for keyboard shortcuts. The dispatcher matches
 * live key events against these combos, and the docs page renders its keycaps
 * from the same list — so the documentation can't drift from the behaviour.
 *
 * A shortcut only fires if a component has registered a handler for its `id`
 * (see `useShortcut`); entries without a handler are documentation-only (their
 * behaviour lives inside a component, e.g. Enter to send in the composer).
 *
 * Combos are `+`-joined tokens: `mod` (⌘ on macOS / Ctrl elsewhere), `shift`,
 * `alt`, then a key (`k`, `up`, `enter`, `?`, `/`, `,`, `@`, `esc`). `keycaps()`
 * derives the display and `matchCombo()` matches an event — one grammar, no
 * duplicated key lists.
 */

export interface ShortcutDef {
  readonly id: string;
  readonly combo: string;
  readonly description: string;
  readonly group: string;
  /**
   * Documentation-only: the binding is owned by a component (or the browser
   * itself) and is never dispatched by the global listener — no component
   * registers a handler for it, so the key keeps its native meaning
   * everywhere else. Not user-rebindable.
   */
  readonly fixed?: true;
  /**
   * Dispatched by the global listener (a component registers a handler) but
   * NOT user-rebindable: the literal key is load-bearing. `close.esc` is the
   * one case — Esc's layering under dialogs/menus and its while-typing
   * exemption both depend on it being Esc. Locked rows still take part in
   * collision checks (they are live); `fixed` rows never do.
   */
  readonly locked?: true;
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  // General
  {
    id: "search.open",
    combo: "mod+k",
    description: "Open search",
    group: "General",
  },
  {
    id: "settings.open",
    combo: "mod+,",
    description: "Open settings",
    group: "General",
  },
  {
    id: "shortcuts.open",
    combo: "?",
    description: "Show keyboard shortcuts",
    group: "General",
  },
  {
    id: "shortcuts.open.mod",
    combo: "mod+/",
    description: "Show keyboard shortcuts (also while typing)",
    group: "General",
  },
  {
    id: "chat.toggleList",
    combo: "mod+b",
    description: "Toggle the chat list",
    group: "General",
  },
  // Esc is layered: an open dialog/menu handles its own Escape first (Radix
  // and the composer's autocomplete both consume the event, so the dispatcher
  // never sees it); this binding is the fallback beneath them.
  {
    id: "close.esc",
    combo: "esc",
    description:
      "Clear the selection, close the side panel — or stop the running turn",
    group: "General",
    locked: true,
  },
  // The Agents panel (the TUI's f6 overlay). ⌘⇧L is preventable in Chrome,
  // Firefox and Safari (Safari's own ⇧⌘L "Show Sidebar" yields to a page
  // handler that prevents it); ⌘⇧A/N/T/W are browser-reserved and avoided.
  {
    id: "agents.toggle",
    combo: "mod+shift+l",
    description: "Toggle the agents panel (subagents, parallel runs, teams)",
    group: "General",
  },

  // Chats
  // NB: avoid browser-reserved combos. ⌘N / ⌘⇧N open a new (incognito) window
  // and can't be intercepted, so "New chat" uses ⌘⇧O (preventable) — the same
  // shortcut other web chat apps use.
  {
    id: "chat.new",
    combo: "mod+shift+o",
    description: "New chat",
    group: "Chats",
  },
  {
    id: "chat.prev",
    combo: "up",
    description: "Previous chat",
    group: "Chats",
  },
  { id: "chat.next", combo: "down", description: "Next chat", group: "Chats" },
  {
    id: "chat.next.vim",
    combo: "j",
    description: "Next chat (vim-style)",
    group: "Chats",
  },
  {
    id: "chat.prev.vim",
    combo: "k",
    description: "Previous chat (vim-style)",
    group: "Chats",
  },
  // The `/session` details dialog (exact id + copy, state, placement…). ⌘I /
  // Ctrl+I is unbound in Chrome and Edge, and Firefox's Page Info and
  // Safari's Mail Link both yield to a page handler that prevents it. NOT
  // ⌘⇧I: that is DevTools on Windows/Linux and cannot be intercepted. The
  // composer disables TipTap's italic mark, so ⌘I is free while typing too.
  {
    id: "chat.details",
    combo: "mod+i",
    description: "Session details (exact ID, state, model, placement)",
    group: "Chats",
  },
  // Clear conversation (the TUI's /clear): an empty-history successor with
  // the same settings. ⌘⇧X / Ctrl+Shift+X is unbound in Chrome, Safari and
  // Edge; Firefox's Ctrl+Shift+X only toggles text direction inside a field
  // and yields to a page handler. NOT ⌘⇧L (the Agents panel) and not ⌘⇧K
  // (Firefox's Web Console on Windows/Linux cannot be intercepted).
  {
    id: "chat.clear",
    combo: "mod+shift+x",
    description: "Clear conversation — a fresh chat with the same settings",
    group: "Chats",
  },

  // Conversation — keyboard scrolling of the transcript (the TUI's
  // PgUp/PgDn/Home/End). PgUp/PgDn never insert text, so these also fire
  // while the caret sits in the composer (`comboFiresWhileTyping`). Home/End
  // are deliberately NOT taken: they move the caret within a line while
  // typing; the native keys work once the transcript itself has focus.
  // Ctrl+PgUp/PgDn switch browser tabs and are avoided by construction
  // (`matchCombo` rejects an unrequested mod).
  {
    id: "transcript.pageUp",
    combo: "pageup",
    description: "Scroll the conversation up a page — also while typing",
    group: "Conversation",
  },
  {
    id: "transcript.pageDown",
    combo: "pagedown",
    description: "Scroll the conversation down a page — also while typing",
    group: "Conversation",
  },
  {
    id: "transcript.top",
    combo: "shift+pageup",
    description: "Jump to the top of the conversation",
    group: "Conversation",
  },
  {
    id: "transcript.bottom",
    combo: "shift+pagedown",
    description: "Jump to the bottom and resume auto-follow",
    group: "Conversation",
  },
  // Transcript-scoped select-all (the TUI's ctrl+g). Handled by the
  // transcript container's own keydown, so it fires only while the
  // conversation has focus (click into it); in the composer ⌘A keeps its
  // native meaning. Documentation-only here — the dispatcher never claims it.
  {
    id: "transcript.selectAll",
    combo: "mod+a",
    description:
      "Select the whole conversation — when the conversation has focus",
    group: "Conversation",
    fixed: true,
  },

  // The model + effort picker (the TUI's F7). Dispatched: the composer's
  // picker registers a handler and opens. ⌘⇧F is unbound in Chrome, Firefox,
  // Safari and Edge on every platform — the mnemonic ⌘⇧M is Chrome's profile
  // switcher and Firefox's responsive-design mode, so it stays off it.
  {
    id: "composer.model",
    combo: "mod+shift+f",
    description: "Open the model and effort picker",
    group: "Composer",
  },

  // Composer (behaviour lives in the composer; documentation-only here)
  {
    id: "composer.send",
    combo: "enter",
    description:
      "Send — while the agent is replying: queue or steer, per Settings → Personalize",
    group: "Composer",
    fixed: true,
  },
  {
    id: "composer.newline",
    combo: "shift+enter",
    description:
      "Insert a new line — while the agent is replying: the opposite of your Enter preference",
    group: "Composer",
    fixed: true,
  },
  // The held-queue gestures: only on an EMPTY composer with queued messages
  // (a cancelled or failed run pauses the queue until one of these).
  {
    id: "composer.queue.resume",
    combo: "enter",
    description:
      "On an empty composer with a held queue: send the queued messages",
    group: "Composer",
    fixed: true,
  },
  {
    id: "composer.queue.edit",
    combo: "up",
    description:
      "On an empty composer: pull the queued messages back for editing",
    group: "Composer",
    fixed: true,
  },
  {
    id: "composer.queue.clear",
    combo: "esc",
    description: "On an empty idle composer: clear the queue",
    group: "Composer",
    fixed: true,
  },
  // The double-Esc clear (the TUI's "esc esc"): with nothing else claiming
  // Esc — no selection, no panel, no run — a first press arms, a second
  // within 1.5 s empties the draft. The press rides close.esc and is
  // forwarded to the composer, so this row is documentation-only.
  {
    id: "composer.clearDraft",
    combo: "esc",
    description: "Press twice on an idle draft to clear it",
    group: "Composer",
    fixed: true,
  },
  {
    id: "composer.slash",
    combo: "/",
    description:
      "Slash commands — built-ins (/clear /help /session /retry /diagnostics /compact) and workspace commands",
    group: "Composer",
    fixed: true,
  },
  {
    id: "composer.mention",
    combo: "@",
    description: "Mention an agent, or attach a file",
    group: "Composer",
    fixed: true,
  },
  // Paste (the TUI's ctrl+v). The browser owns ⌘V (it is in the keymap's
  // RESERVED_COMBOS, so nothing can be bound over it); the composer's own
  // paste listener decides what the clipboard becomes. Documentation-only.
  {
    id: "composer.paste",
    combo: "mod+v",
    description:
      "Paste — a clipboard image attaches; a large text paste is staged as [Pasted text #N] and expands on send",
    group: "Composer",
    fixed: true,
  },

  // Scheduled (the /workspace/schedules list). Bare `/` never fires while the
  // caret is in a text field (`comboFiresWhileTyping` is false for it), so
  // typing a slash in the composer or the filter itself stays plain text.
  {
    id: "schedules.filter",
    combo: "/",
    description: "Filter scheduled tasks by name or schedule",
    group: "Scheduled",
  },
] as const;

/** Groups in render order. */
export const SHORTCUT_GROUPS = [
  "General",
  "Chats",
  "Conversation",
  "Composer",
  "Scheduled",
] as const;

const CAP_LABEL: Record<string, string> = {
  mod: "⌘",
  shift: "⇧",
  alt: "⌥",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  enter: "Enter",
  esc: "Esc",
  pageup: "PgUp",
  pagedown: "PgDn",
  // Keys only a user-recorded combo (Settings → Keyboard) can carry.
  space: "Space",
  tab: "Tab",
  home: "Home",
  end: "End",
  delete: "Del",
  backspace: "⌫",
  insert: "Ins",
};

/** Display keycaps for a combo, e.g. "mod+k" → ["⌘", "K"]. */
export function keycaps(combo: string): string[] {
  return combo
    .split("+")
    .map(
      (p) =>
        CAP_LABEL[p] ??
        (p.length === 1 || /^f\d{1,2}$/.test(p) ? p.toUpperCase() : p),
    );
}

const KEY_ALIAS: Record<string, string> = {
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  esc: "escape",
  // `KeyboardEvent.key` reports the space bar as a literal " ".
  space: " ",
};

/** True when a live key event matches a combo. `mod` = ⌘ or Ctrl. */
export function matchCombo(combo: string, e: KeyboardEvent): boolean {
  const parts = combo.split("+");
  const key = parts[parts.length - 1];
  const wantMod = parts.includes("mod");
  const wantShift = parts.includes("shift");
  const wantAlt = parts.includes("alt");
  const hasMod = e.metaKey || e.ctrlKey;
  if (wantMod !== hasMod) return false;
  if (wantAlt !== e.altKey) return false;
  // Only enforce shift when the combo asks for it on SYMBOL keys — "?" carries
  // its own implicit shift in `e.key` (and layouts differ on where it lives).
  // A Caps Lock capital still matches its lower-case combo (no shiftKey). But
  // a HELD shift on a letter or a named key (`pageup`, `enter`, the arrows…)
  // is a DIFFERENT chord: without this, ⇧PgUp would satisfy `pageup` and —
  // the dispatcher firing the first match — `shift+pageup` could never fire;
  // likewise ⌘⇧K would satisfy `mod+k`, so a user could never bind both
  // (Settings → Keyboard treats combos as colliding only when equal).
  if (wantShift && !e.shiftKey) return false;
  if (!wantShift && e.shiftKey && (key.length > 1 || /\p{L}/u.test(key))) {
    return false;
  }
  return e.key.toLowerCase() === (KEY_ALIAS[key] ?? key);
}

/**
 * Keys that never insert text and, in the short composer, would only nudge
 * the caret — so claiming them for the transcript while typing is the natural
 * desktop behaviour. Home/End are NOT here: they move the caret within a line.
 */
const PAGING_KEYS: ReadonlySet<string> = new Set(["pageup", "pagedown"]);

/**
 * True when the combo may fire while the user is typing in an editable field:
 * combos carrying `mod` (the standard desktop-app rule — ⌘/Ctrl chords are
 * commands, not text), bare `esc` (it never inserts text, and Esc must
 * interrupt a streaming run even while the caret sits in the composer), and
 * the paging keys PgUp/PgDn with or without shift (they scroll the transcript
 * from the composer, as in the TUI).
 */
export function comboFiresWhileTyping(combo: string): boolean {
  const parts = combo.split("+");
  return (
    parts.includes("mod") ||
    combo === "esc" ||
    PAGING_KEYS.has(parts[parts.length - 1])
  );
}

/**
 * The description to SHOW for a shortcut, given the user's current Enter
 * preference (Settings → Personalize). The registry's own descriptions stay
 * static; only the two composer Enter rows are phrased live, so the help page
 * says what Enter and Shift+Enter actually do right now (queue vs steer)
 * instead of pointing at the setting. Every other shortcut returns its
 * registry description unchanged.
 */
export function describeShortcut(
  def: ShortcutDef,
  enterBehavior: "queue" | "steer",
): string {
  const onEnter =
    enterBehavior === "queue" ? "queue the message" : "steer the agent";
  const onShiftEnter =
    enterBehavior === "queue" ? "steer the agent" : "queue the message";
  switch (def.id) {
    case "composer.send":
      return `Send — while the agent is replying: ${onEnter}`;
    case "composer.newline":
      return `Insert a new line — while the agent is replying: ${onShiftEnter}`;
    default:
      return def.description;
  }
}
