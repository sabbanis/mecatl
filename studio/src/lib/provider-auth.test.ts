import { describe, expect, it } from "vitest";
import {
  KNOWN_AUTH_PROVIDERS,
  listAuthFileProviders,
  removeAuthFileProvider,
  validProviderName,
} from "./provider-auth.mjs";

/**
 * The auth.yaml surgery the controller performs is the ONE place Studio
 * touches the credentials file, so its scope must be provable: removal cuts
 * exactly the named provider's block, inventory reports booleans only, and a
 * malformed or hostile file degrades to "not found" rather than a wider cut.
 */

const full = [
  "# operator notes stay",
  "providers:",
  "  openrouter:",
  "    api_key: sk-or-live",
  "  openai:",
  '    api_key: "sk-oai"',
  "  openai-codex:",
  "    oauth:",
  "      access_token: tok",
  "      account_id: acct",
  "      expires_at: 2026-01-01T00:00:00Z",
  "  anthropic:",
  "    # a comment inside the block",
  "    api_key: sk-ant",
  "other_top_level: true",
  "",
].join("\n");

describe("listAuthFileProviders", () => {
  it("lists every provider with a key-present boolean, never a value", () => {
    const providers = listAuthFileProviders(full);
    expect(providers).toEqual([
      { name: "openrouter", keyPresent: true },
      { name: "openai", keyPresent: true },
      { name: "openai-codex", keyPresent: true },
      { name: "anthropic", keyPresent: true },
    ]);
    // Structural: no field of any row can carry the credential text.
    expect(JSON.stringify(providers)).not.toMatch(/sk-|tok|acct/);
  });

  it("reports a missing, empty, quoted-empty, or commented key as absent", () => {
    const text = [
      "providers:",
      "  a:",
      "    api_key:",
      "  b:",
      '    api_key: ""',
      "  c:",
      "    api_key: # add me later",
      "  d:",
      "    base_url: https://example.test",
    ].join("\n");
    expect(listAuthFileProviders(text)).toEqual([
      { name: "a", keyPresent: false },
      { name: "b", keyPresent: false },
      { name: "c", keyPresent: false },
      { name: "d", keyPresent: false },
    ]);
  });

  it("finds an oauth access_token at any nesting depth", () => {
    const text = "providers:\n  codex:\n    oauth:\n      access_token: t\n";
    expect(listAuthFileProviders(text)).toEqual([
      { name: "codex", keyPresent: true },
    ]);
  });

  it("stops at the first dedented top-level key", () => {
    const text =
      "providers:\n  a:\n    api_key: x\nnot_a_provider:\n  b:\n    api_key: y\n";
    expect(listAuthFileProviders(text).map((p) => p.name)).toEqual(["a"]);
  });

  it("returns [] for an empty file or one with no providers block", () => {
    expect(listAuthFileProviders("")).toEqual([]);
    expect(listAuthFileProviders("models:\n  default: x\n")).toEqual([]);
  });
});

describe("removeAuthFileProvider", () => {
  it("removes a middle provider's whole nested block and nothing else", () => {
    const { text, removed } = removeAuthFileProvider(full, "openai-codex");
    expect(removed).toBe(true);
    expect(text).toBe(
      [
        "# operator notes stay",
        "providers:",
        "  openrouter:",
        "    api_key: sk-or-live",
        "  openai:",
        '    api_key: "sk-oai"',
        "  anthropic:",
        "    # a comment inside the block",
        "    api_key: sk-ant",
        "other_top_level: true",
        "",
      ].join("\n"),
    );
  });

  it("never removes a longer-named sibling on a prefix match", () => {
    // "openai" and "openai-codex" coexist; removing one must not touch the other.
    const { text } = removeAuthFileProvider(full, "openai");
    expect(text).toContain("  openai-codex:");
    expect(text).toContain("      access_token: tok");
    expect(text).not.toContain('    api_key: "sk-oai"');
    expect(removeAuthFileProvider(text, "openai").removed).toBe(false);
  });

  it("removes the first and last providers cleanly", () => {
    const first = removeAuthFileProvider(full, "openrouter");
    expect(first.text).not.toContain("sk-or-live");
    expect(first.text).toContain("  openai:");
    const last = removeAuthFileProvider(full, "anthropic");
    expect(last.text).not.toContain("sk-ant");
    // The comment inside the removed block goes with it.
    expect(last.text).not.toContain("a comment inside the block");
    expect(last.text).toContain("other_top_level: true");
  });

  it("keeps the providers: header when the last remaining provider is removed", () => {
    const lone = "providers:\n  openrouter:\n    api_key: sk\n";
    const { text, removed } = removeAuthFileProvider(lone, "openrouter");
    expect(removed).toBe(true);
    expect(text).toBe("providers:\n");
  });

  it("consumes an internal blank line but keeps a trailing gap", () => {
    const text = [
      "providers:",
      "  a:",
      "    api_key: x",
      "",
      "    base_url: https://example.test",
      "",
      "  b:",
      "    api_key: y",
    ].join("\n");
    const { text: next } = removeAuthFileProvider(text, "a");
    expect(next).toBe(["providers:", "", "  b:", "    api_key: y"].join("\n"));
  });

  it("stops at a comment at the providers indent (it may document the next entry)", () => {
    const text = [
      "providers:",
      "  a:",
      "    api_key: x",
      "  # b is the production key",
      "  b:",
      "    api_key: y",
    ].join("\n");
    const { text: next } = removeAuthFileProvider(text, "a");
    expect(next).toBe(
      [
        "providers:",
        "  # b is the production key",
        "  b:",
        "    api_key: y",
      ].join("\n"),
    );
  });

  it("returns removed:false without touching the text when the name is absent", () => {
    for (const missing of ["nope", "OPENAI", "openai ", "openai:"]) {
      const { text, removed } = removeAuthFileProvider(full, missing);
      expect(removed, missing).toBe(false);
      expect(text, missing).toBe(full);
    }
    expect(removeAuthFileProvider("", "openai")).toEqual({
      text: "",
      removed: false,
    });
  });

  it("only matches inside the providers block, never a lookalike elsewhere", () => {
    const text = [
      "backups:",
      "  openai:",
      "    api_key: keep-me",
      "providers:",
      "  openrouter:",
      "    api_key: sk",
    ].join("\n");
    const { text: next, removed } = removeAuthFileProvider(text, "openai");
    expect(removed).toBe(false);
    expect(next).toBe(text);
  });
});

describe("known provider registry", () => {
  it("mirrors the daemon's closed set and never embeds a real key", () => {
    expect(KNOWN_AUTH_PROVIDERS.map((p) => p.name)).toEqual([
      "openrouter",
      "anthropic",
      "openai",
      "opencode",
      "openai-codex",
    ]);
    for (const provider of KNOWN_AUTH_PROVIDERS) {
      expect(provider.snippet).toMatch(/^providers:\n {2}[a-z0-9-]+:\n/);
      expect(provider.snippet).toMatch(/<YOUR_|<RFC3339_/);
    }
  });

  it("gates route parameters through the provider-name grammar", () => {
    for (const good of ["openai", "openai-codex", "a", "A_1"]) {
      expect(validProviderName(good), good).toBe(true);
    }
    for (const bad of ["", "-lead", "a/b", "a b", "a".repeat(65), "../x"]) {
      expect(validProviderName(bad), bad).toBe(false);
    }
  });
});
