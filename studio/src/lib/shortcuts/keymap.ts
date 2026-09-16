"use client";

import { useCallback, useSyncExternalStore } from "react";
import { SHORTCUTS, type ShortcutDef } from "./registry";

/**
 * User-remappable shortcuts — the TUI's `keymap` setting, for the browser.
 *
 * The registry stays the source of truth for WHAT each shortcut does; this
 * module owns WHICH keys fire it. Overrides live in this browser's
 * localStorage (a keymap is a per-person UI preference, the same tier as the
 * UI scale or the Enter behaviour — not an operator `settings.yaml` knob), and
 * the dispatcher, the help reference and the ⌘K hint all read EFFECTIVE
 * bindings from here, so a remapped key is dispatched, documented and hinted
 * consistently.
 *
 * Reading is fail-safe: an unknown id, an invalid or browser-reserved combo,
 * or an override that would collide with another live shortcut is dropped, so
 * a corrupt keymap can never disable or double-bind a shortcut.
 */

export const KEYMAP_STORAGE_KEY = "mecatl-studio.keymap";

/** A registry row plus the combo that actually fires it right now. */
export type ShortcutBinding = ShortcutDef & {
  readonly effectiveCombo: string;
  /** True when a user override (not the registry default) is in effect. */
  readonly custom: boolean;
};

export type BindingError =
  | { reason: "invalid" }
  | { reason: "reserved" }
  | { reason: "collision"; withId: string; withDescription: string };

/** True for rows a user may rebind: not documentation-only, not locked. */
export function isRebindable(def: ShortcutDef): boolean {
  return !def.fixed && !def.locked;
}

// ---------------------------------------------------------------------------
// Combo grammar
// ---------------------------------------------------------------------------

const MODIFIER_ALIAS: Record<string, "mod" | "shift" | "alt"> = {
  mod: "mod",
  cmd: "mod",
  command: "mod",
  meta: "mod",
  ctrl: "mod",
  control: "mod",
  "⌘": "mod",
  shift: "shift",
  "⇧": "shift",
  alt: "alt",
  option: "alt",
  opt: "alt",
  "⌥": "alt",
};

const KEY_ALIAS: Record<string, string> = {
  escape: "esc",
  arrowup: "up",
  "↑": "up",
  arrowdown: "down",
  "↓": "down",
  arrowleft: "left",
  "←": "left",
  arrowright: "right",
  "→": "right",
  return: "enter",
  pgup: "pageup",
  pgdn: "pagedown",
  spacebar: "space",
  " ": "space",
  del: "delete",
  ins: "insert",
};

/**
 * The named (multi-character) keys a combo may end in. Every entry lowercases
 * from the DOM `KeyboardEvent.key` name — or is aliased to it by the
 * registry's `matchCombo` (`esc`, the arrows, `space`) — so a stored combo
 * always matches the live event it was recorded from.
 */
const NAMED_KEYS: ReadonlySet<string> = new Set([
  "esc",
  "up",
  "down",
  "left",
  "right",
  "enter",
  "space",
  "tab",
  "pageup",
  "pagedown",
  "home",
  "end",
  "delete",
  "backspace",
  "insert",
  ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`),
]);

/**
 * Canonicalise a combo written by a person or read from storage:
 * `Cmd+Shift+K` → `mod+shift+k`, `Ctrl+PgUp` → `mod+pageup`, `Escape` → `esc`,
 * `option+arrowdown` → `alt+down`. Tokens split on `+` or whitespace; the
 * output is always `mod`, `shift`, `alt` (each optional, in that order) then
 * exactly one key. A shifted symbol or digit drops its `shift` — the
 * character itself already carries it (`?`, not `shift+/`), which is how the
 * registry spells `?`. Returns null for anything else: no key, two keys, an
 * unknown named key, or a modifier on its own.
 */
export function normalizeCombo(input: string): string | null {
  const tokens = input
    .toLowerCase()
    .split(/[+\s]+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;
  let mod = false;
  let shift = false;
  let alt = false;
  let key: string | null = null;
  for (const token of tokens) {
    const modifier = MODIFIER_ALIAS[token];
    if (modifier) {
      if (modifier === "mod") mod = true;
      else if (modifier === "shift") shift = true;
      else alt = true;
      continue;
    }
    const k = KEY_ALIAS[token] ?? token;
    if (!NAMED_KEYS.has(k) && k.length !== 1) return null;
    if (key !== null) return null;
    key = k;
  }
  if (key === null) return null;
  if (shift && key.length === 1 && !/\p{L}/u.test(key)) shift = false;
  return [mod && "mod", shift && "shift", alt && "alt", key]
    .filter((part): part is string => typeof part === "string")
    .join("+");
}

/** `KeyboardEvent.key` values that are modifiers or non-keys: never a combo. */
const NON_KEYS: ReadonlySet<string> = new Set([
  "shift",
  "meta",
  "control",
  "alt",
  "altgraph",
  "capslock",
  "fn",
  "fnlock",
  "hyper",
  "super",
  "os",
  "symbol",
  "symbollock",
  "numlock",
  "scrolllock",
  "dead",
  "unidentified",
]);

/**
 * The combo a live key press records, for the Settings recorder. Null for a
 * modifier-only press (the user is still forming the chord) and while an IME
 * composition is in flight. `mod` is ⌘ or Ctrl, matching `matchCombo`.
 */
export function comboFromKeyboardEvent(e: KeyboardEvent): string | null {
  if (e.isComposing) return null;
  const raw = e.key;
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (NON_KEYS.has(lower)) return null;
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("mod");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  parts.push(lower === " " ? "space" : lower);
  return normalizeCombo(parts.join("+"));
}

/**
 * Combos a page handler can never own, so recording one would produce a
 * shortcut that silently never fires — or, worse, one that DOES fire and
 * hijacks something the user relies on:
 *
 * - window/tab chords the browser consumes before the page sees them
 *   (the registry's own comment at `chat.new` documents the ⌘N case);
 * - DevTools chords on Windows/Linux (⌘⇧I/J/C never reach the page there);
 * - clipboard, undo, find, print, reload, location and save — every `mod`
 *   combo fires inside the composer too (`comboFiresWhileTyping`), so binding
 *   "New chat" to ⌘C would break copy app-wide with no way back but Settings;
 * - the native focus-movement and activation keys, which assistive
 *   technology and every focused control depend on.
 */
export const RESERVED_COMBOS: ReadonlySet<string> = new Set([
  "mod+n",
  "mod+shift+n",
  "mod+t",
  "mod+shift+t",
  "mod+w",
  "mod+shift+w",
  "mod+q",
  "mod+tab",
  "mod+shift+tab",
  "mod+pageup",
  "mod+pagedown",
  "mod+shift+i",
  "mod+shift+j",
  "mod+shift+c",
  "mod+c",
  "mod+v",
  "mod+shift+v",
  "mod+x",
  "mod+z",
  "mod+shift+z",
  "mod+y",
  "mod+a",
  "mod+f",
  "mod+g",
  "mod+p",
  "mod+r",
  "mod+shift+r",
  "mod+l",
  "mod+s",
  "tab",
  "shift+tab",
  "enter",
  "space",
]);

/**
 * Whether `combo` may become the binding for `id`, given the live bindings.
 * Collision scope is the whole app — any two dispatched shortcuts can be live
 * on the same page — so every non-`fixed` row counts, INCLUDING locked rows
 * such as `close.esc` (dispatched, just not rebindable). Documentation-only
 * (`fixed`) rows never reach the dispatcher, so they cannot collide.
 *
 * Two canonical combos collide exactly when they are EQUAL: `matchCombo`
 * treats a held shift on a letter or named key as a different chord (⌘⇧K is
 * not ⌘K), and a shifted symbol drops its `shift` at canonicalisation (`?`,
 * never `shift+?`), so no two distinct canonical combos share a key press.
 */
export function validateBinding(
  id: string,
  combo: string,
  bindings: readonly ShortcutBinding[],
): BindingError | null {
  const canonical = normalizeCombo(combo);
  if (!canonical) return { reason: "invalid" };
  if (RESERVED_COMBOS.has(canonical)) return { reason: "reserved" };
  for (const b of bindings) {
    if (b.id === id || b.fixed) continue;
    if (b.effectiveCombo === canonical) {
      return {
        reason: "collision",
        withId: b.id,
        withDescription: b.description,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Overrides → effective bindings
// ---------------------------------------------------------------------------

const DEFS_BY_ID: ReadonlyMap<string, ShortcutDef> = new Map(
  SHORTCUTS.map((def) => [def.id, def]),
);

function applyOverrides(
  overrides: Readonly<Record<string, string>>,
): ShortcutBinding[] {
  return SHORTCUTS.map((def) => {
    const combo = overrides[def.id];
    return combo && combo !== def.combo
      ? { ...def, effectiveCombo: combo, custom: true }
      : { ...def, effectiveCombo: def.combo, custom: false };
  });
}

/**
 * The override that has to go for the set to be collision-free, or null when
 * it already is. Between two overrides the LATER-stored one loses (first
 * wins); an override colliding with a default always loses. Two colliding
 * defaults are the registry's business, not the keymap's — it never drops a
 * default.
 */
function collisionLoser(
  bindings: readonly ShortcutBinding[],
  order: readonly string[],
): string | null {
  const live = bindings.filter((b) => !b.fixed);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (!a.custom && !b.custom) continue;
      if (a.effectiveCombo !== b.effectiveCombo) continue;
      if (!a.custom) return b.id;
      if (!b.custom) return a.id;
      return order.indexOf(a.id) <= order.indexOf(b.id) ? b.id : a.id;
    }
  }
  return null;
}

/**
 * Reduce a raw (possibly hostile) overrides object to the ones that may take
 * effect: known rebindable ids only, canonical combos, nothing reserved,
 * nothing equal to the row's own default, and no two live shortcuts on
 * overlapping combos (earliest-stored wins). Dropping an override restores
 * that row's default, which can itself collide with a later override, so the
 * pass repeats until the set is stable — each round drops one override, so it
 * terminates.
 */
export function sanitizeOverrides(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const kept = new Map<string, string>();
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const def = DEFS_BY_ID.get(id);
    if (!def || !isRebindable(def) || typeof value !== "string") continue;
    const combo = normalizeCombo(value);
    if (!combo || RESERVED_COMBOS.has(combo) || combo === def.combo) continue;
    kept.set(id, combo);
  }
  const order = [...kept.keys()];
  for (;;) {
    const loser = collisionLoser(
      applyOverrides(Object.fromEntries(kept)),
      order,
    );
    if (!loser) break;
    kept.delete(loser);
  }
  return Object.fromEntries(kept);
}

/** Pure: the registry with `overrides` applied (after sanitising them). */
export function effectiveBindings(
  overrides: Readonly<Record<string, string>>,
): ShortcutBinding[] {
  return applyOverrides(sanitizeOverrides(overrides));
}

// ---------------------------------------------------------------------------
// Storage + external store
// ---------------------------------------------------------------------------

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const s = window.localStorage;
    // Some test/runtime shims expose a method-less Storage; treat as absent.
    return s && typeof s.getItem === "function" ? s : null;
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return storage()?.getItem(KEYMAP_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function parseRaw(raw: string | null): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** The overrides currently stored in this browser, sanitised. */
export function readOverrides(): Record<string, string> {
  return sanitizeOverrides(parseRaw(readRaw()));
}

const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

/** Persist `overrides` (sanitised; an empty set removes the key) and notify. */
export function writeOverrides(
  overrides: Readonly<Record<string, string>>,
): void {
  const clean = sanitizeOverrides(overrides);
  try {
    const s = storage();
    if (!s) return;
    if (Object.keys(clean).length === 0) s.removeItem(KEYMAP_STORAGE_KEY);
    else s.setItem(KEYMAP_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Storage disabled or full — the keymap just doesn't persist.
  } finally {
    notify();
  }
}

type KeymapSnapshot = {
  readonly bindings: readonly ShortcutBinding[];
  readonly overrides: Readonly<Record<string, string>>;
};

const DEFAULT_SNAPSHOT: KeymapSnapshot = {
  bindings: applyOverrides({}),
  overrides: {},
};

// `useSyncExternalStore` requires a referentially stable snapshot while the
// store is unchanged (else React loops on "getSnapshot should be cached"), so
// the parsed result is cached against the raw stored string.
let cachedRaw: string | null = null;
let cachedSnapshot: KeymapSnapshot = DEFAULT_SNAPSHOT;

function getSnapshot(): KeymapSnapshot {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  const overrides = sanitizeOverrides(parseRaw(raw));
  cachedSnapshot =
    Object.keys(overrides).length === 0
      ? DEFAULT_SNAPSHOT
      : { bindings: applyOverrides(overrides), overrides };
  return cachedSnapshot;
}

function getServerSnapshot(): KeymapSnapshot {
  return DEFAULT_SNAPSHOT;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  // Another tab of Studio changing the keymap should reach this one too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEYMAP_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The effective shortcut bindings plus the mutators the Settings page needs.
 * Every mounted instance (the dispatcher, the help reference, the ⌘K hint,
 * the Settings rows) shares one store, so a change lands everywhere at once.
 * SSR renders the defaults and patches up after hydration.
 */
export function useShortcutBindings(): {
  bindings: readonly ShortcutBinding[];
  setBinding: (id: string, combo: string) => BindingError | null;
  resetBinding: (id: string) => void;
  resetAll: () => void;
  hasOverrides: boolean;
} {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setBinding = useCallback(
    (id: string, combo: string): BindingError | null => {
      const def = DEFS_BY_ID.get(id);
      if (!def || !isRebindable(def)) return { reason: "invalid" };
      const current = getSnapshot();
      const error = validateBinding(id, combo, current.bindings);
      if (error) return error;
      const canonical = normalizeCombo(combo);
      if (!canonical) return { reason: "invalid" };
      const next: Record<string, string> = { ...current.overrides };
      if (canonical === def.combo) delete next[id];
      else next[id] = canonical;
      writeOverrides(next);
      return null;
    },
    [],
  );

  const resetBinding = useCallback((id: string) => {
    const next: Record<string, string> = { ...getSnapshot().overrides };
    delete next[id];
    writeOverrides(next);
  }, []);

  const resetAll = useCallback(() => writeOverrides({}), []);

  return {
    bindings: snapshot.bindings,
    setBinding,
    resetBinding,
    resetAll,
    hasOverrides: Object.keys(snapshot.overrides).length > 0,
  };
}
