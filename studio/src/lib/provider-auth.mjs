// Pure helpers over mecated's auth.yaml (`providers:` block) shared by the
// managed-mode controller and its vitest suite. Everything here is a LINE
// SCAN, never a YAML parse, mirroring listConfiguredProviderNames in
// scripts/local-controller.mjs — and, deliberately, nothing in this module
// can RETURN a credential: inventory reports booleans, and removal returns
// the file with a block cut out. Reading a key VALUE (for the controller's
// server-side key test) lives in the controller script only, never in a
// module the browser bundle may import (Studio rule 3: credentials never
// cross the browser/controller boundary).

/**
 * The provider kinds mecated's auth.yaml understands, mirrored from the Go
 * side's closed set (`internal/cliconfig/cliconfig.go` knownAuthProviders:
 * "anthropic", "openai", "openrouter", "opencode", "openai-codex"). There is
 * no machine-readable source the controller could read at runtime, so the
 * list is pinned here with this citation; extend it when the daemon's set
 * grows. Each entry carries the exact auth.yaml snippet the guided-add
 * dialog shows — with a `<YOUR_KEY>` placeholder, never a real value.
 * `testable` marks kinds the controller can key-test with one cheap
 * authenticated call ("toolhive" is absent: it is auto-detected from
 * ToolHive's own config and never appears in auth.yaml).
 */
export const KNOWN_AUTH_PROVIDERS = [
  {
    name: "openrouter",
    label: "OpenRouter",
    testable: true,
    snippet: "providers:\n  openrouter:\n    api_key: <YOUR_KEY>\n",
    note: "Create a key at openrouter.ai/keys.",
  },
  {
    name: "anthropic",
    label: "Anthropic",
    testable: true,
    snippet: "providers:\n  anthropic:\n    api_key: <YOUR_KEY>\n",
    note: "An Anthropic API key (console.anthropic.com).",
  },
  {
    name: "openai",
    label: "OpenAI",
    testable: true,
    snippet: "providers:\n  openai:\n    api_key: <YOUR_KEY>\n",
    note: "An OpenAI API key (platform.openai.com).",
  },
  {
    name: "opencode",
    label: "OpenCode Go",
    testable: true,
    snippet: "providers:\n  opencode:\n    api_key: <YOUR_KEY>\n",
    note: "An OpenCode Go gateway key.",
  },
  {
    name: "openai-codex",
    label: "OpenAI Codex subscription",
    testable: false,
    // The oauth block is a manually supplied ChatGPT Codex subscription token
    // (docs/usage.md "OpenAI Codex subscription"), not a long-lived API key —
    // which is also why the controller refuses to key-test it: a merely
    // EXPIRED token would read as "rejected" and send the operator chasing a
    // non-problem.
    snippet:
      "providers:\n  openai-codex:\n    oauth:\n      access_token: <YOUR_ACCESS_TOKEN>\n      account_id: <YOUR_ACCOUNT_ID>\n      expires_at: <RFC3339_EXPIRY>\n",
    note: "A manually supplied ChatGPT Codex subscription token; see the mecatl usage docs for the copy-in steps.",
  },
];

/** The daemon's provider-name grammar as the controller's routes accept it. */
export function validProviderName(name) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name);
}

const providersHeader = /^providers:\s*$/;
const providerKeyLine = /^ {2}([A-Za-z0-9_-]+):/;

/** Strips matched surrounding quotes from a scalar, mirroring what a YAML
 *  reader would see. Returns "" for a comment-only remainder. */
function scalarPresent(raw) {
  let value = (raw ?? "").trim();
  if (value === "" || value.startsWith("#")) return false;
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    value = value.slice(1, -1).trim();
  }
  return value !== "";
}

/**
 * Names + key-health BOOLEANS of the providers configured in an auth.yaml
 * text — never their values. A provider "has a key" when its block carries a
 * non-empty `api_key:` scalar or (openai-codex's shape) a non-empty
 * `access_token:` anywhere in its nested block.
 *
 * @param {string} text
 * @returns {{name: string, keyPresent: boolean}[]}
 */
export function listAuthFileProviders(text) {
  const lines = String(text ?? "").split("\n");
  const providersAt = lines.findIndex((line) => providersHeader.test(line));
  if (providersAt === -1) return [];
  const providers = [];
  let current = null;
  for (const line of lines.slice(providersAt + 1)) {
    if (/^\s*#/.test(line) || line.trim() === "") continue;
    const key = line.match(providerKeyLine);
    if (key) {
      current = { name: key[1], keyPresent: false };
      providers.push(current);
      continue;
    }
    if (/^\S/.test(line)) break; // dedented past the providers block
    if (!current) continue; // deeper content before any provider key: skip
    const credential = line.match(/^\s+(?:api_key|access_token):(.*)$/);
    if (credential && scalarPresent(credential[1])) current.keyPresent = true;
  }
  return providers;
}

/**
 * Removes the named provider's block from an auth.yaml text: the exact
 * 2-space-indented `<name>:` line inside the top-level `providers:` block
 * plus every line that provably belongs to it (deeper-indented lines,
 * including nested blocks and indented comments; blank lines only when more
 * of the block follows them). Everything else is preserved byte-for-byte —
 * comments at the providers level, sibling providers, unrelated top-level
 * keys, trailing whitespace. The name match is exact (`===` on the captured
 * key), so removing "openai" can never eat "openai-codex".
 *
 * The `providers:` header itself is left in place even when the last entry
 * is removed — an empty `providers:` key is valid YAML the daemon reads as
 * "no providers", and keeping it means the operator's file keeps its shape.
 *
 * @param {string} text
 * @param {string} name
 * @returns {{text: string, removed: boolean}}
 */
export function removeAuthFileProvider(text, name) {
  const source = String(text ?? "");
  const lines = source.split("\n");
  const providersAt = lines.findIndex((line) => providersHeader.test(line));
  if (providersAt === -1) return { text: source, removed: false };

  let start = -1;
  for (let i = providersAt + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\S/.test(line)) break; // dedented past the providers block
    const key = line.match(providerKeyLine);
    if (key && key[1] === name) {
      start = i;
      break;
    }
  }
  if (start === -1) return { text: source, removed: false };

  // Walk the block: consume deeper-indented lines outright; consume a run of
  // blank lines ONLY when a deeper-indented line follows it (a blank gap
  // before the next sibling or a dedent stays in the file). A comment at the
  // providers indent (or shallower) may document the NEXT entry, so it ends
  // the block conservatively.
  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() === "") {
      let ahead = end + 1;
      while (ahead < lines.length && lines[ahead].trim() === "") ahead += 1;
      if (ahead < lines.length && /^(?: {3,}|\t)/.test(lines[ahead])) {
        end = ahead + 1;
        continue;
      }
      break;
    }
    if (/^(?: {3,}|\t)/.test(line)) {
      end += 1;
      continue;
    }
    break;
  }
  return {
    text: [...lines.slice(0, start), ...lines.slice(end)].join("\n"),
    removed: true,
  };
}
