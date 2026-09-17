import {
  PALETTE_DOCUMENT_MAX_BYTES,
  parsePaletteDocument,
} from "@/lib/palette-schema";
import {
  isCustomPaletteId,
  isKnownPalette,
  PALETTE_STORAGE_KEY,
} from "@/lib/palettes";
import { UI_SCALE_MAX, UI_SCALE_MIN } from "@/lib/profile-preferences";
import {
  isRebindable,
  KEYMAP_STORAGE_KEY,
  normalizeCombo,
  RESERVED_COMBOS,
  sanitizeOverrides,
} from "@/lib/shortcuts/keymap";
import { SHORTCUTS } from "@/lib/shortcuts/registry";
import {
  STATUS_LINE_KEY,
  validateStatusLinePreferences,
} from "@/lib/statusline/preferences";

/**
 * The portable preferences file — the web analogue of mecatui's client-owned
 * `~/.config/mecatui/settings.yaml`. Every Studio preference lives in this
 * browser's localStorage (a per-person UI tier, never a daemon setting), so
 * without a file none of it moves to another browser or device. This module
 * puts all of them in ONE strictly-validated JSON document.
 *
 * The strict-decode discipline is the TUI's: a wrong or missing `format` is a
 * hard error; an unknown key, a non-string value, or a value the owning
 * preference's own validator refuses is REPORTED BY NAME, never silently
 * dropped. The validators reuse the modules that own each preference
 * (`parsePaletteDocument`, `sanitizeOverrides`, `validateStatusLinePreferences`
 * …), so a value this file accepts is one the hook that reads it will honour.
 *
 * Isomorphic: no React, no DOM at import time. Every function takes the
 * `Storage` to read or write so tests run over an in-memory one.
 *
 * Not ported (terminal/file mechanics with no web analogue): the lenient
 * merge of a legacy `keymap:` from the server's settings.yaml, and the
 * external status executable.
 */

export const PREFERENCES_FORMAT = "mecatl-studio-preferences/1";
export const PREFERENCES_FILE_NAME = "mecatl-studio-preferences.json";
/** Two avatars at their cap plus every other preference fit comfortably. */
export const PREFERENCES_FILE_MAX_BYTES = 2 * 1024 * 1024;
/** A stored avatar (`data:image/…`) may not exceed this many characters. */
const AVATAR_MAX_CHARS = 512 * 1024;
const AGENT_NAME_MAX_CHARS = 40;
const USER_NAME_MAX_CHARS = 80;
const PANEL_WIDTH_MIN = 200;
const PANEL_WIDTH_MAX = 720;
/** `USER_PALETTE_LIMIT` in custom-palettes.ts — restated here because that
 *  module is a React store and this one must stay import-light. */
const CUSTOM_PALETTE_LIMIT = 8;

export interface PreferenceEntry {
  /** The localStorage key exactly as the owning module stores it. */
  readonly key: string;
  /** Plain words for the import preview. */
  readonly label: string;
  /** null when `value` is one the owning hook honours; otherwise why not. */
  readonly validate: (value: string) => string | null;
}

// ── validators ───────────────────────────────────────────────────────────────

function oneOf(
  ...allowed: readonly string[]
): (value: string) => string | null {
  return (value) =>
    allowed.includes(value)
      ? null
      : `must be one of ${allowed.map((v) => `"${v}"`).join(", ")}`;
}

/** The "1"-while-on switches: the key is absent when off. */
const flag = oneOf("1");

function maxChars(limit: number): (value: string) => string | null {
  return (value) => {
    if (value.trim() === "") return "must not be blank";
    if (value.length > limit) return `is longer than ${limit} characters`;
    return null;
  };
}

function numberWithin(min: number, max: number, what: string) {
  return (value: string): string | null => {
    const n = Number(value);
    if (value.trim() === "" || !Number.isFinite(n)) {
      return `must be a number (the ${what})`;
    }
    if (n < min || n > max) return `must be between ${min} and ${max}`;
    return null;
  };
}

function avatar(value: string): string | null {
  if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(value)) {
    return "must be a data:image/… URL";
  }
  if (value.length > AVATAR_MAX_CHARS) {
    return `is larger than ${AVATAR_MAX_CHARS / 1024} KiB`;
  }
  return null;
}

function parseJson(value: string): { ok: true; value: unknown } | string {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    return `is not valid JSON (${error instanceof Error ? error.message : String(error)})`;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function palette(value: string): string | null {
  if (isKnownPalette(value) || isCustomPaletteId(value)) return null;
  return 'must be a built-in palette id or "custom:<name>"';
}

function customPalettes(value: string): string | null {
  const parsed = parseJson(value);
  if (typeof parsed === "string") return parsed;
  if (!Array.isArray(parsed.value)) {
    return "must be a JSON array of palette documents";
  }
  if (parsed.value.length > CUSTOM_PALETTE_LIMIT) {
    return `lists ${parsed.value.length} palettes; a browser keeps at most ${CUSTOM_PALETTE_LIMIT}`;
  }
  for (const [index, entry] of parsed.value.entries()) {
    const text = JSON.stringify(entry);
    if (new TextEncoder().encode(text).length > PALETTE_DOCUMENT_MAX_BYTES) {
      return `palette ${index + 1} is larger than ${PALETTE_DOCUMENT_MAX_BYTES / 1024} KiB`;
    }
    const result = parsePaletteDocument(entry, "user");
    if (!result.ok) return `palette ${index + 1}: ${result.error}`;
  }
  return null;
}

const SHORTCUT_DEFS = new Map(SHORTCUTS.map((def) => [def.id, def]));

/**
 * Strict twin of `sanitizeOverrides`: every id must be a known, rebindable
 * shortcut and every combo a valid, non-reserved chord; then the whole set
 * must survive sanitising unchanged (an override the sanitiser would drop is
 * one that collides with another live shortcut). An override equal to the
 * row's own default is a no-op and passes.
 */
function keymap(value: string): string | null {
  const parsed = parseJson(value);
  if (typeof parsed === "string") return parsed;
  if (!isPlainObject(parsed.value)) {
    return "must be a JSON object of shortcut id: key combo";
  }
  const canonical: Record<string, string> = {};
  for (const [id, combo] of Object.entries(parsed.value)) {
    const def = SHORTCUT_DEFS.get(id);
    if (!def) return `"${id}" is not a shortcut id`;
    if (!isRebindable(def)) return `"${id}" cannot be rebound`;
    if (typeof combo !== "string") return `"${id}" must map to a key combo`;
    const normalized = normalizeCombo(combo);
    if (!normalized) return `"${id}": "${combo}" is not a key combo`;
    if (RESERVED_COMBOS.has(normalized)) {
      return `"${id}": "${combo}" is reserved by the browser`;
    }
    canonical[id] = normalized;
  }
  const kept = sanitizeOverrides(canonical);
  for (const [id, combo] of Object.entries(canonical)) {
    if (combo === SHORTCUT_DEFS.get(id)?.combo) continue;
    if (kept[id] !== combo) {
      return `"${id}": "${combo}" collides with another shortcut`;
    }
  }
  return null;
}

function statusLine(value: string): string | null {
  const result = validateStatusLinePreferences(value);
  return result.ok ? null : result.error;
}

function disabledModels(value: string): string | null {
  const parsed = parseJson(value);
  if (typeof parsed === "string") return parsed;
  if (!Array.isArray(parsed.value)) return "must be a JSON array of model ids";
  if (!parsed.value.every((id) => typeof id === "string" && id !== "")) {
    return "every model id must be a non-empty string";
  }
  return null;
}

function defaultModel(value: string): string | null {
  const parsed = parseJson(value);
  if (typeof parsed === "string") return parsed;
  if (!isPlainObject(parsed.value)) {
    return 'must be a JSON object with "modelId" and "providerId"';
  }
  const { modelId, providerId } = parsed.value;
  if (typeof modelId !== "string" || modelId === "") {
    return '"modelId" must be a non-empty string';
  }
  if (typeof providerId !== "string" || providerId === "") {
    return '"providerId" must be a non-empty string';
  }
  return null;
}

// ── the inventory ────────────────────────────────────────────────────────────

/**
 * One row per persisted preference, keyed exactly as the owning module
 * stores it. `preferences-file.test.ts` walks `src/` for storage keys and
 * fails when a key is neither here nor in `EXCLUDED_STORAGE_KEYS`, so a
 * preference added later cannot quietly become non-portable.
 */
export const PREFERENCE_ENTRIES: readonly PreferenceEntry[] = [
  // next-themes' default storage key (ClientProviders sets none).
  { key: "theme", label: "Theme", validate: oneOf("light", "dark", "system") },
  {
    key: PALETTE_STORAGE_KEY,
    label: "Palette",
    validate: palette,
  },
  {
    key: "mecatl-studio.custom-palettes",
    label: "Custom palettes",
    validate: customPalettes,
  },
  {
    key: "mecatl-studio.ui-scale",
    label: "Interface scale",
    validate: numberWithin(UI_SCALE_MIN, UI_SCALE_MAX, "scale multiplier"),
  },
  {
    key: "mecatl-studio.session-list-side",
    label: "Session list position",
    validate: oneOf("left", "right"),
  },
  {
    key: "workspace-panel-width",
    label: "Side panel width",
    validate: numberWithin(PANEL_WIDTH_MIN, PANEL_WIDTH_MAX, "width in px"),
  },
  {
    key: "mecatl-studio.agent-name",
    label: "Agent name",
    validate: maxChars(AGENT_NAME_MAX_CHARS),
  },
  {
    key: "mecatl-studio.user-name",
    label: "Your name",
    validate: maxChars(USER_NAME_MAX_CHARS),
  },
  { key: "mecatl-studio.user-avatar", label: "Your picture", validate: avatar },
  {
    key: "mecatl-studio.agent-avatar",
    label: "Agent picture",
    validate: avatar,
  },
  {
    key: "mecatl-studio.enter-send-behavior",
    label: "Message queuing",
    validate: oneOf("queue", "steer", "queue-only"),
  },
  {
    key: "mecatl-studio.launch-target",
    label: "Start on",
    validate: oneOf("draft", "latest"),
  },
  {
    key: "mecatl-studio.hide-starter-prompts",
    label: "Starter prompts hidden",
    validate: flag,
  },
  {
    key: "mecatl-studio.welcome-dismissed",
    label: "Welcome card dismissed",
    validate: flag,
  },
  {
    key: "mecatl-studio.show-tool-calls",
    label: "Show tools",
    validate: flag,
  },
  {
    key: "mecatl-studio.expand-details",
    label: "Expand details",
    validate: flag,
  },
  {
    key: "mecatl-studio.mock-features",
    label: "Mock features (Labs)",
    validate: flag,
  },
  {
    key: "mecatl-studio.developer-tools",
    label: "Developer tools (Labs)",
    validate: flag,
  },
  { key: KEYMAP_STORAGE_KEY, label: "Keyboard shortcuts", validate: keymap },
  { key: STATUS_LINE_KEY, label: "Status line", validate: statusLine },
  {
    key: "mecatl-studio.disabled-models",
    label: "Hidden models",
    validate: disabledModels,
  },
  {
    key: "mecatl-studio.default-model",
    label: "Default model",
    validate: defaultModel,
  },
];

/**
 * localStorage/sessionStorage keys that are STATE, not preferences, and
 * deliberately stay on the browser that made them. A trailing `.` or `:`
 * marks a prefix (the key carries an id after it).
 */
export const EXCLUDED_STORAGE_KEYS: readonly string[] = [
  // Which chat belongs to which thread — session state.
  "mecatl-studio.thread-sessions",
  "mecatl-studio.threads.",
  // Composer drafts and the one-shot "New chat" landing mark.
  "mecatl-studio.draft.",
  "mecatl-studio.pending-draft",
  "mecatl-studio.chat.explicit-draft",
  // Which session-list tab is open — transient view state.
  "studio.sessions.tab",
  // A dismissed trust banner is bound to one workspace on one daemon.
  "mecatl.trust.dismissed:",
  // Workspace-services enrollment markers are per session.
  "mecatl-studio.enrollment-dismissed:",
  "mecatl-studio.enrollment-connected:",
  // Which tool profile each Studio-minted chat was created with — keyed by
  // daemon session id, so it means nothing on another daemon.
  "mecatl-studio.session-tool-profiles",
];

const ENTRIES_BY_KEY: ReadonlyMap<string, PreferenceEntry> = new Map(
  PREFERENCE_ENTRIES.map((entry) => [entry.key, entry]),
);

/** The inventory row for a storage key, or undefined for a non-preference. */
export function preferenceEntry(key: string): PreferenceEntry | undefined {
  return ENTRIES_BY_KEY.get(key);
}

/** Whether `key` is a deliberately non-portable state key. */
export function isExcludedStorageKey(key: string): boolean {
  return EXCLUDED_STORAGE_KEYS.some((excluded) =>
    /[.:]$/.test(excluded) ? key.startsWith(excluded) : key === excluded,
  );
}

// ── the document ─────────────────────────────────────────────────────────────

export interface PreferencesFile {
  format: typeof PREFERENCES_FORMAT;
  /** ISO-8601 instant the file was written. */
  exportedAt: string;
  /** Storage key → stored value, only the keys set on the exporting browser. */
  preferences: Record<string, string>;
}

function readItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Every known preference currently set in `storage`, as stored. A value is
 * copied verbatim — the importing side is where strictness applies, and a
 * corrupt stored value is reported there by name rather than vanishing here.
 */
export function exportPreferences(
  storage: Storage,
  now: Date = new Date(),
): PreferencesFile {
  const preferences: Record<string, string> = {};
  for (const entry of PREFERENCE_ENTRIES) {
    const value = readItem(storage, entry.key);
    if (value !== null) preferences[entry.key] = value;
  }
  return {
    format: PREFERENCES_FORMAT,
    exportedAt: now.toISOString(),
    preferences,
  };
}

/** The file as text, ready to download. */
export function serializePreferencesFile(file: PreferencesFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export interface RejectedPreference {
  key: string;
  reason: string;
}

export type PreferencesParseResult =
  | {
      ok: true;
      /** Key → value, every one validated by its owning preference. */
      accepted: Record<string, string>;
      /** Listed by name — nothing is dropped silently. */
      rejected: RejectedPreference[];
      exportedAt: string | null;
    }
  | { ok: false; error: string };

/**
 * Strict parse of a preferences file. The envelope (`format`, `preferences`)
 * is all-or-nothing; inside it every key is judged on its own so one bad
 * value never blocks the rest, and every refusal names the key and the
 * reason. Never throws.
 */
export function parsePreferencesFile(text: string): PreferencesParseResult {
  if (new TextEncoder().encode(text).length > PREFERENCES_FILE_MAX_BYTES) {
    return {
      ok: false,
      error: `the file is larger than ${PREFERENCES_FILE_MAX_BYTES / (1024 * 1024)} MiB`,
    };
  }
  const parsed = parseJson(text);
  if (typeof parsed === "string") return { ok: false, error: parsed };
  const doc = parsed.value;
  if (!isPlainObject(doc)) {
    return { ok: false, error: "the file must be a JSON object" };
  }
  if (doc.format !== PREFERENCES_FORMAT) {
    return {
      ok: false,
      error:
        doc.format === undefined
          ? `not a Studio preferences file — "format" is missing (expected "${PREFERENCES_FORMAT}")`
          : `not a Studio preferences file — "format" is ${JSON.stringify(doc.format)} (expected "${PREFERENCES_FORMAT}")`,
    };
  }
  if (!isPlainObject(doc.preferences)) {
    return {
      ok: false,
      error: '"preferences" must be an object of storage key: value',
    };
  }

  const accepted: Record<string, string> = {};
  const rejected: RejectedPreference[] = [];
  for (const [key, value] of Object.entries(doc.preferences)) {
    const entry = ENTRIES_BY_KEY.get(key);
    if (!entry) {
      rejected.push({ key, reason: "not a Studio preference" });
      continue;
    }
    if (typeof value !== "string") {
      rejected.push({ key, reason: "must be a string" });
      continue;
    }
    const problem = entry.validate(value);
    if (problem) {
      rejected.push({ key, reason: problem });
      continue;
    }
    accepted[key] = value;
  }
  const exportedAt =
    typeof doc.exportedAt === "string" &&
    !Number.isNaN(Date.parse(doc.exportedAt))
      ? doc.exportedAt
      : null;
  return { ok: true, accepted, rejected, exportedAt };
}

export interface PreferencesImportPlan {
  /** Keys the import writes (the file's accepted values). */
  write: string[];
  /**
   * Known preferences set here but ABSENT from the file, which the import
   * removes so this browser ends up matching the exporting one (an unset
   * preference is its default). A key the file carried but the validator
   * refused is NOT cleared — the current value stands.
   */
  clear: string[];
}

/** What `applyPreferences` would do, for the preview — no writes. */
export function planPreferencesImport(
  parsed: { accepted: Record<string, string>; rejected: RejectedPreference[] },
  storage: Storage,
): PreferencesImportPlan {
  const inFile = new Set([
    ...Object.keys(parsed.accepted),
    ...parsed.rejected.map((r) => r.key),
  ]);
  const clear: string[] = [];
  for (const entry of PREFERENCE_ENTRIES) {
    if (inFile.has(entry.key)) continue;
    if (readItem(storage, entry.key) !== null) clear.push(entry.key);
  }
  return { write: Object.keys(parsed.accepted), clear };
}

/**
 * Replaces this browser's preferences with the file's: writes every accepted
 * value and removes the known keys the file does not carry. Returns the plan
 * it applied. Throws only if storage itself refuses the write.
 */
export function applyPreferences(
  parsed: { accepted: Record<string, string>; rejected: RejectedPreference[] },
  storage: Storage,
): PreferencesImportPlan {
  const plan = planPreferencesImport(parsed, storage);
  for (const key of plan.clear) storage.removeItem(key);
  for (const key of plan.write) storage.setItem(key, parsed.accepted[key]);
  return plan;
}
