import { afterEach, describe, expect, it, vi } from "vitest";
import { HarnessApiError } from "./client";
import {
  parseSSEFrame,
  type WatchDelivery,
  WatchStreamError,
  watchSessionEvents,
} from "./watch";

/**
 * Pins the ADR-0250 watch client: the `event:`-aware SSE frame grammar (the
 * prompt-stream parser drops tagged frames — this one must not), envelope
 * delivery with cursor tracking, the typed terminal faults, and the
 * reconnect-from-cursor path on a resumable `watch_lagging`.
 */

describe("parseSSEFrame", () => {
  it("reads the data line of a plain frame, with no event tag", () => {
    expect(parseSSEFrame('data: {"phase":"live"}')).toEqual({
      event: "",
      data: '{"phase":"live"}',
    });
  });

  it("reads an event:-tagged frame — the kind the prompt parser drops", () => {
    expect(
      parseSSEFrame('event: error\ndata: {"code":"watch_lagging"}'),
    ).toEqual({ event: "error", data: '{"code":"watch_lagging"}' });
  });

  it("joins multi-line data with newlines, per the EventSource grammar", () => {
    expect(parseSSEFrame("data: line one\ndata: line two")).toEqual({
      event: "",
      data: "line one\nline two",
    });
  });

  it("strips one leading space, tolerates CRLF, and skips comment lines", () => {
    expect(parseSSEFrame(": keepalive\r\ndata:  padded\r")).toEqual({
      event: "",
      data: " padded",
    });
  });

  it("returns null for a frame with no data lines (a bare event tag)", () => {
    expect(parseSSEFrame("event: error")).toBeNull();
    expect(parseSSEFrame(": comment only")).toBeNull();
  });
});

// ── watchSessionEvents ───────────────────────────────────────────────────────

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function sseResponse(frames: string[]): Response {
  return new Response(frames.map((frame) => `${frame}\n\n`).join(""), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const envelope = (body: unknown) => `data: ${JSON.stringify(body)}`;

describe("watchSessionEvents", () => {
  it("delivers replay frames, the live boundary, and tracks the cursor", async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse([
        envelope({
          event: { type: "user_prompt", user_prompt: { text: "hello" } },
          cursor: "c-1",
          phase: "replay",
        }),
        envelope({
          event: { type: "message.delta", text: "hi", run_id: "run-1" },
          cursor: "c-2",
          phase: "replay",
        }),
        // The silent lifecycle kind still advances the cursor (null event).
        envelope({
          event: { type: "turn.end" },
          cursor: "c-3",
          phase: "replay",
        }),
        envelope({ cursor: "c-3", phase: "live" }),
      ]),
    );
    const controller = new AbortController();
    const deliveries: WatchDelivery[] = [];
    await watchSessionEvents(
      "s-1",
      (delivery) => {
        deliveries.push(delivery);
        // The boundary is the natural detach point for this test.
        if (delivery.phase === "live" && !delivery.event) controller.abort();
      },
      { signal: controller.signal },
    );
    expect(deliveries).toEqual([
      {
        phase: "replay",
        cursor: "c-1",
        event: { type: "user_prompt", text: "hello" },
      },
      {
        phase: "replay",
        cursor: "c-2",
        event: { type: "token", text: "hi", runId: "run-1" },
      },
      { phase: "replay", cursor: "c-3", event: null },
      { phase: "live", cursor: "c-3", event: null },
    ]);
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(url).toBe("/api/mecatl/v1/sessions/s-1/watch");
  });

  it("reconnects from the last cursor on watch_lagging, bounded", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          envelope({
            event: { type: "message.delta", text: "a" },
            cursor: "c-7",
            phase: "replay",
          }),
          'event: error\ndata: {"code":"watch_lagging","error":"fell behind"}',
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          'event: error\ndata: {"code":"activity_gap","error":"append failed"}',
        ]),
      );
    globalThis.fetch = fetchMock;
    const deliveries: WatchDelivery[] = [];
    await expect(
      watchSessionEvents("s-2", (delivery) => deliveries.push(delivery), {
        runId: "run-9",
      }),
    ).rejects.toMatchObject({
      name: "WatchStreamError",
      code: "activity_gap",
    });
    expect(deliveries).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The reconnect resumes from the last processed cursor, same run filter.
    const retryUrl = fetchMock.mock.calls[1][0] as string;
    expect(retryUrl).toContain("cursor=c-7");
    expect(retryUrl).toContain("run_id=run-9");
  });

  it("throws a typed WatchStreamError on cursor_expired — the transcript-refetch signal", async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse([
        'event: error\ndata: {"code":"cursor_expired","error":"superseded"}',
      ]),
    );
    const fault = await watchSessionEvents("s-3", () => undefined).catch(
      (caught) => caught,
    );
    expect(fault).toBeInstanceOf(WatchStreamError);
    expect((fault as WatchStreamError).code).toBe("cursor_expired");
  });

  it("gives up after the reconnect budget when the stream keeps dropping", async () => {
    const fetchMock = vi.fn(async () => sseResponse([]));
    globalThis.fetch = fetchMock;
    await expect(
      watchSessionEvents("s-4", () => undefined, { maxReconnects: 2 }),
    ).rejects.toBeInstanceOf(WatchStreamError);
    // The first attempt plus two reconnects.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("surfaces a pre-stream refusal as the typed HarnessApiError", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: "no_event_log",
            error: "no durable event log configured",
          }),
          { status: 501 },
        ),
    );
    const fault = await watchSessionEvents("s-5", () => undefined).catch(
      (caught) => caught,
    );
    expect(fault).toBeInstanceOf(HarnessApiError);
    expect((fault as HarnessApiError).code).toBe("no_event_log");
  });
});
