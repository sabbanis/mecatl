import { describe, expect, it } from "vitest";
import type { AgentMessage } from "../types";
import { applyDelegationUpdate } from "./use-agent-chat";

// ── delegation cards (D1) ────────────────────────────────────────────────────

describe("applyDelegationUpdate", () => {
  const base = (): AgentMessage[] => [
    { id: "u1", role: "user", content: "go", timestamp: 0 },
    {
      id: "a1",
      role: "assistant",
      content: "",
      timestamp: 0,
      delegations: [
        {
          kind: "subagent",
          label: "explore the repo",
          detail: "",
          childId: "subagent-abc",
        },
      ],
    },
  ];

  it("ticks the running counters on delegation_progress, keyed by childId", () => {
    let messages = applyDelegationUpdate(base(), {
      type: "delegation_progress",
      childId: "subagent-abc",
      toolCount: 3,
      inputTokens: 1200,
      outputTokens: 80,
      toolName: "Read",
    });
    messages = applyDelegationUpdate(messages, {
      type: "delegation_progress",
      childId: "subagent-abc",
      toolCount: 4,
      toolName: "Grep",
    });
    expect(messages[1].delegations?.[0]).toMatchObject({
      childId: "subagent-abc",
      toolCount: 4,
      inputTokens: 1200,
      outputTokens: 80,
      lastTool: "Grep",
    });
    // The card is still running: no stop yet.
    expect(messages[1].delegations?.[0].stop).toBeUndefined();
  });

  it("stamps stop, duration, and the failure cause on delegation_end — a failed child never vanishes", () => {
    const messages = applyDelegationUpdate(base(), {
      type: "delegation_end",
      childId: "subagent-abc",
      stop: "error",
      toolCount: 7,
      durationMs: 4200,
      cause: "provider rejected the request",
    });
    expect(messages[1].delegations?.[0]).toMatchObject({
      stop: "error",
      toolCount: 7,
      durationMs: 4200,
      cause: "provider rejected the request",
    });
  });

  it("returns the SAME array when no card carries the child (progress without a start)", () => {
    const before = base();
    expect(
      applyDelegationUpdate(before, {
        type: "delegation_progress",
        childId: "subagent-unknown",
        toolCount: 1,
      }),
    ).toBe(before);
  });
});
