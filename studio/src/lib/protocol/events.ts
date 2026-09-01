/**
 * The daemon event seam: structural decode of one SSE `session.Event` frame
 * (`parseMecatlEvent`) and its translation into the UI's StreamEvent union
 * (`translateEvent`). This module is the ONLY place that reads raw daemon
 * event JSON.
 *
 * There are deliberately no generated proto bindings yet (ADR: the typed
 * runtime seam plus behavior tests is the stopgap); decoding is structural
 * and throw-on-missing-type so a malformed frame fails loudly in tests.
 */

import type {
  RetryDisposition,
  SteerEchoPart,
  StreamEvent,
  StreamProgress,
} from "@/features/agent/types";
import { fileFromToolCall } from "@/lib/file-meta";
import {
  asRecord,
  enumNumber,
  optionalNumber,
  optionalString,
  stringFields,
  type UnknownRecord,
} from "./internal";

type MecatlUsage = {
  input_tokens?: string | number;
  output_tokens?: string | number;
  cache_read_tokens?: string | number;
  cache_write_tokens?: string | number;
  reasoning_tokens?: string | number;
};

/** A wire enum: a NUMBER under stdlib encoding/json (mecated's HTTP surface),
 *  a SCREAMING_CASE name under protojson (a relay). */
type WireEnum = string | number;

/** One raw Content part off the steer drain echo (proto Content). */
type MecatlContentPart = {
  kind?: WireEnum;
  mime_type?: string;
  /** Standard base64 under stdlib encoding/json ([]byte). */
  data?: string;
  url?: string;
};

export type MecatlEvent = {
  type: string;
  seq?: string | number;
  /** Opaque id of the run that emitted this event (ADR 0249); "" on
   *  session-scoped events (e.g. the schedule lifecycle). */
  run_id?: string;
  text?: string;
  tool_call?: {
    id?: string;
    name?: string;
    args?: string;
    tool?: string;
    call_id?: string;
  };
  tool_result?: {
    call_id?: string;
    content?: string;
    result?: string;
    is_error?: boolean;
    tool?: string;
  };
  ask?: { ask_id?: string; tool?: string; args?: string; reason?: string };
  /** Drain echo for mid-run steering: `text` is the drained bundle,
   *  `message_id` the client-minted id of the LAST message merged into it
   *  (the watermark the client splits its pending list on), and `parts` the
   *  committed media bundle (ADR 0251). */
  steer?: { text?: string; message_id?: string; parts?: MecatlContentPart[] };
  /** The typed failed-terminal being retried (EvModelRetry, ADR 0239). */
  model_retry?: {
    retry_disposition?: WireEnum;
    stream_progress?: WireEnum;
  };
  result?: {
    text?: string;
    stop?: string;
    error?: string;
    permanent?: boolean;
    usage?: MecatlUsage;
    /** Presence-aware (proto3 optional): absent on an older daemon. */
    retry_disposition?: WireEnum;
    stream_progress?: WireEnum;
  };
  subagent?: {
    parent_call_id?: string;
    child_id?: string;
    goal?: string;
    routed_category?: string;
    routed_model?: string;
    model?: string;
    routing_reason?: string;
    tool_name?: string;
    stop?: string;
    cause?: string;
    background?: boolean;
    tool_count?: number;
    duration_ms?: number;
    usage?: MecatlUsage;
  };
  team?: {
    parent_call_id?: string;
    roster?: Array<{
      name?: string;
      role?: string;
      routed_category?: string;
      routed_model?: string;
      model?: string;
    }>;
  };
  parallel?: {
    parent_call_id?: string;
    kind?: string;
    branch_index?: number;
    branch_label?: string;
    goal?: string;
    routed_category?: string;
    routed_model?: string;
    model?: string;
  };
  /** Log-only (EvApproval): the verdict half of a permission ask. Metadata
   *  only by construction — tool NAME + verdict string, never args. */
  approval?: { ask_id?: string; verdict?: string; tool?: string };
  /** Log-only (EvUserPrompt): the recorded user message. */
  user_prompt?: { text?: string };
};

export function parseMecatlEvent(data: string): MecatlEvent {
  const raw = asRecord(JSON.parse(data));
  return parseMecatlEventValue(raw);
}

/** Structural decode of an already-parsed event object (the watch envelope
 *  carries the event nested, so it arrives pre-parsed). */
function parseMecatlEventValue(raw: UnknownRecord | undefined): MecatlEvent {
  if (!raw || typeof raw.type !== "string" || !raw.type)
    throw new Error("event.type is required");
  const event: MecatlEvent = {
    type: raw.type,
    seq:
      typeof raw.seq === "string" || typeof raw.seq === "number"
        ? raw.seq
        : undefined,
    run_id: optionalString(raw.run_id),
    text: optionalString(raw.text),
  };
  event.tool_call = stringFields(raw.tool_call, [
    "id",
    "name",
    "args",
    "tool",
    "call_id",
  ]);
  const toolResult = asRecord(raw.tool_result);
  if (toolResult)
    event.tool_result = {
      ...stringFields(toolResult, ["call_id", "content", "result", "tool"]),
      is_error:
        typeof toolResult.is_error === "boolean"
          ? toolResult.is_error
          : undefined,
    };
  event.ask = stringFields(raw.ask, ["ask_id", "tool", "args", "reason"]);
  const steer = asRecord(raw.steer);
  if (steer)
    event.steer = {
      ...stringFields(steer, ["text", "message_id"]),
      parts: Array.isArray(steer.parts)
        ? steer.parts.flatMap((part): MecatlContentPart[] => {
            const record = asRecord(part);
            if (!record) return [];
            return [
              {
                kind: wireEnum(record.kind),
                mime_type: optionalString(record.mime_type),
                data: optionalString(record.data),
                url: optionalString(record.url),
              },
            ];
          })
        : undefined,
    };
  const modelRetry = asRecord(raw.model_retry);
  if (modelRetry)
    event.model_retry = {
      retry_disposition: wireEnum(modelRetry.retry_disposition),
      stream_progress: wireEnum(modelRetry.stream_progress),
    };
  const result = asRecord(raw.result);
  if (result)
    event.result = {
      ...stringFields(result, ["text", "stop", "error"]),
      permanent:
        typeof result.permanent === "boolean" ? result.permanent : undefined,
      usage: asRecord(result.usage) as MecatlUsage | undefined,
      retry_disposition: wireEnum(result.retry_disposition),
      stream_progress: wireEnum(result.stream_progress),
    };
  const subagent = asRecord(raw.subagent);
  if (subagent)
    event.subagent = {
      ...stringFields(subagent, [
        "parent_call_id",
        "child_id",
        "goal",
        "routed_category",
        "routed_model",
        "model",
        "routing_reason",
        "tool_name",
        "stop",
        "cause",
      ]),
      background: subagent.background === true ? true : undefined,
      tool_count: numericField(subagent.tool_count),
      duration_ms: numericField(subagent.duration_ms),
      usage: asRecord(subagent.usage) as MecatlUsage | undefined,
    };
  const team = asRecord(raw.team);
  if (team)
    event.team = {
      parent_call_id: optionalString(team.parent_call_id),
      roster: Array.isArray(team.roster)
        ? team.roster.map(
            (member) =>
              stringFields(member, [
                "name",
                "role",
                "routed_category",
                "routed_model",
                "model",
              ]) ?? {},
          )
        : undefined,
    };
  const parallel = asRecord(raw.parallel);
  if (parallel)
    event.parallel = {
      ...stringFields(parallel, [
        "parent_call_id",
        "kind",
        "branch_label",
        "goal",
        "routed_category",
        "routed_model",
        "model",
      ]),
      branch_index: optionalNumber(parallel.branch_index),
    };
  event.approval = stringFields(raw.approval, ["ask_id", "verdict", "tool"]);
  event.user_prompt = stringFields(raw.user_prompt, ["text"]);
  return event;
}

/**
 * One delivery envelope from the durable session watch
 * (GET /v1/sessions/{id}/watch, ADR 0250): what happened, where the client
 * now is (the opaque resume cursor), and which phase it arrived in.
 */
export interface MecatlWatchEnvelope {
  /** Null on a phase-only frame: the single replay→live boundary marker and
   *  every gap frame. */
  event: MecatlEvent | null;
  /** Opaque resume token positioned AFTER this envelope; hand it back
   *  verbatim to continue from exactly the next record. */
  cursor: string;
  /** Open string: "replay" | "live" | "gap" — tolerate unknown values. */
  phase: string;
}

export function parseWatchEnvelope(data: string): MecatlWatchEnvelope {
  const raw = asRecord(JSON.parse(data));
  if (!raw) throw new Error("watch envelope must be an object");
  const inner = asRecord(raw.event);
  return {
    event: inner ? parseMecatlEventValue(inner) : null,
    cursor: optionalString(raw.cursor) ?? "",
    phase: optionalString(raw.phase) ?? "",
  };
}

/** Renders a tool's JSON args as a compact `key: value · key: value` line. */
function prettyArgs(raw?: string): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(
        ([key, value]) =>
          `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
      )
      .join(" · ");
  } catch {
    return raw;
  }
}

const tokens = (value: string | number | undefined) => {
  const parsed = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Passes an enum through presence-aware: number or name kept, else absent. */
const wireEnum = (value: unknown): WireEnum | undefined =>
  typeof value === "number" || typeof value === "string" ? value : undefined;

/** An int field that may ride as a string through a protojson relay. */
const numericField = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

// The ADR-0239 failed-terminal enums. The Go mapper always stamps both on new
// servers (UNKNOWN=1 is a real value, distinct from ABSENT = old server), so
// the decode is presence-aware and an unrecognized value degrades to
// "unknown" — never to "retryable".
const RETRY_DISPOSITION_NAMES = {
  RETRY_DISPOSITION_UNKNOWN: 1,
  RETRY_DISPOSITION_RETRYABLE: 2,
  RETRY_DISPOSITION_PERMANENT: 3,
};
const RETRY_DISPOSITION_LABELS: Record<number, RetryDisposition> = {
  1: "unknown",
  2: "retryable",
  3: "permanent",
};
const STREAM_PROGRESS_NAMES = {
  STREAM_PROGRESS_UNKNOWN: 1,
  STREAM_PROGRESS_PRECOMMIT: 2,
  STREAM_PROGRESS_VISIBLE: 3,
  STREAM_PROGRESS_COMPLETE: 4,
};
const STREAM_PROGRESS_LABELS: Record<number, StreamProgress> = {
  1: "unknown",
  2: "precommit",
  3: "visible",
  4: "complete",
};

const retryDispositionLabel = (
  value: WireEnum | undefined,
): RetryDisposition | undefined =>
  value === undefined
    ? undefined
    : (RETRY_DISPOSITION_LABELS[enumNumber(value, RETRY_DISPOSITION_NAMES)] ??
      "unknown");

const streamProgressLabel = (
  value: WireEnum | undefined,
): StreamProgress | undefined =>
  value === undefined
    ? undefined
    : (STREAM_PROGRESS_LABELS[enumNumber(value, STREAM_PROGRESS_NAMES)] ??
      "unknown");

// Steer-echo media parts (proto Content). KIND_UNSPECIFIED and unknown kinds
// are dropped — a part Studio cannot classify cannot be rendered either.
const CONTENT_KIND_NAMES = { KIND_IMAGE: 1, KIND_AUDIO: 2 };
const CONTENT_KIND_LABELS: Record<number, SteerEchoPart["kind"]> = {
  1: "image",
  2: "audio",
};

function decodeSteerParts(
  parts: MecatlContentPart[] | undefined,
): SteerEchoPart[] | undefined {
  if (!parts?.length) return undefined;
  const decoded: SteerEchoPart[] = [];
  for (const part of parts) {
    const kind = CONTENT_KIND_LABELS[enumNumber(part.kind, CONTENT_KIND_NAMES)];
    if (!kind) continue;
    decoded.push({
      kind,
      mimeType: part.mime_type ?? "",
      data: part.data || undefined,
      url: part.url || undefined,
    });
  }
  return decoded.length > 0 ? decoded : undefined;
}

const routingDetail = (source: {
  routed_category?: string;
  routed_model?: string;
  model?: string;
}) =>
  [source.routed_category, source.routed_model || source.model]
    .filter(Boolean)
    .join(" → ");

/**
 * Event kinds that deliberately have no visual surface in Studio: run
 * lifecycle markers, redacted child-activity detail beyond the start badge,
 * and kinds that only ever appear in durable-log replays. The other two
 * log-only kinds (`user_prompt`, `approval`) decode above — the durable
 * watch (ADR 0250) replays them and they must render, not vanish.
 */
const SILENT_EVENT_KINDS = new Set([
  "session.init",
  "turn.start",
  "turn.end",
  "hook",
  // The pre-compaction conversation archive: audit history for the durable
  // log, deliberately not re-rendered into the live transcript.
  "compaction.archive",
  "team.member",
  "team.tasks",
  "team.findings",
  "team.end",
  "parallel.start",
  "parallel.end",
  "schedule.fired",
  "schedule.skipped",
  "schedule.failed",
  // The provider/model a prompt was routed to is an implementation detail,
  // not something the operator asked to see under every turn.
  "provider.route",
]);

/** Advisory kinds whose `text` is worth a one-line notice in the flow. */
const ADVISORY_EVENT_KINDS = new Set([
  "tool.progress",
  "compaction",
  "no_progress",
  "recover_notice",
]);

/**
 * Translates one decoded daemon frame into zero or more StreamEvents.
 *
 * Unknown event kinds become a visible notice, never a silent drop — a new
 * daemon capability must show up as "not rendered yet", not vanish.
 *
 * Every translated event is stamped with the frame's `run_id` (when the
 * daemon sent one), so consumers can capture the active run's identity from
 * the first run-bearing event and scope controls to it (ADR 0249).
 */
export function translateEvent(
  event: MecatlEvent,
  sessionId: string,
): StreamEvent[] {
  const translated = translateEventBody(event, sessionId);
  if (event.run_id) {
    for (const item of translated) item.runId = event.run_id;
  }
  return translated;
}

function translateEventBody(
  event: MecatlEvent,
  sessionId: string,
): StreamEvent[] {
  switch (event.type) {
    case "message.delta":
      return event.text ? [{ type: "token", text: event.text }] : [];
    case "reasoning.delta":
      return event.text ? [{ type: "reasoning", text: event.text }] : [];
    case "tool.call": {
      const call = event.tool_call;
      if (!call) return [];
      return [
        {
          type: "tool_call",
          callId: call.call_id ?? call.id ?? `call-${event.seq ?? ""}`,
          name: call.tool ?? call.name ?? "Tool",
          input: call.args ? prettyArgs(call.args) : "",
          file: fileFromToolCall(call.tool ?? call.name ?? "", call.args),
        },
      ];
    }
    case "tool.result": {
      const result = event.tool_result;
      if (!result) return [];
      return [
        {
          type: "tool_result",
          callId: result.call_id ?? "",
          output: result.result ?? result.content ?? "",
          isError: result.is_error,
        },
      ];
    }
    case "permission.ask": {
      const ask = event.ask;
      if (!ask) return [];
      return [
        {
          type: "approval",
          approvalId: ask.ask_id ?? "",
          sessionId,
          toolName: ask.tool ?? "",
          description: `${ask.tool ?? "A tool"} needs your approval.`,
          details: [ask.reason, prettyArgs(ask.args)]
            .filter(Boolean)
            .join("\n\n"),
        },
      ];
    }
    case "permission.retract":
      return event.ask?.ask_id
        ? [{ type: "retract", approvalId: event.ask.ask_id }]
        : [];
    case "steer":
      // The daemon drained the pending steer bundle into the run. The echo
      // carries the merged text, the watermark id of the last message it
      // absorbed — the hook splits its pending list on that id — and the
      // committed media bundle (ADR 0251).
      return [
        {
          type: "steer",
          text: event.steer?.text ?? "",
          messageId: event.steer?.message_id ?? "",
          parts: decodeSteerParts(event.steer?.parts),
        },
      ];
    case "model.retry":
      // The daemon is re-driving the failed step (ADR 0239): a quiet system
      // line, mirroring the other advisory kinds.
      return [{ type: "notice", text: "Retrying the failed step…" }];
    case "subagent.start": {
      const subagent = event.subagent;
      if (!subagent) return [];
      return [
        {
          type: "delegation",
          kind: "subagent",
          label: subagent.goal || "subagent",
          detail: routingDetail(subagent),
          childId: subagent.child_id,
          background: subagent.background,
          routingReason: subagent.routing_reason || undefined,
        },
      ];
    }
    case "subagent.tool": {
      // Live child activity (D1): cumulative counters for the delegation
      // card. Only redacted metadata crosses — never child content.
      const subagent = event.subagent;
      if (!subagent?.child_id) return [];
      const usage = subagent.usage;
      return [
        {
          type: "delegation_progress",
          childId: subagent.child_id,
          toolCount: subagent.tool_count,
          inputTokens: usage ? tokens(usage.input_tokens) : undefined,
          outputTokens: usage ? tokens(usage.output_tokens) : undefined,
          toolName: subagent.tool_name || undefined,
        },
      ];
    }
    case "subagent.end": {
      // Child terminal (D1): the stop reason, duration, final counters, and
      // the failure cause — a failed child must render, never vanish.
      const subagent = event.subagent;
      if (!subagent?.child_id) return [];
      const usage = subagent.usage;
      return [
        {
          type: "delegation_end",
          childId: subagent.child_id,
          stop: subagent.stop ?? "",
          toolCount: subagent.tool_count,
          inputTokens: usage ? tokens(usage.input_tokens) : undefined,
          outputTokens: usage ? tokens(usage.output_tokens) : undefined,
          durationMs: subagent.duration_ms,
          cause: subagent.cause || undefined,
        },
      ];
    }
    case "team.start": {
      const roster = event.team?.roster ?? [];
      return roster.map((member) => ({
        type: "delegation" as const,
        kind: "team" as const,
        label: [member.name, member.role && `(${member.role})`]
          .filter(Boolean)
          .join(" "),
        detail: routingDetail(member),
      }));
    }
    case "parallel.branch": {
      const parallel = event.parallel;
      if (!parallel || parallel.kind !== "branch_start") return [];
      const index = parallel.branch_index;
      return [
        {
          type: "delegation",
          kind: "parallel",
          label:
            parallel.branch_label ||
            (typeof index === "number" ? `branch ${index + 1}` : "branch"),
          detail: routingDetail(parallel),
        },
      ];
    }
    case "user_prompt":
      // The durable log's record of what the user asked (EvUserPrompt).
      // Only seen on watch/replay streams — the live prompt path never
      // carries it. Empty text (a media-only prompt) stays quiet.
      return event.user_prompt?.text
        ? [{ type: "user_prompt", text: event.user_prompt.text }]
        : [];
    case "approval": {
      // The verdict half of a permission ask (EvApproval), from the durable
      // log. Metadata only: the tool's NAME and the verdict string.
      const approval = event.approval;
      if (!approval) return [];
      return [
        {
          type: "approval_verdict",
          approvalId: approval.ask_id ?? "",
          toolName: approval.tool ?? "",
          verdict: approval.verdict ?? "",
        },
      ];
    }
    case "result": {
      const result = event.result;
      const events: StreamEvent[] = [];
      const usage = result?.usage;
      if (usage) {
        events.push({
          type: "usage",
          inputTokens: tokens(usage.input_tokens),
          outputTokens: tokens(usage.output_tokens),
          cacheReadTokens: tokens(usage.cache_read_tokens),
          cacheWriteTokens: tokens(usage.cache_write_tokens),
          reasoningTokens: tokens(usage.reasoning_tokens),
          estimatedCost: null,
        });
      }
      // A well-formed result with stop === "error" is a FAILED turn and must
      // render as one — the terminal frame always reaches the hook, even when
      // it carries no usage and no text.
      events.push({
        type: "run_result",
        stop: result?.stop ?? "",
        text: result?.text ?? "",
        errorText: result?.error ?? "",
        permanent: result?.permanent === true,
        retryDisposition: retryDispositionLabel(result?.retry_disposition),
        streamProgress: streamProgressLabel(result?.stream_progress),
      });
      return events;
    }
    default:
      if (SILENT_EVENT_KINDS.has(event.type)) return [];
      if (ADVISORY_EVENT_KINDS.has(event.type)) {
        return event.text ? [{ type: "notice", text: event.text }] : [];
      }
      return [
        {
          type: "notice",
          text: `Mecatl sent an event this Studio version does not render yet: ${event.type}`,
        },
      ];
  }
}
