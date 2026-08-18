import { describe, expect, it } from "vitest";
import { parseMecatlEvent, translateEvent } from "./events";

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
