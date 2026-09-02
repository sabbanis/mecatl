import { describe, expect, it } from "vitest";
import {
  decodeSessionInventory,
  decodeSessionPermissionMode,
  decodeSessionTranscript,
  encodeSessionPermissionMode,
} from "./sessions";

describe("decodeSessionInventory", () => {
  it("takes action eligibility from the row's capabilities, never re-deriving it", () => {
    const page = decodeSessionInventory({
      sessions: [
        {
          session_id: "s1",
          title: "Fix the flaky test",
          state: "idle",
          capabilities: {
            rename: true,
            delete: true,
            view_transcript: true,
            reasons: {},
          },
        },
      ],
    });
    expect(page.sessions[0]).toMatchObject({
      sessionId: "s1",
      canRename: true,
      canDelete: true,
      canViewTranscript: true,
      isChat: true,
    });
  });

  it("treats an omitted capability as a denial", () => {
    const page = decodeSessionInventory({
      sessions: [{ session_id: "s1", capabilities: {} }],
    });
    expect(page.sessions[0]).toMatchObject({
      canRename: false,
      canDelete: false,
      canViewTranscript: false,
    });
  });

  it("filters chats on inspect_only_kind and ONLY that reason", () => {
    const page = decodeSessionInventory({
      sessions: [
        {
          session_id: "subagent-1",
          capabilities: { reasons: { public_chat: "inspect_only_kind" } },
        },
        {
          session_id: "s2",
          capabilities: { reasons: { public_chat: "busy_running" } },
        },
      ],
    });
    expect(page.sessions[0].isChat).toBe(false);
    expect(page.sessions[1].isChat).toBe(true);
  });

  it("drops a row with no session id instead of rendering an inert chat", () => {
    const page = decodeSessionInventory({
      sessions: [{ title: "corrupt" }, { session_id: "s1" }],
    });
    expect(page.sessions).toHaveLength(1);
    expect(page.sessions[0].sessionId).toBe("s1");
  });

  it("carries the cursor and converts unix seconds, tolerating string int64", () => {
    const page = decodeSessionInventory({
      sessions: [
        { session_id: "s1", modified_at_unix: 1700000000 },
        { session_id: "s2", modified_at_unix: "1700000001" },
      ],
      next_cursor: "abc",
    });
    expect(page.nextCursor).toBe("abc");
    expect(page.sessions[0].modifiedAt).toBe(1700000000000);
    expect(page.sessions[1].modifiedAt).toBe(1700000001000);
  });

  it("carries per-action denial reasons for the UI to explain with", () => {
    const page = decodeSessionInventory({
      sessions: [
        {
          session_id: "s1",
          capabilities: {
            reasons: { rename: "busy_running", delete: "no_pruning" },
          },
        },
      ],
    });
    expect(page.sessions[0].renameReason).toBe("busy_running");
    expect(page.sessions[0].deleteReason).toBe("no_pruning");
  });

  it("decodes title_provenance verbatim, defaulting an absent field to unknown (F4)", () => {
    const page = decodeSessionInventory({
      sessions: [
        { session_id: "s1", title: "Hand-set", title_provenance: "operator" },
        { session_id: "s2", title: "Seeded", title_provenance: "first-prompt" },
        { session_id: "s3", title: "Legacy row" },
      ],
    });
    expect(page.sessions.map((s) => s.titleProvenance)).toEqual([
      "operator",
      "first-prompt",
      "",
    ]);
  });

  it("decodes the debug relationship and treats a debug row as a chat despite inspect_only_kind (ADR 0254)", () => {
    const page = decodeSessionInventory({
      sessions: [
        {
          // The live daemon stamps debug rows inspect_only_kind (the KIND is
          // not main) yet drives them as ordinary chats; the relationship is
          // the honest chat signal. Rename/delete stay denied per the row.
          session_id: "dbg-1",
          kind: "debug",
          relationship: { debug_target_session_id: "target-9" },
          capabilities: {
            view_transcript: true,
            reasons: {
              public_chat: "inspect_only_kind",
              rename: "inspect_only_kind",
              delete: "inspect_only_kind",
            },
          },
        },
        {
          // A relationship WITHOUT the debug binding (a scheduled fire) stays
          // inspect-only — the exception is the debug field, not any
          // relationship.
          session_id: "sched-1",
          kind: "scheduled",
          relationship: { schedule_name: "nightly" },
          capabilities: {
            reasons: { public_chat: "inspect_only_kind" },
          },
        },
      ],
    });
    const debug = page.sessions[0];
    expect(debug.debugTargetSessionId).toBe("target-9");
    expect(debug.isChat).toBe(true);
    expect(debug.canRename).toBe(false);
    expect(debug.canDelete).toBe(false);
    const scheduled = page.sessions[1];
    expect(scheduled.debugTargetSessionId).toBe("");
    expect(scheduled.isChat).toBe(false);
  });
});

describe("decodeSessionTranscript", () => {
  it("decodes messages with tool calls and results, and the completeness attestation", () => {
    const transcript = decodeSessionTranscript({
      session_id: "s1",
      complete: true,
      messages: [
        { role: "user", text: "hello" },
        {
          role: "assistant",
          text: "",
          tool_calls: [{ id: "c1", name: "bash", args: "{}" }],
        },
        {
          role: "tool",
          tool_result: { call_id: "c1", content: "ok", is_error: false },
        },
        { role: "assistant", text: "done" },
      ],
    });
    expect(transcript.sessionId).toBe("s1");
    expect(transcript.complete).toBe(true);
    expect(transcript.messages).toHaveLength(4);
    expect(transcript.messages[1].toolCalls).toEqual([
      { id: "c1", name: "bash", args: "{}" },
    ]);
    expect(transcript.messages[2].toolResult).toEqual({
      callId: "c1",
      content: "ok",
      isError: false,
    });
  });

  it("reports an unproven transcript as incomplete rather than whole", () => {
    const transcript = decodeSessionTranscript({
      session_id: "s1",
      messages: [],
    });
    expect(transcript.complete).toBe(false);
  });
});

describe("session permission mode mapping", () => {
  it("decodes the daemon's echo spellings, mirroring the Go modeFromString", () => {
    // The snapshot echoes session.PermissionMode verbatim: "acceptEdits".
    expect(decodeSessionPermissionMode("acceptEdits")).toBe("acceptEdits");
    expect(decodeSessionPermissionMode("plan")).toBe("plan");
    expect(decodeSessionPermissionMode("default")).toBe("default");
    // The daemon's own parser tolerates these; the decoder matches it.
    expect(decodeSessionPermissionMode("accept_edits")).toBe("acceptEdits");
    expect(decodeSessionPermissionMode("accept-edits")).toBe("acceptEdits");
    expect(decodeSessionPermissionMode("accept")).toBe("acceptEdits");
    expect(decodeSessionPermissionMode("PLAN")).toBe("plan");
  });

  it("falls through to default for unknown, empty, or non-string values", () => {
    expect(decodeSessionPermissionMode("")).toBe("default");
    expect(decodeSessionPermissionMode("yolo")).toBe("default");
    expect(decodeSessionPermissionMode(undefined)).toBe("default");
    expect(decodeSessionPermissionMode(3)).toBe("default");
  });

  it("encodes requests as protojson snake_case, never the camelCase echo", () => {
    expect(encodeSessionPermissionMode("default")).toBe("default");
    expect(encodeSessionPermissionMode("plan")).toBe("plan");
    expect(encodeSessionPermissionMode("acceptEdits")).toBe("accept_edits");
  });

  it("round-trips every mode through encode → decode", () => {
    for (const mode of ["default", "plan", "acceptEdits"] as const) {
      expect(
        decodeSessionPermissionMode(encodeSessionPermissionMode(mode)),
      ).toBe(mode);
    }
  });
});
