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

import type { StreamEvent } from "@/features/agent/types";
import { fileFromToolCall } from "@/lib/file-meta";
import {
  asRecord,
  optionalNumber,
  optionalString,
  stringFields,
} from "./internal";

type MecatlUsage = {
  input_tokens?: string | number;
  output_tokens?: string | number;
  cache_read_tokens?: string | number;
  cache_write_tokens?: string | number;
  reasoning_tokens?: string | number;
};

export type MecatlEvent = {
  type: string;
  seq?: string | number;
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
  /** Drain echo for mid-run steering: `text` is the drained bundle and
   *  `message_id` the client-minted id of the LAST message merged into it
   *  (the watermark the client splits its pending list on). */
  steer?: { text?: string; message_id?: string };
  result?: {
    text?: string;
    stop?: string;
    error?: string;
    permanent?: boolean;
    usage?: MecatlUsage;
  };
  subagent?: {
    parent_call_id?: string;
    child_id?: string;
    goal?: string;
    routed_category?: string;
    routed_model?: string;
    model?: string;
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
};

export function parseMecatlEvent(data: string): MecatlEvent {
  const raw = asRecord(JSON.parse(data));
  if (!raw || typeof raw.type !== "string" || !raw.type)
    throw new Error("event.type is required");
  const event: MecatlEvent = {
    type: raw.type,
    seq:
      typeof raw.seq === "string" || typeof raw.seq === "number"
        ? raw.seq
        : undefined,
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
  event.steer = stringFields(raw.steer, ["text", "message_id"]);
  const result = asRecord(raw.result);
  if (result)
    event.result = {
      ...stringFields(result, ["text", "stop", "error"]),
      permanent:
        typeof result.permanent === "boolean" ? result.permanent : undefined,
      usage: asRecord(result.usage) as MecatlUsage | undefined,
    };
  event.subagent = stringFields(raw.subagent, [
    "parent_call_id",
    "child_id",
    "goal",
    "routed_category",
    "routed_model",
    "model",
  ]);
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
  return event;
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
 * and kinds that only ever appear in durable-log replays.
 */
const SILENT_EVENT_KINDS = new Set([
  "session.init",
  "turn.start",
  "turn.end",
  "hook",
  "compaction.archive",
  "subagent.tool",
  "subagent.end",
  "team.member",
  "team.tasks",
  "team.findings",
  "team.end",
  "parallel.start",
  "parallel.end",
  "user_prompt",
  "approval",
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
 */
export function translateEvent(
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
      // carries the merged text and the watermark id of the last message it
      // absorbed — the hook splits its pending list on that id.
      return [
        {
          type: "steer",
          text: event.steer?.text ?? "",
          messageId: event.steer?.message_id ?? "",
        },
      ];
    case "subagent.start": {
      const subagent = event.subagent;
      if (!subagent) return [];
      return [
        {
          type: "delegation",
          kind: "subagent",
          label: subagent.goal || "subagent",
          detail: routingDetail(subagent),
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
