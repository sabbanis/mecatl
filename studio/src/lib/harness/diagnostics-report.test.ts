import { describe, expect, it } from "vitest";
import {
  buildDiagnosticsReport,
  diagnosticEndpoint,
  diagnosticToken,
} from "./diagnostics-report";

/**
 * The `/diagnostics` report reaches the model, so its sanitizers are pinned
 * exactly: a token is bounded and character-restricted, an endpoint keeps
 * only scheme + host + clean path, and the report carries the documented
 * line set in order — nothing raw ever leaks through.
 */

describe("diagnosticToken", () => {
  it("passes a short opaque identifier through, trimmed", () => {
    expect(diagnosticToken("  abc-1.2_3/x+y ")).toBe("abc-1.2_3/x+y");
    expect(diagnosticToken("openai/gpt-5")).toBe("openai/gpt-5");
  });

  it("rejects an empty, oversized, spaced or control-bearing value", () => {
    expect(diagnosticToken("")).toBe("unavailable");
    expect(diagnosticToken(undefined)).toBe("unavailable");
    expect(diagnosticToken("a".repeat(129))).toBe("unavailable");
    expect(diagnosticToken("a".repeat(128))).toBe("a".repeat(128));
    expect(diagnosticToken("two words")).toBe("unavailable");
    expect(diagnosticToken("tab\there")).toBe("unavailable");
    expect(diagnosticToken("quote'd")).toBe("unavailable");
    expect(diagnosticToken("<script>")).toBe("unavailable");
  });
});

describe("diagnosticEndpoint", () => {
  it("keeps only scheme, host and a clean path", () => {
    expect(
      diagnosticEndpoint(
        "HTTPS://user:secret@api.example.com:8443/v1/../v2//chat/?key=abc#frag",
      ),
    ).toBe("https://api.example.com:8443/v2/chat");
    expect(diagnosticEndpoint("https://api.example.com")).toBe(
      "https://api.example.com/",
    );
  });

  it("reads unavailable for empty, hostless, oversized or control-bearing input", () => {
    expect(diagnosticEndpoint("")).toBe("unavailable");
    expect(diagnosticEndpoint(null)).toBe("unavailable");
    expect(diagnosticEndpoint("not a url")).toBe("unavailable");
    expect(diagnosticEndpoint("mailto:someone@example.com")).toBe(
      "unavailable",
    );
    expect(
      diagnosticEndpoint(`https://example.com/a${String.fromCharCode(0)}b`),
    ).toBe("unavailable");
    expect(diagnosticEndpoint(`https://example.com/${"a".repeat(2048)}`)).toBe(
      "unavailable",
    );
  });
});

describe("buildDiagnosticsReport", () => {
  it("renders exactly the documented line set, sanitized", () => {
    const report = buildDiagnosticsReport({
      platform: "macOS",
      clientBuild: "",
      mode: "external",
      serverInfo: {
        buildId: "abc123",
        serverImplementation: "mecated",
        providerEndpoint: "https://key:secret@openrouter.ai/api/v1?x=1",
      },
      deployment: "staging eu",
      resolvedModel: { providerId: "openrouter", modelId: "openai/gpt-5" },
      permissionMode: "acceptEdits",
    });
    expect(report.split("\n")).toEqual([
      "Mecatl diagnostics (current client state only):",
      "platform: macOS",
      "client build: unavailable",
      "server mode: external",
      "server build: abc123",
      "server implementation: mecated",
      "LLM provider endpoint: https://openrouter.ai/api/v1",
      "deployment: unavailable",
      "active provider: openrouter",
      "active model: openai/gpt-5",
      "permission mode: acceptEdits",
    ]);
  });

  it("reads unavailable across the board against an older daemon with no session", () => {
    const report = buildDiagnosticsReport({
      platform: "browser",
      clientBuild: "",
      mode: "managed",
      serverInfo: null,
      deployment: "",
      resolvedModel: null,
      permissionMode: "default",
    });
    expect(report).toContain("server mode: managed");
    expect(report).toContain("server build: unavailable");
    expect(report).toContain("LLM provider endpoint: unavailable");
    expect(report).toContain("active provider: unavailable");
    expect(report).toContain("active model: unavailable");
    expect(report).toContain("permission mode: default");
  });
});
