import { validProviderName } from "./provider-auth.mjs";

/**
 * The controller's DAEMON DEFAULTS document — the mecated spawn flags an
 * operator would otherwise pass on the command line (default/subagent model,
 * reasoning effort, context window, prompt caching, provider base URLs, the
 * ToolHive LLM gateway, model aliases and slots, the credentials-file path)
 * plus the durable active-provider choice. Normalised here and turned into
 * the argv fragment `startMecatl` appends. Shared by the controller
 * (`scripts/local-controller.mjs`), the browser client and both vitest
 * suites — the same dual-import pattern as controller-permissions.mjs and
 * storage-settings.mjs — so the flag grammar cannot drift between the
 * process that spawns mecated and the UI that edits the document.
 *
 * Every value is a CLI flag, never a settings.yaml key: the CLI tier wins,
 * and the flags stay effective when an imported operator-settings.yaml owns
 * `--permission-config`. Nothing here is a credential — `apiKeyFile` is a
 * PATH the daemon reads, not a key — and the module is browser-importable
 * (no node: imports), so the UI validates with the exact rules the
 * controller enforces.
 */

/** mecated's `--reasoning-effort` tiers; "" is auto (flag omitted). */
export const REASONING_EFFORTS = Object.freeze([
  "",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

/** `--anthropic-cache-ttl` values; "" omits the flag (the API's 5m default). */
export const ANTHROPIC_CACHE_TTLS = Object.freeze(["", "5m", "1h"]);

/** `--toolhive-llm-mode` values; "auto" is mecated's default (flag omitted). */
export const TOOLHIVE_MODES = Object.freeze(["auto", "proxy", "direct"]);

/** The built-in kinds mecated exposes a `--<kind>-base-url` flag for. */
export const BASE_URL_KINDS = Object.freeze([
  "openrouter",
  "openai",
  "anthropic",
  "opencode",
]);

/** Slot names another Studio page owns: the Model router page writes
 *  `models.slots.router`, so a daemon-defaults `--model-slot router=…` would
 *  fight it. */
export const RESERVED_SLOTS = Object.freeze(["router"]);

/** Alias / slot key grammar: a lower-case identifier, 1-40 chars. */
const MODEL_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/;
const maxModelIdLength = 200;
const maxPathLength = 4096;
const maxContextWindow = 100_000_000;
const maxAliasCount = 64;

/** The document before anything was saved: every flag omitted. */
export const DAEMON_DEFAULTS_EMPTY = Object.freeze({
  models: Object.freeze({}),
  reasoningEffort: "",
  contextWindowOverride: 0,
  promptCache: Object.freeze({ disabled: false, anthropicTtl: "" }),
  baseUrls: Object.freeze({
    openrouter: "",
    openai: "",
    anthropic: "",
    opencode: "",
  }),
  toolhive: Object.freeze({ enabled: true, baseUrl: "", mode: "auto" }),
  aliases: Object.freeze({}),
  slots: Object.freeze({}),
  apiKeyFile: "",
  activeProvider: null,
});

/** @param {string} message */
const badRequest = (message) =>
  Object.assign(new Error(message), { statusCode: 400 });

/** @param {unknown} value */
const isRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** @param {string} value */
const hasControlCharacters = (value) => {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
};

/** @param {string} hostname */
export function isLoopbackHostname(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

/**
 * A provider base-URL override: HTTPS anywhere, or plain HTTP on loopback
 * (a local proxy such as a LiteLLM or ToolHive gateway); never credentials,
 * a query, or a fragment in the URL.
 * @param {unknown} raw
 * @returns {boolean}
 */
export function validDaemonBaseURL(raw) {
  let url;
  try {
    url = new URL(String(raw ?? ""));
  } catch {
    return false;
  }
  if (url.username || url.password || url.search || url.hash) return false;
  if (url.hostname === "") return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && isLoopbackHostname(url.hostname);
}

/**
 * The ToolHive LLM proxy URL: mecated requires it to resolve to loopback
 * (`--toolhive-llm-base-url … must resolve to loopback`).
 * @param {unknown} raw
 * @returns {boolean}
 */
export function validToolhiveBaseURL(raw) {
  let url;
  try {
    url = new URL(String(raw ?? ""));
  } catch {
    return false;
  }
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    isLoopbackHostname(url.hostname) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  );
}

/**
 * Whether `key` may name a model alias or slot.
 * @param {unknown} key
 */
export function validModelKey(key) {
  return typeof key === "string" && MODEL_KEY_PATTERN.test(key);
}

/**
 * A model id / selector as mecated accepts it on a flag: non-empty after
 * trimming, no control characters, bounded.
 * @param {unknown} value
 * @param {string} what
 * @returns {string} "" when absent
 */
function modelValue(value, what) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw badRequest(`${what} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (hasControlCharacters(trimmed))
    throw badRequest(`${what} must not contain control characters`);
  if (trimmed.length > maxModelIdLength)
    throw badRequest(`${what} is longer than ${maxModelIdLength} characters`);
  return trimmed;
}

/**
 * One alias or slot map: keys under MODEL_KEY_PATTERN, non-empty values,
 * bounded count. Keys come back sorted so two equal maps serialise equal.
 * @param {unknown} raw
 * @param {"alias"|"slot"} noun
 * @returns {Record<string, string>}
 */
function modelMap(raw, noun) {
  if (raw === undefined || raw === null) return {};
  if (!isRecord(raw)) throw badRequest(`${noun} bindings must be an object`);
  /** @type {Record<string, string>} */
  const out = {};
  const entries = Object.entries(/** @type {Record<string, unknown>} */ (raw));
  if (entries.length > maxAliasCount)
    throw badRequest(`At most ${maxAliasCount} ${noun} bindings are kept`);
  for (const [key, value] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    if (!validModelKey(key))
      throw badRequest(
        `"${key}" is not a valid ${noun} name: lower-case letters, digits, "_" or "-", starting with a letter, at most 40 characters`,
      );
    if (noun === "slot" && RESERVED_SLOTS.includes(key))
      throw badRequest(
        `The "${key}" slot is owned by the Model router page — configure it there`,
      );
    const model = modelValue(value, `The model for ${noun} "${key}"`);
    if (!model) throw badRequest(`The ${noun} "${key}" needs a model`);
    out[key] = model;
  }
  return out;
}

/**
 * The per-provider default/subagent models. Keyed by provider kind because
 * mecated validates `--default-model` against the CURRENT default provider
 * fail-fast: a model saved for openrouter must not be passed when the
 * daemon comes up on anthropic, or the restart would fail until the user
 * found and cleared it. Entries with neither field set are dropped.
 * @param {unknown} raw
 * @returns {Record<string, {defaultModel: string, subagentModel: string}>}
 */
function modelDefaults(raw) {
  if (raw === undefined || raw === null) return {};
  if (!isRecord(raw)) throw badRequest("models must be an object");
  /** @type {Record<string, {defaultModel: string, subagentModel: string}>} */
  const out = {};
  const entries = Object.entries(/** @type {Record<string, unknown>} */ (raw));
  for (const [kind, value] of entries.sort(([a], [b]) => a.localeCompare(b))) {
    if (kind === "mock" || !(kind === "toolhive" || validProviderName(kind)))
      throw badRequest(
        `"${kind}" is not a provider kind a model default can be saved for`,
      );
    if (!isRecord(value)) throw badRequest(`models.${kind} must be an object`);
    const entry = /** @type {Record<string, unknown>} */ (value);
    const defaultModel = modelValue(
      entry.defaultModel,
      `The default model for ${kind}`,
    );
    const subagentModel = modelValue(
      entry.subagentModel,
      `The subagent model for ${kind}`,
    );
    if (defaultModel || subagentModel)
      out[kind] = { defaultModel, subagentModel };
  }
  return out;
}

/**
 * `apiKeyFile`: "" (the XDG default), or an absolute POSIX path to a
 * `.yaml`/`.yml` file. With `configDir` given (the controller passes the
 * daemon's mecatl config directory) the path must sit INSIDE it and carry no
 * `.`/`..` segments — the controller reads AND rewrites this file for the
 * provider inventory/removal routes, so a browser-settable path must never
 * become an arbitrary-file primitive.
 * @param {unknown} raw
 * @param {string} configDir
 * @returns {string}
 */
function credentialsFile(raw, configDir) {
  if (raw === undefined || raw === null) return "";
  if (typeof raw !== "string")
    throw badRequest("The credentials file path must be a string");
  const path = raw.trim();
  if (!path) return "";
  if (path.includes("\0"))
    throw badRequest("The credentials file path must not contain a NUL byte");
  if (path.length > maxPathLength)
    throw badRequest(
      `The credentials file path is longer than ${maxPathLength} characters`,
    );
  if (!path.startsWith("/"))
    throw badRequest("The credentials file path must be absolute");
  if (!/\.ya?ml$/.test(path))
    throw badRequest("The credentials file must be a .yaml or .yml file");
  const segments = path.split("/").slice(1);
  if (
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  )
    throw badRequest(
      'The credentials file path must not contain empty, "." or ".." segments',
    );
  if (configDir) {
    const root = configDir.endsWith("/") ? configDir : `${configDir}/`;
    if (!path.startsWith(root))
      throw badRequest(
        `The credentials file must live inside the daemon's mecatl config directory (${configDir})`,
      );
  }
  return path;
}

/**
 * Validates and fills a daemon-defaults document (a saved state file or a
 * PUT /daemon-defaults body). Unknown enum tokens THROW rather than fall
 * back — the UI only ever offers the closed sets, so a stranger is a bug
 * worth surfacing. Absent fields take the empty (flag-omitted) value.
 *
 * @param {unknown} input
 * @param {{configDir?: string}} [options] — `configDir` confines
 *   `apiKeyFile` (the controller passes it; the browser does not know it).
 * @returns {{
 *   models: Record<string, {defaultModel: string, subagentModel: string}>,
 *   reasoningEffort: string,
 *   contextWindowOverride: number,
 *   promptCache: {disabled: boolean, anthropicTtl: string},
 *   baseUrls: Record<string, string>,
 *   toolhive: {enabled: boolean, baseUrl: string, mode: string},
 *   aliases: Record<string, string>,
 *   slots: Record<string, string>,
 *   apiKeyFile: string,
 *   activeProvider: string | null,
 * }}
 */
export function normalizeDaemonDefaults(input, options = {}) {
  const source = isRecord(input)
    ? /** @type {Record<string, unknown>} */ (input)
    : {};

  const rawEffort =
    typeof source.reasoningEffort === "string"
      ? source.reasoningEffort.trim().toLowerCase()
      : "";
  const reasoningEffort = rawEffort === "auto" ? "" : rawEffort;
  if (!REASONING_EFFORTS.includes(reasoningEffort))
    throw badRequest(
      `Unknown reasoning effort "${rawEffort}" — expected auto, low, medium, high, xhigh or max`,
    );

  let contextWindowOverride = 0;
  if (
    source.contextWindowOverride !== undefined &&
    source.contextWindowOverride !== null &&
    source.contextWindowOverride !== ""
  ) {
    const raw = source.contextWindowOverride;
    const parsed =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && /^\s*\d+\s*$/.test(raw)
          ? Number(raw)
          : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > maxContextWindow)
      throw badRequest(
        `The context window override must be a whole number of tokens between 0 and ${maxContextWindow} (0 = off)`,
      );
    contextWindowOverride = parsed;
  }

  const cache = isRecord(source.promptCache)
    ? /** @type {Record<string, unknown>} */ (source.promptCache)
    : {};
  const anthropicTtl =
    typeof cache.anthropicTtl === "string"
      ? cache.anthropicTtl.trim().toLowerCase()
      : "";
  if (!ANTHROPIC_CACHE_TTLS.includes(anthropicTtl))
    throw badRequest(
      `Unknown Anthropic cache TTL "${anthropicTtl}" — expected 5m, 1h, or the API default`,
    );
  const promptCache = { disabled: cache.disabled === true, anthropicTtl };

  const urls = isRecord(source.baseUrls)
    ? /** @type {Record<string, unknown>} */ (source.baseUrls)
    : {};
  for (const kind of Object.keys(urls)) {
    if (!BASE_URL_KINDS.includes(kind))
      throw badRequest(
        `mecated has no base-URL flag for "${kind}" — supported: ${BASE_URL_KINDS.join(", ")}`,
      );
  }
  /** @type {Record<string, string>} */
  const baseUrls = {};
  for (const kind of BASE_URL_KINDS) {
    const raw = urls[kind];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (raw !== undefined && raw !== null && typeof raw !== "string")
      throw badRequest(`The ${kind} base URL must be a string`);
    if (value && !validDaemonBaseURL(value))
      throw badRequest(
        `The ${kind} base URL must be an HTTPS URL (or plain HTTP on loopback) without credentials, query, or fragment`,
      );
    baseUrls[kind] = value;
  }

  const th = isRecord(source.toolhive)
    ? /** @type {Record<string, unknown>} */ (source.toolhive)
    : {};
  const toolhiveMode =
    typeof th.mode === "string" && th.mode.trim() !== ""
      ? th.mode.trim().toLowerCase()
      : "auto";
  if (!TOOLHIVE_MODES.includes(toolhiveMode))
    throw badRequest(
      `Unknown ToolHive routing mode "${toolhiveMode}" — expected auto, proxy or direct`,
    );
  const toolhiveBaseUrl =
    typeof th.baseUrl === "string" ? th.baseUrl.trim() : "";
  if (toolhiveBaseUrl && !validToolhiveBaseURL(toolhiveBaseUrl))
    throw badRequest(
      "The ToolHive proxy URL must be an http(s) URL on loopback (localhost, 127.0.0.1 or ::1) without credentials, query, or fragment",
    );
  const toolhive = {
    enabled: th.enabled !== false,
    baseUrl: toolhiveBaseUrl,
    mode: toolhiveMode,
  };

  const aliases = modelMap(source.aliases, "alias");
  const slots = modelMap(source.slots, "slot");
  const models = modelDefaults(source.models);
  const apiKeyFile = credentialsFile(
    source.apiKeyFile,
    options.configDir ?? "",
  );

  let activeProvider = null;
  if (source.activeProvider !== undefined && source.activeProvider !== null) {
    if (typeof source.activeProvider !== "string")
      throw badRequest("activeProvider must be a provider kind or null");
    const kind = source.activeProvider.trim().toLowerCase();
    if (kind !== "") {
      if (kind !== "mock" && kind !== "toolhive" && !validProviderName(kind))
        throw badRequest(`"${kind}" is not a valid provider kind`);
      activeProvider = kind;
    }
  }
  if (!toolhive.enabled && activeProvider === "toolhive")
    throw badRequest(
      "The ToolHive LLM gateway cannot be disabled while it is the active provider — switch providers first",
    );

  return {
    models,
    reasoningEffort,
    contextWindowOverride,
    promptCache,
    baseUrls,
    toolhive,
    aliases,
    slots,
    apiKeyFile,
    activeProvider,
  };
}

/**
 * The mecated flags for a document, for a spawn on provider `kind`: exactly
 * the flags whose value is set, nothing for the empty ones, so an untouched
 * document spawns the byte-identical pre-feature command line. The model
 * pair is taken from `models[kind]` ONLY (never for the mock, which has no
 * catalogue to validate against), so switching providers can never carry a
 * stale `--default-model` into a fail-fast startup check.
 *
 * @param {ReturnType<typeof normalizeDaemonDefaults>} defaults
 * @param {string} kind — the provider the daemon is being started on
 * @returns {string[]}
 */
export function daemonDefaultArgs(defaults, kind) {
  /** @type {string[]} */
  const args = [];
  const entry = kind && kind !== "mock" ? defaults.models[kind] : undefined;
  if (entry?.defaultModel) args.push("--default-model", entry.defaultModel);
  if (entry?.subagentModel) args.push("--subagent-model", entry.subagentModel);
  if (defaults.reasoningEffort)
    args.push("--reasoning-effort", defaults.reasoningEffort);
  if (defaults.contextWindowOverride > 0)
    args.push(
      "--context-window-override",
      String(defaults.contextWindowOverride),
    );
  if (defaults.promptCache.disabled) args.push("--no-prompt-cache");
  if (defaults.promptCache.anthropicTtl)
    args.push("--anthropic-cache-ttl", defaults.promptCache.anthropicTtl);
  for (const urlKind of BASE_URL_KINDS) {
    const url = defaults.baseUrls[urlKind];
    if (url) args.push(`--${urlKind}-base-url`, url);
  }
  if (!defaults.toolhive.enabled) args.push("--toolhive-llm=false");
  if (defaults.toolhive.baseUrl)
    args.push("--toolhive-llm-base-url", defaults.toolhive.baseUrl);
  if (defaults.toolhive.mode !== "auto")
    args.push("--toolhive-llm-mode", defaults.toolhive.mode);
  for (const [name, model] of Object.entries(defaults.aliases))
    args.push("--model-alias", `${name}=${model}`);
  for (const [slot, selector] of Object.entries(defaults.slots))
    args.push("--model-slot", `${slot}=${selector}`);
  if (defaults.apiKeyFile) args.push("--api-key-file", defaults.apiKeyFile);
  return args;
}
