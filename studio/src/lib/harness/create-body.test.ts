import { describe, expect, it, vi } from "vitest";
import {
  createHarnessSession,
  createThreadHarnessSession,
  forkHarnessSessionToModel,
} from "./client";
import { createHarnessDebugSession } from "./debug";

/**
 * Compatibility pin (requirement H4): the daemon strictly decodes the
 * POST /v1/sessions create body — an unknown or mis-cased key (protojson
 * camelCase included) is a 400 naming the field. These tests freeze the exact
 * field sets Studio's create paths may emit so a stray key fails HERE, not as
 * a baffling runtime 400. Extending the body is fine — extend the allowlist
 * in the same change, knowing the daemon accepts the field.
 */

const ALLOWED = new Set([
  "mode",
  "model_id",
  "provider_id",
  "source_session_id",
]);

/**
 * The debug create (ADR 0254) is pinned as its OWN exact set rather than by
 * widening ALLOWED: it is the one create that may carry `workspace` (and only
 * as ""), `profile`, and the debug fields — the daemon accepts all of them —
 * while the chat/thread/fork bodies must stay workspace-free (rule 2: the
 * workspace is proxy-injected, never browser-supplied). Folding these keys
 * into the shared allowlist would let a stray workspace on a PLAIN create
 * pass this suite silently.
 */
const DEBUG_ALLOWED = [
  "debug_mcp_servers",
  "debug_target_session_id",
  "mode",
  "profile",
  "workspace",
] as const;

function captureBody(): { body: () => Record<string, unknown> } {
  const captured: { value?: Record<string, unknown> } = {};
  vi.stubGlobal("fetch", async (url: unknown, init?: RequestInit) => {
    // Only the CREATE call is pinned — the thread/fork paths follow up with a
    // cosmetic rename request whose body is a different contract.
    if (String(url).endsWith("/v1/sessions")) {
      captured.value = JSON.parse(String(init?.body ?? "{}"));
    }
    return new Response(JSON.stringify({ session_id: "s-1" }), {
      status: 200,
    });
  });
  return {
    body: () => {
      if (!captured.value) throw new Error("no create request captured");
      return captured.value;
    },
  };
}

describe("session create bodies stay inside the daemon's strict field set", () => {
  it("plain create with a model pick", async () => {
    const captured = captureBody();
    try {
      await createHarnessSession("plan", {
        modelId: "m",
        providerId: "openrouter",
      });
      const keys = Object.keys(captured.body());
      expect(keys.every((k) => ALLOWED.has(k))).toBe(true);
      // snake_case, never protojson camelCase.
      expect(keys.some((k) => /[A-Z]/.test(k))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("auto-routed create omits the model fields entirely", async () => {
    const captured = captureBody();
    try {
      await createHarnessSession("default");
      expect(Object.keys(captured.body()).sort()).toEqual(["mode"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("thread create", async () => {
    const captured = captureBody();
    try {
      await createThreadHarnessSession("parent-1", "Thread: x");
      const keys = Object.keys(captured.body());
      expect(keys.every((k) => ALLOWED.has(k))).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("model-switch fork", async () => {
    const captured = captureBody();
    try {
      await forkHarnessSessionToModel(
        "src-1",
        { modelId: "m", providerId: "openrouter" },
        "Title",
      );
      const keys = Object.keys(captured.body());
      expect(keys.every((k) => ALLOWED.has(k))).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("debug create (ADR 0254) stays inside its own exact set", async () => {
    const captured = captureBody();
    try {
      await createHarnessDebugSession("target-1", { mcpServers: ["fetch"] });
      const body = captured.body();
      expect(Object.keys(body).sort()).toEqual([...DEBUG_ALLOWED]);
      // The workspace this one create carries must be the EMPTY one the
      // daemon requires — never a path.
      expect(body.workspace).toBe("");
      expect(body.profile).toBe("no-fs");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
