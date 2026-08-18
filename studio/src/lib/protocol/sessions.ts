/**
 * Decoders for the daemon's stored-session inventory and transcripts.
 *
 * The daemon — not this client — decides which actions a row supports: a
 * subagent or team member is inspect-only, a running or awaiting chat cannot
 * be renamed or deleted, and a store without pruning cannot delete at all.
 * Each capability therefore travels with a closed machine-readable reason, so
 * the UI explains a disabled action instead of re-deriving server eligibility
 * rules and drifting from them.
 */

import {
  asRecord,
  booleanFlag,
  optionalNumber,
  optionalString,
} from "./internal";

export type SessionSummary = {
  sessionId: string;
  /** The server-held label: operator-authored, or seeded from the first prompt. */
  title: string;
  /** Persisted lifecycle state (idle/running/awaiting/completed/failed/cancelled). */
  state: string;
  workspace: string;
  modelId: string;
  turns: number;
  /** Last write, epoch millis. Zero when the row carried no timestamp. */
  modifiedAt: number;
  /** Creation time, epoch millis. Zero when the snapshot could not be read. */
  createdAt: number;
  /**
   * Whether the row is an operator-facing chat at all. `inspect_only_kind` is
   * the ONE reason that means "not a chat" (a subagent, team member, parallel
   * branch, or scheduled fire). Every other reason means "a chat, busy right
   * now", which still belongs in the list.
   */
  isChat: boolean;
  canRename: boolean;
  canDelete: boolean;
  canViewTranscript: boolean;
  renameReason: string;
  deleteReason: string;
};

export type SessionInventoryPage = {
  sessions: SessionSummary[];
  nextCursor: string;
};

// int64 fields cross encoding/json as numbers. A value that arrives as a string
// (a protojson-shaped proxy, a hand-written stub) must still not become NaN.
const unixSecondsToMillis = (value: unknown) => {
  const seconds =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;
  return Number.isFinite(seconds) ? Math.trunc(seconds) * 1000 : 0;
};

export function decodeSessionInventory(value: unknown): SessionInventoryPage {
  const body = asRecord(value);
  const rows = Array.isArray(body?.sessions) ? body.sessions : [];
  const sessions: SessionSummary[] = [];
  for (const rowValue of rows) {
    const row = asRecord(rowValue);
    const sessionId = optionalString(row?.session_id) ?? "";
    // A row with no id cannot be opened, renamed, or deleted. That is a corrupt
    // envelope rather than a session, so it is dropped instead of rendered as an
    // inert chat the operator can never act on.
    if (!sessionId) continue;
    const capabilities = asRecord(row?.capabilities) ?? {};
    const reasons = asRecord(capabilities.reasons) ?? {};
    sessions.push({
      sessionId,
      title: optionalString(row?.title) ?? "",
      state: optionalString(row?.state) ?? "",
      workspace: optionalString(row?.workspace) ?? "",
      modelId: optionalString(row?.model_id) ?? "",
      turns: optionalNumber(row?.turns) ?? 0,
      modifiedAt: unixSecondsToMillis(row?.modified_at_unix),
      createdAt: unixSecondsToMillis(row?.created_at_unix),
      isChat:
        (optionalString(reasons.public_chat) ?? "") !== "inspect_only_kind",
      canRename: booleanFlag(capabilities.rename),
      canDelete: booleanFlag(capabilities.delete),
      canViewTranscript: booleanFlag(capabilities.view_transcript),
      renameReason: optionalString(reasons.rename) ?? "",
      deleteReason: optionalString(reasons.delete) ?? "",
    });
  }
  return { sessions, nextCursor: optionalString(body?.next_cursor) ?? "" };
}

/** One conversation entry from `GET /v1/sessions/{id}/transcript`. */
export type TranscriptMessage = {
  role: string;
  text: string;
  toolCalls: Array<{ id: string; name: string; args: string }>;
  toolResult?: { callId: string; content: string; isError: boolean };
};

export type SessionTranscript = {
  sessionId: string;
  /**
   * The daemon's completeness attestation. A successful load is complete even
   * for a genuinely empty conversation, so `false` means the transcript could
   * NOT be proven whole — the UI says so rather than presenting a partial
   * history as the whole one.
   */
  complete: boolean;
  messages: TranscriptMessage[];
};

export function decodeSessionTranscript(value: unknown): SessionTranscript {
  const body = asRecord(value);
  const rows = Array.isArray(body?.messages) ? body.messages : [];
  const messages: TranscriptMessage[] = [];
  for (const messageValue of rows) {
    const message = asRecord(messageValue);
    if (!message) continue;
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    const result = asRecord(message.tool_result);
    messages.push({
      role: optionalString(message.role) ?? "",
      text: optionalString(message.text) ?? "",
      toolCalls: calls.flatMap((callValue) => {
        const call = asRecord(callValue);
        if (!call) return [];
        return [
          {
            id: optionalString(call.id) ?? "",
            name: optionalString(call.name) ?? "",
            args: optionalString(call.args) ?? "",
          },
        ];
      }),
      toolResult: result
        ? {
            callId: optionalString(result.call_id) ?? "",
            content: optionalString(result.content) ?? "",
            isError: booleanFlag(result.is_error),
          }
        : undefined,
    });
  }
  return {
    sessionId: optionalString(body?.session_id) ?? "",
    complete: booleanFlag(body?.complete),
    messages,
  };
}
