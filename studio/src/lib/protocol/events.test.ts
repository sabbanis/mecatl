import { describe, expect, it } from "vitest";
import { parseMecatlEvent, parseWatchEnvelope, translateEvent } from "./events";

const translate = (payload: unknown) =>
  translateEvent(parseMecatlEvent(JSON.stringify(payload)), "session-1");

describe("parseMecatlEvent", () => {
  it("throws on a frame with no type", () => {
    expect(() => parseMecatlEvent(JSON.stringify({ text: "hi" }))).toThrow(
      "event.type is required",
    );
  });

  it("preserves a terminal failure: stop, error text, and permanence", () => {
    const event = parseMecatlEvent(
      JSON.stringify({
        type: "result",
        result: {
          stop: "error",
          error: "provider rejected the request",
          permanent: true,
        },
      }),
    );
    expect(event.result?.stop).toBe("error");
    expect(event.result?.error).toBe("provider rejected the request");
    expect(event.result?.permanent).toBe(true);
  });
});

describe("parseWatchEnvelope", () => {
  it("decodes an event-bearing envelope: inner event, cursor, phase", () => {
    const envelope = parseWatchEnvelope(
      JSON.stringify({
        event: { type: "message.delta", text: "hi", run_id: "run-1" },
        cursor: "c-42",
        phase: "replay",
      }),
    );
    expect(envelope.cursor).toBe("c-42");
    expect(envelope.phase).toBe("replay");
    expect(envelope.event?.type).toBe("message.delta");
    expect(envelope.event?.run_id).toBe("run-1");
  });

  it("decodes the event-less boundary frame with a null event", () => {
    expect(
      parseWatchEnvelope(JSON.stringify({ cursor: "c-9", phase: "live" })),
    ).toEqual({ event: null, cursor: "c-9", phase: "live" });
  });
});

describe("translateEvent", () => {
  it("maps deltas to tokens and reasoning", () => {
    expect(translate({ type: "message.delta", text: "abc" })).toEqual([
      { type: "token", text: "abc" },
    ]);
    expect(translate({ type: "reasoning.delta", text: "hm" })).toEqual([
      { type: "reasoning", text: "hm" },
    ]);
  });

  it("renders a failed result as a run_result with the failure, never a success", () => {
    const events = translate({
      type: "result",
      result: { stop: "error", error: "boom", permanent: false },
    });
    expect(events).toEqual([
      {
        type: "run_result",
        stop: "error",
        text: "",
        errorText: "boom",
        permanent: false,
      },
    ]);
  });

  it("emits all five usage token fields from the terminal frame", () => {
    const events = translate({
      type: "result",
      result: {
        stop: "end_turn",
        text: "done",
        usage: {
          input_tokens: "100",
          output_tokens: 50,
          cache_read_tokens: 30,
          cache_write_tokens: 10,
          reasoning_tokens: 5,
        },
      },
    });
    expect(events[0]).toEqual({
      type: "usage",
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 30,
      cacheWriteTokens: 10,
      reasoningTokens: 5,
      estimatedCost: null,
    });
    expect(events[1]).toMatchObject({ type: "run_result", stop: "end_turn" });
  });

  it("surfaces a permission ask and its retraction", () => {
    expect(
      translate({
        type: "permission.ask",
        ask: { ask_id: "a1", tool: "bash", reason: "runs a command" },
      }),
    ).toEqual([
      {
        type: "approval",
        approvalId: "a1",
        sessionId: "session-1",
        toolName: "bash",
        description: "bash needs your approval.",
        details: "runs a command",
      },
    ]);
    expect(
      translate({ type: "permission.retract", ask: { ask_id: "a1" } }),
    ).toEqual([{ type: "retract", approvalId: "a1" }]);
  });

  it("renders delegation badges for subagent, team roster, and parallel branch starts", () => {
    expect(
      translate({
        type: "subagent.start",
        subagent: {
          goal: "explore the repo",
          routed_category: "explore",
          routed_model: "small-1",
        },
      }),
    ).toEqual([
      {
        type: "delegation",
        kind: "subagent",
        label: "explore the repo",
        detail: "explore → small-1",
      },
    ]);
    expect(
      translate({
        type: "team.start",
        team: {
          roster: [
            { name: "reviewer", role: "lead", model: "big-1" },
            { name: "tester" },
          ],
        },
      }),
    ).toEqual([
      {
        type: "delegation",
        kind: "team",
        label: "reviewer (lead)",
        detail: "big-1",
      },
      { type: "delegation", kind: "team", label: "tester", detail: "" },
    ]);
    expect(
      translate({
        type: "parallel.branch",
        parallel: { kind: "branch_start", branch_index: 1 },
      }),
    ).toEqual([
      { type: "delegation", kind: "parallel", label: "branch 2", detail: "" },
    ]);
    // Only a branch START is a badge; other branch lifecycle frames are silent.
    expect(
      translate({ type: "parallel.branch", parallel: { kind: "branch_end" } }),
    ).toEqual([]);
  });

  it("translates a steer drain echo to the steer arm with its watermark id", () => {
    expect(
      translate({
        type: "steer",
        steer: { text: "focus on the failing test", message_id: "steer-7-2" },
      }),
    ).toEqual([
      {
        type: "steer",
        text: "focus on the failing test",
        messageId: "steer-7-2",
      },
    ]);
    // A malformed echo still surfaces (empty fields), never a silent drop.
    expect(translate({ type: "steer" })).toEqual([
      { type: "steer", text: "", messageId: "" },
    ]);
  });

  it("surfaces an unknown event kind as a notice, never a silent drop", () => {
    expect(translate({ type: "something.new" })).toEqual([
      {
        type: "notice",
        text: "Mecatl sent an event this Studio version does not render yet: something.new",
      },
    ]);
  });

  it("passes advisory text through as a notice and keeps lifecycle markers silent", () => {
    expect(
      translate({ type: "recover_notice", text: "resumed after a retry" }),
    ).toEqual([{ type: "notice", text: "resumed after a retry" }]);
    expect(translate({ type: "turn.start" })).toEqual([]);
    expect(translate({ type: "session.init" })).toEqual([]);
    // Routing is an implementation detail, not something shown per turn.
    expect(
      translate({ type: "provider.route", text: "routed to small-1" }),
    ).toEqual([]);
  });

  it("renders a durable-log user_prompt as a user message event", () => {
    expect(
      translate({ type: "user_prompt", user_prompt: { text: "fix the bug" } }),
    ).toEqual([{ type: "user_prompt", text: "fix the bug" }]);
    // A media-only prompt (no text) stays quiet rather than an empty bubble.
    expect(translate({ type: "user_prompt", user_prompt: {} })).toEqual([]);
  });

  it("renders a durable-log approval as a verdict event — tool name and verdict, never args", () => {
    expect(
      translate({
        type: "approval",
        approval: { ask_id: "a1", tool: "Bash", verdict: "allow_once" },
      }),
    ).toEqual([
      {
        type: "approval_verdict",
        approvalId: "a1",
        toolName: "Bash",
        verdict: "allow_once",
      },
    ]);
  });

  it("keeps the compaction archive silent — audit history, not transcript", () => {
    expect(translate({ type: "compaction.archive" })).toEqual([]);
  });

  it("stamps run_id onto every translated event (ADR 0249)", () => {
    expect(
      translate({ type: "message.delta", text: "x", run_id: "run-7" }),
    ).toEqual([{ type: "token", text: "x", runId: "run-7" }]);
    const results = translate({
      type: "result",
      run_id: "run-7",
      result: { stop: "end_turn", text: "done" },
    });
    expect(results.every((event) => event.runId === "run-7")).toBe(true);
    // Empty is meaningful — a session-scoped event stays unstamped.
    expect(translate({ type: "message.delta", text: "x" })).toEqual([
      { type: "token", text: "x" },
    ]);
  });

  it("decodes the typed retry disposition and stream progress off a failed terminal (ADR 0239)", () => {
    // Numeric enums: stdlib encoding/json (mecated's HTTP surface).
    const [failed] = translate({
      type: "result",
      result: {
        stop: "error",
        error: "stream died",
        retry_disposition: 2,
        stream_progress: 2,
      },
    });
    expect(failed).toMatchObject({
      type: "run_result",
      stop: "error",
      retryDisposition: "retryable",
      streamProgress: "precommit",
    });
    // 3 = permanent, 4 = complete.
    const [permanent] = translate({
      type: "result",
      result: {
        stop: "error",
        error: "bad request",
        permanent: true,
        retry_disposition: 3,
        stream_progress: 4,
      },
    });
    expect(permanent).toMatchObject({
      retryDisposition: "permanent",
      streamProgress: "complete",
      permanent: true,
    });
    // SCREAMING_CASE names (a protojson relay) normalise the same way.
    const [named] = translate({
      type: "result",
      result: {
        stop: "error",
        retry_disposition: "RETRY_DISPOSITION_RETRYABLE",
        stream_progress: "STREAM_PROGRESS_VISIBLE",
      },
    });
    expect(named).toMatchObject({
      retryDisposition: "retryable",
      streamProgress: "visible",
    });
  });

  it("keeps the retry fields ABSENT against an old daemon, and degrades unrecognized values to unknown", () => {
    // Presence-aware: an old server sends neither field.
    const [legacy] = translate({
      type: "result",
      result: { stop: "error", error: "boom" },
    });
    expect(legacy).toMatchObject({ type: "run_result" });
    expect(
      (legacy as { retryDisposition?: string }).retryDisposition,
    ).toBeUndefined();
    expect(
      (legacy as { streamProgress?: string }).streamProgress,
    ).toBeUndefined();
    // A present-but-unrecognized value must never read as retryable.
    const [odd] = translate({
      type: "result",
      result: { stop: "error", retry_disposition: 99, stream_progress: 99 },
    });
    expect(odd).toMatchObject({
      retryDisposition: "unknown",
      streamProgress: "unknown",
    });
  });

  it("renders model.retry as the quiet retrying line (B2.1)", () => {
    expect(
      translate({
        type: "model.retry",
        model_retry: { retry_disposition: 2, stream_progress: 2 },
      }),
    ).toEqual([{ type: "notice", text: "Retrying the failed step…" }]);
  });

  it("decodes the steer echo's committed media parts (ADR 0251)", () => {
    const [echo] = translate({
      type: "steer",
      steer: {
        text: "look at this",
        message_id: "steer-3",
        parts: [
          { kind: 1, mime_type: "image/png", data: "aGk=" },
          { kind: "KIND_AUDIO", mime_type: "audio/wav", url: "mecatl://a" },
          { kind: 0, mime_type: "application/x-unknown", data: "ignored" },
        ],
      },
    });
    expect(echo).toEqual({
      type: "steer",
      text: "look at this",
      messageId: "steer-3",
      parts: [
        { kind: "image", mimeType: "image/png", data: "aGk=", url: undefined },
        {
          kind: "audio",
          mimeType: "audio/wav",
          data: undefined,
          url: "mecatl://a",
        },
      ],
    });
    // A part-less echo stays part-less (no empty array invented).
    const [plain] = translate({
      type: "steer",
      steer: { text: "just text", message_id: "steer-4" },
    });
    expect((plain as { parts?: unknown }).parts).toBeUndefined();
  });

  it("translates subagent.tool into live delegation progress (D1)", () => {
    expect(
      translate({
        type: "subagent.tool",
        subagent: {
          parent_call_id: "call-1",
          child_id: "subagent-abc",
          tool_name: "Read",
          tool_count: 4,
          usage: { input_tokens: "1200", output_tokens: 300 },
        },
      }),
    ).toEqual([
      {
        type: "delegation_progress",
        childId: "subagent-abc",
        toolCount: 4,
        inputTokens: 1200,
        outputTokens: 300,
        toolName: "Read",
      },
    ]);
    // A frame with no child id has nothing to key on and stays quiet.
    expect(translate({ type: "subagent.tool", subagent: {} })).toEqual([]);
  });

  it("translates subagent.end into the terminal card update — a failed child carries its cause (D1)", () => {
    expect(
      translate({
        type: "subagent.end",
        subagent: {
          child_id: "subagent-abc",
          stop: "error",
          tool_count: 7,
          duration_ms: 4200,
          cause: "provider rejected the request",
          usage: { input_tokens: 9000, output_tokens: 1500 },
        },
      }),
    ).toEqual([
      {
        type: "delegation_end",
        childId: "subagent-abc",
        stop: "error",
        toolCount: 7,
        inputTokens: 9000,
        outputTokens: 1500,
        durationMs: 4200,
        cause: "provider rejected the request",
      },
    ]);
  });

  it("carries child_id, background, and routing_reason on the subagent start badge (D1/D2.1)", () => {
    const [start] = translate({
      type: "subagent.start",
      subagent: {
        child_id: "subagent-abc",
        goal: "explore the repo",
        background: true,
        routing_reason: "pinned-model",
      },
    });
    expect(start).toMatchObject({
      type: "delegation",
      kind: "subagent",
      label: "explore the repo",
      childId: "subagent-abc",
      background: true,
      routingReason: "pinned-model",
    });
  });

  it("pretty-prints tool args on the call card", () => {
    expect(
      translate({
        type: "tool.call",
        tool_call: {
          call_id: "c1",
          tool: "bash",
          args: JSON.stringify({ command: "ls", timeout: 5 }),
        },
      }),
    ).toEqual([
      {
        type: "tool_call",
        callId: "c1",
        name: "bash",
        input: "command: ls · timeout: 5",
      },
    ]);
  });
});
