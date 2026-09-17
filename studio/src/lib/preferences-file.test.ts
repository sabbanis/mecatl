import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { memoryStorage } from "../test/memory-storage";
import {
  applyPreferences,
  EXCLUDED_STORAGE_KEYS,
  exportPreferences,
  isExcludedStorageKey,
  PREFERENCE_ENTRIES,
  PREFERENCES_FILE_MAX_BYTES,
  PREFERENCES_FORMAT,
  parsePreferencesFile,
  planPreferencesImport,
  preferenceEntry,
  serializePreferencesFile,
} from "./preferences-file";

const NOW = new Date("2026-09-17T10:00:00.000Z");

function fileWith(preferences: Record<string, unknown>, format?: unknown) {
  return JSON.stringify({
    format: format === undefined ? PREFERENCES_FORMAT : format,
    exportedAt: NOW.toISOString(),
    preferences,
  });
}

function parsedOk(text: string) {
  const result = parsePreferencesFile(text);
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result;
}

function rejectedFor(result: ReturnType<typeof parsedOk>, key: string) {
  return result.rejected.find((r) => r.key === key)?.reason;
}

/**
 * The portable preferences file is the web form of mecatui's client-owned
 * settings.yaml: one strict document carrying every browser-local Studio
 * preference. Export copies what is set; import is strict-decode — a wrong
 * envelope is refused outright, and every key inside is judged by the
 * module that owns it, with refusals listed by name.
 */
describe("exportPreferences", () => {
  it("includes only the known keys that are set, plus the format marker", () => {
    const storage = memoryStorage();
    storage.setItem("theme", "dark");
    storage.setItem("mecatl-studio.agent-name", "Astra");
    storage.setItem("mecatl-studio.thread-sessions", '{"a":"b"}');
    storage.setItem("mecatl-studio.draft.s1", "hello");
    storage.setItem("unrelated", "x");

    const file = exportPreferences(storage, NOW);

    expect(file.format).toBe(PREFERENCES_FORMAT);
    expect(file.exportedAt).toBe("2026-09-17T10:00:00.000Z");
    expect(file.preferences).toEqual({
      theme: "dark",
      "mecatl-studio.agent-name": "Astra",
    });
  });

  it("serialises as pretty JSON that parses back", () => {
    const storage = memoryStorage();
    storage.setItem("mecatl-studio.ui-scale", "1.1");
    const text = serializePreferencesFile(exportPreferences(storage, NOW));
    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text).preferences["mecatl-studio.ui-scale"]).toBe("1.1");
  });
});

describe("parsePreferencesFile — the envelope", () => {
  it("refuses a file whose format is missing or wrong, outright", () => {
    const missing = parsePreferencesFile(
      JSON.stringify({ preferences: { theme: "dark" } }),
    );
    expect(missing).toEqual({
      ok: false,
      error: expect.stringContaining('"format" is missing'),
    });

    const wrong = parsePreferencesFile(fileWith({ theme: "dark" }, "other/9"));
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) {
      expect(wrong.error).toContain('"format" is "other/9"');
      expect(wrong.error).toContain(PREFERENCES_FORMAT);
    }
  });

  it("refuses text that is not JSON, not an object, or lacks preferences", () => {
    expect(parsePreferencesFile("{nope").ok).toBe(false);
    expect(parsePreferencesFile("[]").ok).toBe(false);
    const noPrefs = parsePreferencesFile(
      JSON.stringify({ format: PREFERENCES_FORMAT, preferences: "x" }),
    );
    expect(noPrefs).toEqual({
      ok: false,
      error: expect.stringContaining('"preferences" must be an object'),
    });
  });

  it("refuses a file over the size cap before parsing it", () => {
    const huge = `{"pad":"${"x".repeat(PREFERENCES_FILE_MAX_BYTES)}"}`;
    const result = parsePreferencesFile(huge);
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("larger than 2 MiB"),
    });
  });

  it("keeps a valid exportedAt and drops a malformed one", () => {
    expect(parsedOk(fileWith({})).exportedAt).toBe(NOW.toISOString());
    const bad = parsedOk(
      JSON.stringify({
        format: PREFERENCES_FORMAT,
        exportedAt: "yesterday",
        preferences: {},
      }),
    );
    expect(bad.exportedAt).toBeNull();
  });
});

describe("parsePreferencesFile — the keys", () => {
  it("accepts valid keys and lists unknown keys and bad values by name", () => {
    const result = parsedOk(
      fileWith({
        theme: "dark",
        "mecatl-studio.agent-name": "Astra",
        "mecatl-studio.ui-scale": "9",
        "mecatl-studio.keymap": JSON.stringify({ "not.a.shortcut": "mod+k" }),
        "mecatl-studio.custom-palettes": JSON.stringify([
          { name: "evil", palette: { brand: "url(javascript:alert(1))" } },
        ]),
        "mecatl-studio.status-line": "{not json",
        "mecatl-studio.launch-target": 7,
        "mecatl-studio.nope": "1",
      }),
    );

    expect(result.accepted).toEqual({
      theme: "dark",
      "mecatl-studio.agent-name": "Astra",
    });
    expect(result.rejected.map((r) => r.key).sort()).toEqual([
      "mecatl-studio.custom-palettes",
      "mecatl-studio.keymap",
      "mecatl-studio.launch-target",
      "mecatl-studio.nope",
      "mecatl-studio.status-line",
      "mecatl-studio.ui-scale",
    ]);
    expect(rejectedFor(result, "mecatl-studio.ui-scale")).toBe(
      "must be between 0.85 and 1.3",
    );
    expect(rejectedFor(result, "mecatl-studio.keymap")).toBe(
      '"not.a.shortcut" is not a shortcut id',
    );
    expect(rejectedFor(result, "mecatl-studio.custom-palettes")).toContain(
      "not a supported colour",
    );
    expect(rejectedFor(result, "mecatl-studio.status-line")).toContain("JSON");
    expect(rejectedFor(result, "mecatl-studio.launch-target")).toBe(
      "must be a string",
    );
    expect(rejectedFor(result, "mecatl-studio.nope")).toBe(
      "not a Studio preference",
    );
  });

  it("judges the keymap the way the shortcut store does", () => {
    const check = (overrides: Record<string, string>) =>
      rejectedFor(
        parsedOk(
          fileWith({ "mecatl-studio.keymap": JSON.stringify(overrides) }),
        ),
        "mecatl-studio.keymap",
      );
    // A rebindable id on a free chord passes; canonicalisation is applied.
    expect(check({ "search.open": "Cmd+Shift+K" })).toBeUndefined();
    // Equal to the row's own default is a harmless no-op.
    expect(check({ "search.open": "mod+k" })).toBeUndefined();
    expect(check({ "close.esc": "mod+e" })).toBe(
      '"close.esc" cannot be rebound',
    );
    expect(check({ "search.open": "mod" })).toBe(
      '"search.open": "mod" is not a key combo',
    );
    expect(check({ "search.open": "mod+w" })).toBe(
      '"search.open": "mod+w" is reserved by the browser',
    );
    // ⌘B is "chat.toggleList"'s default: a collision the sanitiser would drop.
    expect(check({ "search.open": "mod+b" })).toBe(
      '"search.open": "mod+b" collides with another shortcut',
    );
    expect(
      rejectedFor(
        parsedOk(fileWith({ "mecatl-studio.keymap": "[1]" })),
        "mecatl-studio.keymap",
      ),
    ).toBe("must be a JSON object of shortcut id: key combo");
  });

  it("applies each owning module's rules to the remaining keys", () => {
    const reasons = parsedOk(
      fileWith({
        theme: "sepia",
        "mecatl-studio.palette": "custom:midnight",
        "mecatl-studio.session-list-side": "top",
        "workspace-panel-width": "100",
        "mecatl-studio.user-avatar": "https://example.com/me.png",
        "mecatl-studio.agent-avatar": "data:image/png;base64,AAAA",
        "mecatl-studio.enter-send-behavior": "steer",
        "mecatl-studio.show-tool-calls": "0",
        "mecatl-studio.disabled-models": '["gpt", ""]',
        "mecatl-studio.default-model": '{"modelId":"m"}',
        "mecatl-studio.user-name": " ",
      }),
    );
    expect(Object.keys(reasons.accepted).sort()).toEqual([
      "mecatl-studio.agent-avatar",
      "mecatl-studio.enter-send-behavior",
      "mecatl-studio.palette",
    ]);
    expect(rejectedFor(reasons, "theme")).toBe(
      'must be one of "light", "dark", "system"',
    );
    expect(rejectedFor(reasons, "mecatl-studio.session-list-side")).toBe(
      'must be one of "left", "right"',
    );
    expect(rejectedFor(reasons, "workspace-panel-width")).toBe(
      "must be between 200 and 720",
    );
    expect(rejectedFor(reasons, "mecatl-studio.user-avatar")).toBe(
      "must be a data:image/… URL",
    );
    expect(rejectedFor(reasons, "mecatl-studio.show-tool-calls")).toBe(
      'must be one of "1"',
    );
    expect(rejectedFor(reasons, "mecatl-studio.disabled-models")).toBe(
      "every model id must be a non-empty string",
    );
    expect(rejectedFor(reasons, "mecatl-studio.default-model")).toBe(
      '"providerId" must be a non-empty string',
    );
    expect(rejectedFor(reasons, "mecatl-studio.user-name")).toBe(
      "must not be blank",
    );
  });

  it("refuses a built-in palette id that is not in the catalogue", () => {
    const result = parsedOk(fileWith({ "mecatl-studio.palette": "neon" }));
    expect(rejectedFor(result, "mecatl-studio.palette")).toBe(
      'must be a built-in palette id or "custom:<name>"',
    );
    expect(
      parsedOk(fileWith({ "mecatl-studio.palette": "aztec" })).accepted,
    ).toEqual({ "mecatl-studio.palette": "aztec" });
  });

  it("caps an avatar and the custom-palette list", () => {
    const bigAvatar = `data:image/png;base64,${"A".repeat(512 * 1024)}`;
    expect(
      rejectedFor(
        parsedOk(fileWith({ "mecatl-studio.user-avatar": bigAvatar })),
        "mecatl-studio.user-avatar",
      ),
    ).toBe("is larger than 512 KiB");
    const nine = Array.from({ length: 9 }, (_, i) => ({
      name: `p${i}`,
      palette: { brand: "#000" },
    }));
    expect(
      rejectedFor(
        parsedOk(
          fileWith({ "mecatl-studio.custom-palettes": JSON.stringify(nine) }),
        ),
        "mecatl-studio.custom-palettes",
      ),
    ).toBe("lists 9 palettes; a browser keeps at most 8");
  });
});

describe("planPreferencesImport / applyPreferences", () => {
  it("writes accepted keys, clears known keys the file lacks, and leaves rejected and excluded keys alone", () => {
    const storage = memoryStorage();
    storage.setItem("mecatl-studio.ui-scale", "1.2"); // not in file → cleared
    storage.setItem("mecatl-studio.launch-target", "latest"); // rejected → kept
    storage.setItem("theme", "light"); // in file → replaced
    storage.setItem("mecatl-studio.thread-sessions", "{}"); // state → untouched
    storage.setItem("unrelated", "x");

    const parsed = parsedOk(
      fileWith({
        theme: "dark",
        "mecatl-studio.agent-name": "Astra",
        "mecatl-studio.launch-target": "sideways",
      }),
    );
    const plan = planPreferencesImport(parsed, storage);
    expect(plan).toEqual({
      write: ["theme", "mecatl-studio.agent-name"],
      clear: ["mecatl-studio.ui-scale"],
    });
    // Planning writes nothing.
    expect(storage.getItem("theme")).toBe("light");

    expect(applyPreferences(parsed, storage)).toEqual(plan);
    expect(storage.getItem("theme")).toBe("dark");
    expect(storage.getItem("mecatl-studio.agent-name")).toBe("Astra");
    expect(storage.getItem("mecatl-studio.ui-scale")).toBeNull();
    expect(storage.getItem("mecatl-studio.launch-target")).toBe("latest");
    expect(storage.getItem("mecatl-studio.thread-sessions")).toBe("{}");
    expect(storage.getItem("unrelated")).toBe("x");
  });

  it("round-trips export → serialize → parse → apply losslessly", () => {
    const source = memoryStorage();
    source.setItem("theme", "dark");
    source.setItem("mecatl-studio.palette", "custom:ember");
    source.setItem(
      "mecatl-studio.custom-palettes",
      JSON.stringify([
        { name: "ember", label: "Ember", palette: { brand: "#ff6600" } },
      ]),
    );
    source.setItem("mecatl-studio.ui-scale", "1.15");
    source.setItem("workspace-panel-width", "480");
    source.setItem("mecatl-studio.agent-name", "Astra");
    source.setItem("mecatl-studio.user-name", "Ada");
    source.setItem("mecatl-studio.agent-avatar", "data:image/png;base64,AAAA");
    source.setItem("mecatl-studio.enter-send-behavior", "queue-only");
    source.setItem("mecatl-studio.launch-target", "latest");
    source.setItem("mecatl-studio.hide-starter-prompts", "1");
    source.setItem("mecatl-studio.developer-tools", "1");
    source.setItem(
      "mecatl-studio.keymap",
      JSON.stringify({ "search.open": "mod+shift+k" }),
    );
    source.setItem(
      "mecatl-studio.status-line",
      JSON.stringify({
        header: { full: "{{model}}", compact: "", minimal: "" },
        footer: {
          full: "{{context_meter}}",
          compact: "{{context_meter}}",
          minimal: "{{context_bar}}",
        },
        intervalSeconds: 30,
      }),
    );
    source.setItem("mecatl-studio.disabled-models", '["a","b"]');
    source.setItem(
      "mecatl-studio.default-model",
      '{"modelId":"m","providerId":"p"}',
    );

    const text = serializePreferencesFile(exportPreferences(source, NOW));
    const parsed = parsedOk(text);
    expect(parsed.rejected).toEqual([]);

    const target = memoryStorage();
    applyPreferences(parsed, target);
    for (const entry of PREFERENCE_ENTRIES) {
      expect(target.getItem(entry.key)).toBe(source.getItem(entry.key));
    }
  });
});

describe("the inventory", () => {
  it("has one row per key with a label and no duplicates", () => {
    const keys = PREFERENCE_ENTRIES.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of PREFERENCE_ENTRIES) {
      expect(entry.label).not.toBe("");
      expect(preferenceEntry(entry.key)).toBe(entry);
    }
    expect(preferenceEntry("mecatl-studio.thread-sessions")).toBeUndefined();
  });

  it("matches exclusions exactly or by prefix", () => {
    expect(isExcludedStorageKey("mecatl-studio.thread-sessions")).toBe(true);
    expect(isExcludedStorageKey("mecatl-studio.draft.s1")).toBe(true);
    expect(isExcludedStorageKey("mecatl.trust.dismissed:/repo")).toBe(true);
    expect(isExcludedStorageKey("mecatl-studio.thread-sessions-x")).toBe(false);
    expect(isExcludedStorageKey("theme")).toBe(false);
  });

  /**
   * Anti-drift: a preference persisted anywhere in src/ without a row here
   * would be silently non-portable. Every storage-key literal must be either
   * a PREFERENCE_ENTRIES row or an explicit EXCLUDED_STORAGE_KEYS entry, and
   * neither list may go stale.
   */
  it("covers every storage key literal in src/ (or excludes it by name)", () => {
    const root = resolve(import.meta.dirname, "..");
    const found = new Set<string>();
    const literal =
      /["'`](mecatl-studio\.[A-Za-z0-9_.:-]*|mecatl\.trust\.[A-Za-z0-9_.:-]*|studio\.sessions\.[A-Za-z0-9_.-]*|workspace-panel-width)/g;
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "test") walk(path);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name))
          continue;
        const text = readFileSync(path, "utf8");
        for (const match of text.matchAll(literal)) found.add(match[1]);
      }
    };
    walk(root);

    const uncovered = [...found].filter(
      (key) => !preferenceEntry(key) && !isExcludedStorageKey(key),
    );
    expect(uncovered, "add a PREFERENCE_ENTRIES row or an exclusion").toEqual(
      [],
    );

    // No stale rows: every listed key (bar next-themes' own) is referenced.
    for (const entry of PREFERENCE_ENTRIES) {
      if (entry.key === "theme") continue;
      expect(found, `${entry.key} is no longer stored anywhere`).toContain(
        entry.key,
      );
    }
    for (const excluded of EXCLUDED_STORAGE_KEYS) {
      expect(
        [...found].some((key) => key.startsWith(excluded)),
        `${excluded} is no longer stored anywhere`,
      ).toBe(true);
    }
  });
});
