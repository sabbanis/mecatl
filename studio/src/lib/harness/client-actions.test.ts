import { afterEach, describe, expect, it, vi } from "vitest";
import type { StreamEvent } from "@/features/agent/types";
import {
  cancelHarnessSteer,
  compactHarnessSession,
  fetchHarnessSessionDetail,
  retryHarnessRun,
  steerHarnessRun,
} from "./client";

/**
 * Pins the request/response contracts of the chat-resilience client calls:
 * manual compaction (ADR 0244), the strict multimodal steer + the
 * cancel-steer route naming (ADR 0252), and the GET-session resolved-model
 * echo the context meter reads (B1).
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

describe("compactHarnessSession", () => {
  it("POSTs bodyless and reads the compacted bool", async () => {
    const captured = stubFetch(200, { compacted: true });
    await expect(compactHarnessSession("s1")).resolves.toBe(true);
    expect(captured.url).toBe("/api/mecatl/v1/sessions/s1/compact");
    expect(captured.init?.method).toBe("POST");
    expect(captured.init?.body).toBeUndefined();
  });

  it("reads an empty answer as nothing-to-compact (the live daemon omits false)", async () => {
    stubFetch(200, {});
    await expect(compactHarnessSession("s1")).resolves.toBe(false);
  });

  it("throws the typed error on a refusal", async () => {
    stubFetch(412, { code: "session_active", error: "session is running" });
    await expect(compactHarnessSession("s1")).rejects.toMatchObject({
      name: "HarnessApiError",
      status: 412,
      code: "session_active",
    });
  });
});

describe("steerHarnessRun", () => {
  it("sends the strict body: text, message_id, parts, and expected_run_id (ADR 0252)", async () => {
    const captured = stubFetch(200, {
      outcome: "accepted",
      message_id: "m-1",
    });
    const result = await steerHarnessRun("s1", "focus", "m-1", {
      expectedRunId: "run-9",
      parts: [{ kind: "image", mime_type: "image/png", data: "aGk=" }],
    });
    expect(result).toEqual({ outcome: "accepted", messageId: "m-1" });
    expect(captured.url).toBe("/api/mecatl/v1/sessions/s1/steer");
    expect(JSON.parse(String(captured.init?.body))).toEqual({
      text: "focus",
      message_id: "m-1",
      expected_run_id: "run-9",
      parts: [{ kind: "image", mime_type: "image/png", data: "aGk=" }],
    });
  });

  it("omits parts and expected_run_id when the caller has none (legacy shape)", async () => {
    const captured = stubFetch(200, { outcome: "appended" });
    await steerHarnessRun("s1", "focus", "m-2");
    expect(JSON.parse(String(captured.init?.body))).toEqual({
      text: "focus",
      message_id: "m-2",
    });
  });

  it("surfaces the strict 409 as the typed stale_run_control error", async () => {
    stubFetch(409, {
      code: "stale_run_control",
      error: "the named run already ended",
    });
    await expect(
      steerHarnessRun("s1", "focus", "m-3", { expectedRunId: "run-old" }),
    ).rejects.toMatchObject({
      name: "HarnessApiError",
      status: 409,
      code: "stale_run_control",
    });
  });
});

describe("cancelHarnessSteer", () => {
  it("POSTs the ADR-0252 cancel-steer route (steer-cancel is the deprecated alias)", async () => {
    const captured = stubFetch(200, { outcome: "retracted" });
    await expect(cancelHarnessSteer("s1")).resolves.toBe("retracted");
    expect(captured.url).toBe("/api/mecatl/v1/sessions/s1/cancel-steer");
    expect(captured.init?.method).toBe("POST");
  });
});

describe("retryHarnessRun", () => {
  it("POSTs the retry route bodyless and relays the SSE exactly like a prompt (B2.2)", async () => {
    const sse = [
      'data: {"type":"model.retry","model_retry":{"retry_disposition":2}}',
      "",
      'data: {"type":"message.delta","text":"resumed"}',
      "",
      'data: {"type":"result","result":{"stop":"end_turn","text":"done"}}',
      "",
      "",
    ].join("\n");
    const captured: Captured = { url: "" };
    vi.stubGlobal(
      "fetch",
      async (url: RequestInfo | URL, init?: RequestInit) => {
        captured.url = String(url);
        captured.init = init;
        return new Response(sse, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      },
    );
    const events: StreamEvent[] = [];
    await retryHarnessRun("s1", (event) => events.push(event));
    expect(captured.url).toBe("/api/mecatl/v1/sessions/s1/retry");
    expect(captured.init?.method).toBe("POST");
    expect(captured.init?.body).toBeUndefined();
    expect(events).toEqual([
      { type: "notice", text: "Retrying the failed step…" },
      { type: "token", text: "resumed" },
      {
        type: "run_result",
        stop: "end_turn",
        text: "done",
        errorText: "",
        permanent: false,
      },
    ]);
  });

  it("surfaces the 409 ineligibility as the typed code", async () => {
    stubFetch(409, {
      code: "failed_step_retry_ineligible",
      error: "retry is not eligible",
    });
    await expect(retryHarnessRun("s1", () => {})).rejects.toMatchObject({
      name: "HarnessApiError",
      status: 409,
      code: "failed_step_retry_ineligible",
    });
  });
});

describe("fetchHarnessSessionDetail", () => {
  it("decodes the resolved_model echo and the capabilities object (B1)", async () => {
    stubFetch(200, {
      session_id: "s1",
      resolved_model: {
        provider_id: "openrouter",
        model_id: "openai/gpt-5",
        context_window: 400000,
      },
      capabilities: { manual_compaction: true },
    });
    await expect(fetchHarnessSessionDetail("s1")).resolves.toEqual({
      resolvedModel: {
        providerId: "openrouter",
        modelId: "openai/gpt-5",
        contextWindow: 400000,
      },
      capabilities: { manual_compaction: true },
    });
  });

  it("tolerates a daemon that echoes neither field", async () => {
    stubFetch(200, { session_id: "s1", mode: "default" });
    await expect(fetchHarnessSessionDetail("s1")).resolves.toEqual({
      resolvedModel: null,
      capabilities: {},
    });
  });
});
