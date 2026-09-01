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
  /**
   * Where `title` came from: "operator" (hand-set — an auto-rename must never
   * clobber it), "first-prompt" (seeded, safe to replace), or "" (legacy row /
   * older daemon — treat as unknown and do not auto-rename).
   */
  titleProvenance: string;
  /**
   * Non-empty on an AI-debug session (ADR 0254): the id of the stored session
   * this row was created to diagnose. The one relationship field a chat row
   * can carry — every other related kind is inspect-only.
   */
  debugTargetSessionId: string;
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
   * branch, or scheduled fire) — EXCEPT for a debug session, whose kind is
   * stamped inspect-only but which the daemon drives as an ordinary chat (see
   * the decode). Every other reason means "a chat, busy right now", which
   * still belongs in the list.
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

/**
 * The closed session permission-mode vocabulary, spelled the way the daemon's
 * session aggregate spells it (session.PermissionMode: "default" / "plan" /
 * "acceptEdits"). This is what the session snapshot's `mode` field echoes.
 */
export type SessionPermissionMode = "default" | "plan" | "acceptEdits";

/**
 * Decodes a session snapshot's `mode` echo into the closed vocabulary.
 * Tolerant the same way the daemon's own modeFromString is (case-insensitive,
 * "accept"/"accept-edits"/"accept_edits"/"acceptEdits" all mean accept-edits);
 * unknown or empty values fall through to "default" — the daemon applies the
 * default mode to a session created without one.
 */
export function decodeSessionPermissionMode(
  value: unknown,
): SessionPermissionMode {
  if (typeof value !== "string") return "default";
  switch (value.toLowerCase()) {
    case "plan":
      return "plan";
    case "accept":
    case "acceptedits":
    case "accept-edits":
    case "accept_edits":
      return "acceptEdits";
    default:
      return "default";
  }
}

/**
 * The wire spelling for requests that carry a mode (session creation and
 * POST /v1/sessions/{id}/mode) — protojson snake_case, per the
 * requests-are-protojson rule. Never echo the decoded camelCase back.
 */
export function encodeSessionPermissionMode(
  mode: SessionPermissionMode,
): "default" | "plan" | "accept_edits" {
  return mode === "acceptEdits" ? "accept_edits" : mode;
}

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
    const relationship = asRecord(row?.relationship) ?? {};
    const debugTargetSessionId =
      optionalString(relationship.debug_target_session_id) ?? "";
    sessions.push({
      sessionId,
      title: optionalString(row?.title) ?? "",
      titleProvenance: optionalString(row?.title_provenance) ?? "",
      debugTargetSessionId,
      state: optionalString(row?.state) ?? "",
      workspace: optionalString(row?.workspace) ?? "",
      modelId: optionalString(row?.model_id) ?? "",
      turns: optionalNumber(row?.turns) ?? 0,
      modifiedAt: unixSecondsToMillis(row?.modified_at_unix),
      createdAt: unixSecondsToMillis(row?.created_at_unix),
      // A debug session (ADR 0254) is the one non-main kind that IS a chat:
      // the daemon's run entry drives it like any main session, but its
      // inventory row is stamped `inspect_only_kind` because the KIND is not
      // main. The relationship is the honest chat signal there; its per-action
      // capabilities (rename/delete denied) still bind below.
      isChat:
        (optionalString(reasons.public_chat) ?? "") !== "inspect_only_kind" ||
        debugTargetSessionId !== "",
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
type TranscriptMessage = {
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
