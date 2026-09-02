import { afterEach, describe, expect, it, vi } from "vitest";
import { createHarnessDebugSession } from "./debug";

/**
 * Pins the ADR-0254 debug-create wire contract: the daemon strictly decodes
 * the body and REQUIRES profile "no-fs" with an EMPTY workspace alongside the
 * target binding, so the exact field set (and the explicit `workspace: ""`)
 * is load-bearing — a drift here is a runtime 400, not a cosmetic change.
 */

type Captured = { url: string; init?: RequestInit };

function stubFetch(status: number, body: unknown): Captured {
  const captured: Captured = { url: "" };
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    captured.url = String(url);
    captured.init = init;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  return captured;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createHarnessDebugSession", () => {
  it("sends exactly the ADR-0254 create body: no-fs profile, empty workspace, target", async () => {
    const captured = stubFetch(201, { session_id: "dbg-1" });
    await expect(createHarnessDebugSession("target-1")).resolves.toBe("dbg-1");
    expect(captured.url).toBe("/api/mecatl/v1/sessions");
    expect(captured.init?.method).toBe("POST");
    const body = JSON.parse(String(captured.init?.body));
    expect(body).toEqual({
      mode: "default",
      profile: "no-fs",
      workspace: "",
      debug_target_session_id: "target-1",
    });
    // The empty workspace must be PRESENT, not merely falsy — it states the
    // daemon's empty-workspace requirement on the wire.
    expect(Object.hasOwn(body, "workspace")).toBe(true);
    expect(body.workspace).toBe("");
  });

  it("carries debug_mcp_servers only when servers are requested", async () => {
    const captured = stubFetch(201, { session_id: "dbg-2" });
    await createHarnessDebugSession("target-1", { mcpServers: ["fetch"] });
    expect(JSON.parse(String(captured.init?.body))).toMatchObject({
      debug_target_session_id: "target-1",
      debug_mcp_servers: ["fetch"],
    });
  });

  it("throws the typed error on a refusal (e.g. the 404 concealing ownership)", async () => {
    stubFetch(404, { code: "not_found", error: "debug target is unavailable" });
    await expect(createHarnessDebugSession("target-x")).rejects.toMatchObject({
      name: "HarnessApiError",
      status: 404,
      code: "not_found",
    });
  });

  it("fails loudly when the daemon returns no session id", async () => {
    stubFetch(201, {});
    await expect(createHarnessDebugSession("target-1")).rejects.toThrow(
      "no session id",
    );
  });
});
