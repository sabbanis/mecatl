import { describe, expect, it } from "vitest";
import type { AgentMessage } from "../types";
import {
  applyDelegationUpdate,
  attachmentsFromSteerParts,
  splitPendingSteersOnWatermark,
} from "./use-agent-chat";

const pending = [
  { id: "steer-1", text: "first" },
  { id: "steer-2", text: "second" },
  { id: "steer-3", text: "third" },
];

describe("splitPendingSteersOnWatermark", () => {
  it("drops every pending steer up to and including the watermark, keeping the tail", () => {
    expect(splitPendingSteersOnWatermark(pending, "steer-2")).toEqual([
      { id: "steer-3", text: "third" },
    ]);
  });

  it("clears the whole list when the watermark is the last pending steer", () => {
    expect(splitPendingSteersOnWatermark(pending, "steer-3")).toEqual([]);
  });

  it("clears the whole list on an empty watermark — the daemon's FIFO is authoritative", () => {
    expect(splitPendingSteersOnWatermark(pending, "")).toEqual([]);
  });

  it("clears the whole list on an unmatched watermark rather than text-matching", () => {
    expect(splitPendingSteersOnWatermark(pending, "steer-unknown")).toEqual([]);
  });

  it("leaves an empty list empty", () => {
    expect(splitPendingSteersOnWatermark([], "steer-1")).toEqual([]);
  });
});

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

// ── steer echo attachments (ADR 0251 / C2.2) ─────────────────────────────────

describe("attachmentsFromSteerParts", () => {
  it("renders inline bytes as data: URLs and passes url parts through", () => {
    expect(
      attachmentsFromSteerParts([
        { kind: "image", mimeType: "image/png", data: "aGk=" },
        { kind: "audio", mimeType: "audio/wav", url: "mecatl://a" },
      ]),
    ).toEqual([
      {
        name: "image-1.png",
        type: "image/png",
        url: "data:image/png;base64,aGk=",
      },
      { name: "audio-2.wav", type: "audio/wav", url: "mecatl://a" },
    ]);
  });

  it("returns undefined for an empty bundle", () => {
    expect(attachmentsFromSteerParts(undefined)).toBeUndefined();
    expect(attachmentsFromSteerParts([])).toBeUndefined();
  });
});
