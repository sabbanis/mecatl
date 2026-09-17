import { describe, expect, it } from "vitest";
import {
  comboFiresWhileTyping,
  describeShortcut,
  keycaps,
  matchCombo,
  SHORTCUT_GROUPS,
  SHORTCUTS,
} from "./registry";

/** Build a minimal KeyboardEvent-like object for matchCombo. */
function ev(
  key: string,
  mods: Partial<{
    meta: boolean;
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
  }> = {},
): KeyboardEvent {
  return {
    key,
    metaKey: mods.meta ?? false,
    ctrlKey: mods.ctrl ?? false,
    shiftKey: mods.shift ?? false,
    altKey: mods.alt ?? false,
  } as KeyboardEvent;
}

describe("shortcut registry", () => {
  it("has unique ids", () => {
    const ids = SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every shortcut belongs to a known group", () => {
    for (const s of SHORTCUTS) {
      expect(SHORTCUT_GROUPS).toContain(
        s.group as (typeof SHORTCUT_GROUPS)[number],
      );
    }
  });

  it("pins the app-wide bindings to their combos", () => {
    const byId = new Map(SHORTCUTS.map((s) => [s.id, s.combo]));
    expect(byId.get("search.open")).toBe("mod+k");
    expect(byId.get("settings.open")).toBe("mod+,");
    expect(byId.get("shortcuts.open")).toBe("?");
    expect(byId.get("shortcuts.open.mod")).toBe("mod+/");
    expect(byId.get("chat.toggleList")).toBe("mod+b");
    expect(byId.get("close.esc")).toBe("esc");
    // Deliberately NOT mod+n: browsers reserve ⌘N/Ctrl+N (new window) and the
    // page can't intercept it, so "New chat" stays on the preventable ⌘⇧O.
    expect(byId.get("chat.new")).toBe("mod+shift+o");
    // The Agents panel toggle (the TUI's f6): a preventable ⌘⇧ chord, off the
    // browser-reserved ⌘⇧A/N/T/W.
    expect(byId.get("agents.toggle")).toBe("mod+shift+l");
    expect(SHORTCUTS.find((s) => s.id === "agents.toggle")?.group).toBe(
      "General",
    );
    // The `/session` details dialog: ⌘I is preventable everywhere; ⌘⇧I is
    // DevTools on Windows/Linux and would never reach the page.
    expect(byId.get("chat.details")).toBe("mod+i");
    expect(SHORTCUTS.find((s) => s.id === "chat.details")?.group).toBe("Chats");
    expect(comboFiresWhileTyping("mod+i")).toBe(true);
    // Clear conversation (the TUI's /clear): a preventable ⌘⇧ chord, off the
    // Agents panel's ⌘⇧L and Firefox's uninterceptable ⌘⇧K; a ⌘ chord, so
    // it fires from the composer too.
    expect(byId.get("chat.clear")).toBe("mod+shift+x");
    expect(SHORTCUTS.find((s) => s.id === "chat.clear")?.group).toBe("Chats");
    expect(comboFiresWhileTyping("mod+shift+x")).toBe(true);
  });

  it("binds Debug with AI (the TUI's F1) to a preventable, browser-free chord in the Chats group", () => {
    const def = SHORTCUTS.find((s) => s.id === "debug.open");
    // Not bare F1: the browser's help key (and a Mac laptop's brightness key)
    // — the keymap reserves it. ⌘⇧Y is off every reserved chord.
    expect(def?.combo).toBe("mod+shift+y");
    expect(def?.group).toBe("Chats");
    expect(def?.description).toContain("Debug the selected chat with AI");
    expect(def?.description).toContain("F1");
    // Dispatched (the workspace registers a handler), so NOT documentation-only.
    expect(def?.fixed).toBeUndefined();
    expect(comboFiresWhileTyping("mod+shift+y")).toBe(true);
    expect(
      matchCombo("mod+shift+y", ev("Y", { meta: true, shift: true })),
    ).toBe(true);
    expect(
      matchCombo("mod+shift+y", ev("Y", { ctrl: true, shift: true })),
    ).toBe(true);
    expect(matchCombo("mod+shift+y", ev("y", { ctrl: true }))).toBe(false);
    expect(matchCombo("mod+shift+y", ev("F1"))).toBe(false);
    expect(keycaps("mod+shift+y")).toEqual(["⌘", "⇧", "Y"]);
  });

  it("binds Expand/collapse details (the TUI's ctrl+t) to a preventable ⌘⇧ chord that fires while typing", () => {
    const def = SHORTCUTS.find((s) => s.id === "chat.expandDetails");
    // ⌘⇧G (find previous — pages may claim it everywhere), NOT ⌘⇧E: Firefox's
    // Network Monitor owns Ctrl+Shift+E on Windows/Linux and never yields it.
    expect(def?.combo).toBe("mod+shift+g");
    expect(def?.group).toBe("Conversation");
    expect(def?.fixed).toBeUndefined();
    expect(comboFiresWhileTyping("mod+shift+g")).toBe(true);
    expect(
      matchCombo("mod+shift+g", ev("G", { meta: true, shift: true })),
    ).toBe(true);
    expect(
      matchCombo("mod+shift+g", ev("g", { ctrl: true, shift: true })),
    ).toBe(true);
    expect(matchCombo("mod+shift+g", ev("g", { ctrl: true }))).toBe(false);
  });

  it("gives every live shortcut a combo of its own", () => {
    const live = SHORTCUTS.filter((s) => !s.fixed);
    const combos = live.map((s) => s.combo);
    expect(new Set(combos).size).toBe(combos.length);
  });

  it("binds the schedules list filter to a bare slash in its own group", () => {
    const def = SHORTCUTS.find((s) => s.id === "schedules.filter");
    expect(def?.combo).toBe("/");
    expect(def?.group).toBe("Scheduled");
    expect(SHORTCUT_GROUPS).toContain("Scheduled");
    // A bare slash must stay plain text inside the filter (and the composer):
    // the dispatcher suppresses it while typing, so focusing the filter with
    // `/` never inserts a slash into it.
    expect(comboFiresWhileTyping("/")).toBe(false);
  });

  it("pins the transcript paging keys in their own Conversation group", () => {
    const byId = new Map(SHORTCUTS.map((s) => [s.id, s]));
    expect(byId.get("transcript.pageUp")?.combo).toBe("pageup");
    expect(byId.get("transcript.pageDown")?.combo).toBe("pagedown");
    expect(byId.get("transcript.top")?.combo).toBe("shift+pageup");
    expect(byId.get("transcript.bottom")?.combo).toBe("shift+pagedown");
    for (const id of [
      "transcript.pageUp",
      "transcript.pageDown",
      "transcript.top",
      "transcript.bottom",
    ]) {
      expect(byId.get(id)?.group).toBe("Conversation");
    }
    // Rendered between the chat-list keys and the composer keys.
    const groups = [...SHORTCUT_GROUPS];
    expect(groups.indexOf("Conversation")).toBe(groups.indexOf("Chats") + 1);
    expect(groups.indexOf("Composer")).toBe(groups.indexOf("Conversation") + 1);
  });

  it("dispatches ⇧PgUp / ⇧PgDn to the top/bottom jumps (first match wins)", () => {
    // The dispatcher fires the FIRST registry entry that matches, so the
    // bare `pageup` entry must not swallow a shifted press.
    const firstMatch = (e: KeyboardEvent) =>
      SHORTCUTS.find((s) => matchCombo(s.combo, e))?.id;
    expect(firstMatch(ev("PageUp", { shift: true }))).toBe("transcript.top");
    expect(firstMatch(ev("PageDown", { shift: true }))).toBe(
      "transcript.bottom",
    );
    expect(firstMatch(ev("PageUp"))).toBe("transcript.pageUp");
    expect(firstMatch(ev("PageDown"))).toBe("transcript.pageDown");
  });

  it("documents the transcript select-all as a fixed ⌘A in the Conversation group", () => {
    const def = SHORTCUTS.find((s) => s.id === "transcript.selectAll");
    expect(def?.combo).toBe("mod+a");
    expect(def?.group).toBe("Conversation");
    // Fixed: the transcript container owns the keydown, so the chord fires
    // only while the conversation has focus; the dispatcher never claims
    // mod+a (no component registers a handler for this id).
    expect(def?.fixed).toBe(true);
    expect(keycaps("mod+a")).toEqual(["⌘", "A"]);
  });

  it("binds the model + effort picker opener (the TUI's F7) to a preventable, browser-free chord", () => {
    const def = SHORTCUTS.find((s) => s.id === "composer.model");
    // Off ⌘⇧M: Chrome's profile switcher / Firefox's responsive-design mode.
    expect(def?.combo).toBe("mod+shift+f");
    expect(def?.group).toBe("Composer");
    expect(def?.description).toBe("Open the model and effort picker");
    // Dispatched (the picker registers a handler), so NOT documentation-only.
    expect(def?.fixed).toBeUndefined();
    expect(comboFiresWhileTyping("mod+shift+f")).toBe(true);
    expect(
      matchCombo("mod+shift+f", ev("F", { meta: true, shift: true })),
    ).toBe(true);
    expect(matchCombo("mod+shift+f", ev("f", { ctrl: true }))).toBe(false);
  });

  it("marks every composer binding fixed (component-owned, documentation-only)", () => {
    // The picker opener is the one dispatched composer shortcut.
    const composer = SHORTCUTS.filter(
      (s) => s.id.startsWith("composer.") && s.id !== "composer.model",
    );
    expect(composer.length).toBeGreaterThan(0);
    for (const def of composer) expect(def.fixed).toBe(true);
    // The dispatched bindings are NOT fixed — they have handlers.
    for (const id of ["close.esc", "search.open", "transcript.pageUp"]) {
      expect(SHORTCUTS.find((s) => s.id === id)?.fixed).toBeUndefined();
    }
  });

  it("documents the permission-mode cycle as a fixed ⇧Tab composer row (the TUI's shift+tab)", () => {
    const def = SHORTCUTS.find((s) => s.id === "composer.mode.cycle");
    expect(def?.combo).toBe("shift+tab");
    expect(def?.group).toBe("Composer");
    expect(def?.description).toBe(
      "Cycle the permission mode — Manual → Plan → Accept edits (mid-run: held until the turn ends)",
    );
    // Fixed, not locked: the composer's own editor keydown owns the chord,
    // so it fires only with the caret in the composer. The global dispatcher
    // never claims ⇧Tab — outside the composer it must stay the browser's
    // reverse-focus key (forms, dialogs, assistive technology).
    expect(def?.fixed).toBe(true);
    expect(def?.locked).toBeUndefined();
    expect(comboFiresWhileTyping("shift+tab")).toBe(false);
    expect(keycaps("shift+tab")).toEqual(["⇧", "Tab"]);
    // The chord is ⇧Tab and only ⇧Tab: a bare Tab, ⌘⇧Tab (the browser's tab
    // switch) and ⌥⇧Tab are different keys.
    expect(matchCombo("shift+tab", ev("Tab", { shift: true }))).toBe(true);
    expect(matchCombo("shift+tab", ev("Tab"))).toBe(false);
    expect(
      matchCombo("shift+tab", ev("Tab", { shift: true, meta: true })),
    ).toBe(false);
    expect(
      matchCombo("shift+tab", ev("Tab", { shift: true, ctrl: true })),
    ).toBe(false);
    expect(matchCombo("shift+tab", ev("Tab", { shift: true, alt: true }))).toBe(
      false,
    );
  });

  it("documents paste as a fixed ⌘V in the Composer group (the TUI's ctrl+v)", () => {
    const def = SHORTCUTS.find((s) => s.id === "composer.paste");
    expect(def?.combo).toBe("mod+v");
    expect(def?.group).toBe("Composer");
    expect(def?.description).toBe(
      "Paste — a clipboard image attaches; a large text paste is staged as [Pasted text #N] and expands on send",
    );
    // Fixed: the browser owns ⌘V and the composer's paste listener decides
    // what the clipboard becomes; the dispatcher never claims the chord (no
    // handler is registered), so paste keeps working everywhere else.
    expect(def?.fixed).toBe(true);
    expect(keycaps("mod+v")).toEqual(["⌘", "V"]);
  });

  it("documents the double-Esc draft clear as a fixed Esc row in the Composer group", () => {
    const def = SHORTCUTS.find((s) => s.id === "composer.clearDraft");
    expect(def?.combo).toBe("esc");
    expect(def?.group).toBe("Composer");
    expect(def?.description).toBe("Press twice on an idle draft to clear it");
    // Fixed: the press rides close.esc and is forwarded to the composer;
    // nothing registers a handler for this id, so it is never dispatched.
    expect(def?.fixed).toBe(true);
    expect(def?.locked).toBeUndefined();
  });

  it("phrases Esc's layering: selection, then the side panel, then the run", () => {
    expect(SHORTCUTS.find((s) => s.id === "close.esc")?.description).toBe(
      "Clear the selection, close the side panel — or stop the running turn",
    );
  });

  it("locks Esc: dispatched (a handler is registered) but never user-rebindable", () => {
    const def = SHORTCUTS.find((s) => s.id === "close.esc");
    expect(def?.locked).toBe(true);
    // Locked is NOT fixed — the dispatcher still fires it, so the keymap's
    // collision checks keep it in scope.
    expect(def?.fixed).toBeUndefined();
    for (const s of SHORTCUTS) {
      if (s.id !== "close.esc") expect(s.locked).toBeUndefined();
    }
  });
});

describe("keycaps", () => {
  it("renders modifiers and keys", () => {
    expect(keycaps("mod+k")).toEqual(["⌘", "K"]);
    expect(keycaps("mod+shift+n")).toEqual(["⌘", "⇧", "N"]);
    expect(keycaps("down")).toEqual(["↓"]);
    expect(keycaps("?")).toEqual(["?"]);
    expect(keycaps("shift+enter")).toEqual(["⇧", "Enter"]);
  });

  it("labels the paging keys as PgUp / PgDn", () => {
    expect(keycaps("pageup")).toEqual(["PgUp"]);
    expect(keycaps("shift+pageup")).toEqual(["⇧", "PgUp"]);
    expect(keycaps("shift+pagedown")).toEqual(["⇧", "PgDn"]);
  });

  it("labels the keys only a user-recorded combo can carry", () => {
    expect(keycaps("mod+space")).toEqual(["⌘", "Space"]);
    expect(keycaps("alt+f5")).toEqual(["⌥", "F5"]);
    expect(keycaps("shift+tab")).toEqual(["⇧", "Tab"]);
    expect(keycaps("mod+backspace")).toEqual(["⌘", "⌫"]);
    // matchCombo understands the same tokens (the space bar reports " ").
    expect(matchCombo("mod+space", ev(" ", { meta: true }))).toBe(true);
    expect(matchCombo("mod+space", ev(" "))).toBe(false);
    expect(matchCombo("alt+f5", ev("F5", { alt: true }))).toBe(true);
  });
});

describe("matchCombo", () => {
  it("matches modifier combos (⌘ or Ctrl)", () => {
    expect(matchCombo("mod+k", ev("k", { meta: true }))).toBe(true);
    expect(matchCombo("mod+k", ev("k", { ctrl: true }))).toBe(true);
    expect(matchCombo("mod+k", ev("k"))).toBe(false); // no modifier
  });

  it("matches plain keys and arrow aliases", () => {
    expect(matchCombo("j", ev("j"))).toBe(true);
    // A Caps Lock capital (no shiftKey) still matches its lower-case combo…
    expect(matchCombo("j", ev("J"))).toBe(true);
    // …but a HELD shift is a different chord (⇧J is not J, ⌘⇧K is not ⌘K).
    expect(matchCombo("j", ev("J", { shift: true }))).toBe(false);
    expect(matchCombo("mod+k", ev("K", { meta: true, shift: true }))).toBe(
      false,
    );
    expect(matchCombo("down", ev("ArrowDown"))).toBe(true);
    expect(matchCombo("up", ev("ArrowUp"))).toBe(true);
  });

  it("matches symbol keys without needing an explicit shift", () => {
    expect(matchCombo("?", ev("?", { shift: true }))).toBe(true);
    expect(matchCombo("/", ev("/"))).toBe(true);
  });

  it("rejects when a modifier is present but not wanted", () => {
    expect(matchCombo("j", ev("j", { meta: true }))).toBe(false);
    expect(matchCombo("down", ev("ArrowDown", { alt: true }))).toBe(false);
  });

  it("requires shift when the combo declares it", () => {
    expect(
      matchCombo("mod+shift+n", ev("n", { meta: true, shift: true })),
    ).toBe(true);
    expect(matchCombo("mod+shift+n", ev("n", { meta: true }))).toBe(false);
  });

  it("matches the agents panel chord on either modifier, with shift", () => {
    // Shift+L reports an upper-case key in browsers; the match is case-blind.
    expect(
      matchCombo("mod+shift+l", ev("L", { meta: true, shift: true })),
    ).toBe(true);
    expect(
      matchCombo("mod+shift+l", ev("L", { ctrl: true, shift: true })),
    ).toBe(true);
    expect(matchCombo("mod+shift+l", ev("l", { meta: true }))).toBe(false);
    expect(matchCombo("mod+shift+l", ev("l", { shift: true }))).toBe(false);
  });

  it("matches mod + punctuation combos", () => {
    expect(matchCombo("mod+,", ev(",", { meta: true }))).toBe(true);
    expect(matchCombo("mod+,", ev(",", { ctrl: true }))).toBe(true);
    expect(matchCombo("mod+,", ev(","))).toBe(false);
    expect(matchCombo("mod+/", ev("/", { meta: true }))).toBe(true);
    expect(matchCombo("mod+/", ev("/"))).toBe(false);
  });

  it("matches esc via its alias", () => {
    expect(matchCombo("esc", ev("Escape"))).toBe(true);
    expect(matchCombo("esc", ev("Escape", { meta: true }))).toBe(false);
  });

  it("matches the paging keys by their DOM key names", () => {
    expect(matchCombo("pageup", ev("PageUp"))).toBe(true);
    expect(matchCombo("pagedown", ev("PageDown"))).toBe(true);
    expect(matchCombo("shift+pageup", ev("PageUp", { shift: true }))).toBe(
      true,
    );
    expect(matchCombo("shift+pagedown", ev("PageDown", { shift: true }))).toBe(
      true,
    );
  });

  it("keeps the bare and shifted paging chords distinct", () => {
    // An unrequested shift on a NAMED key is a different chord (⇧PgUp must
    // reach `transcript.top`, never be swallowed by `pageup`)…
    expect(matchCombo("pageup", ev("PageUp", { shift: true }))).toBe(false);
    expect(matchCombo("pagedown", ev("PageDown", { shift: true }))).toBe(false);
    expect(matchCombo("shift+pageup", ev("PageUp"))).toBe(false);
    // …and so is a held shift on a letter, while SYMBOL keys keep their
    // implicit-shift leniency (`?` arrives with shiftKey on a US layout).
    expect(matchCombo("j", ev("J", { shift: true }))).toBe(false);
    expect(matchCombo("?", ev("?", { shift: true }))).toBe(true);
  });

  it("leaves the browser's Ctrl/⌘+PgUp/PgDn tab-switch chords alone", () => {
    expect(matchCombo("pageup", ev("PageUp", { ctrl: true }))).toBe(false);
    expect(matchCombo("pagedown", ev("PageDown", { meta: true }))).toBe(false);
    expect(
      matchCombo("shift+pageup", ev("PageUp", { ctrl: true, shift: true })),
    ).toBe(false);
  });
});

describe("comboFiresWhileTyping", () => {
  it("allows mod combos and bare esc, suppresses plain keys", () => {
    expect(comboFiresWhileTyping("mod+k")).toBe(true);
    expect(comboFiresWhileTyping("mod+shift+o")).toBe(true);
    // The agents panel must toggle from inside the composer too.
    expect(comboFiresWhileTyping("mod+shift+l")).toBe(true);
    expect(comboFiresWhileTyping("esc")).toBe(true);
    expect(comboFiresWhileTyping("j")).toBe(false);
    expect(comboFiresWhileTyping("?")).toBe(false);
    expect(comboFiresWhileTyping("shift+enter")).toBe(false);
  });

  it("lets the paging keys scroll the transcript from the composer", () => {
    expect(comboFiresWhileTyping("pageup")).toBe(true);
    expect(comboFiresWhileTyping("pagedown")).toBe(true);
    expect(comboFiresWhileTyping("shift+pageup")).toBe(true);
    expect(comboFiresWhileTyping("shift+pagedown")).toBe(true);
    // Home/End move the caret within a line while typing — never claimed.
    expect(comboFiresWhileTyping("home")).toBe(false);
    expect(comboFiresWhileTyping("end")).toBe(false);
  });
});

describe("describeShortcut", () => {
  const byId = (id: string) => {
    const def = SHORTCUTS.find((s) => s.id === id);
    if (!def) throw new Error(`missing shortcut ${id}`);
    return def;
  };

  it("phrases Enter live from the queue preference", () => {
    expect(describeShortcut(byId("composer.send"), "queue")).toBe(
      "Send — while the agent is replying: queue the message",
    );
    expect(describeShortcut(byId("composer.newline"), "queue")).toBe(
      "Insert a new line — while the agent is replying: steer the agent",
    );
  });

  it("inverts both rows when the preference is steer", () => {
    expect(describeShortcut(byId("composer.send"), "steer")).toBe(
      "Send — while the agent is replying: steer the agent",
    );
    expect(describeShortcut(byId("composer.newline"), "steer")).toBe(
      "Insert a new line — while the agent is replying: queue the message",
    );
  });

  it("returns the registry description for every other shortcut", () => {
    for (const def of SHORTCUTS) {
      if (def.id === "composer.send" || def.id === "composer.newline") continue;
      expect(describeShortcut(def, "queue")).toBe(def.description);
      expect(describeShortcut(def, "steer")).toBe(def.description);
    }
  });
});
