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
});

describe("matchCombo", () => {
  it("matches modifier combos (⌘ or Ctrl)", () => {
    expect(matchCombo("mod+k", ev("k", { meta: true }))).toBe(true);
    expect(matchCombo("mod+k", ev("k", { ctrl: true }))).toBe(true);
    expect(matchCombo("mod+k", ev("k"))).toBe(false); // no modifier
  });

  it("matches plain keys and arrow aliases", () => {
    expect(matchCombo("j", ev("j"))).toBe(true);
    expect(matchCombo("j", ev("J", { shift: true }))).toBe(true); // capital J
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
    // …while single-character keys keep their implicit-shift leniency.
    expect(matchCombo("j", ev("J", { shift: true }))).toBe(true);
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
