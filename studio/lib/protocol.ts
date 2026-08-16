export type MecatlEvent = {
  type: string;
  seq?: string | number;
  text?: string;
  tool_call?: { id?: string; name?: string; args?: string; tool?: string; call_id?: string };
  tool_result?: { call_id?: string; content?: string; result?: string; is_error?: boolean; tool?: string };
  ask?: { ask_id?: string; tool?: string; args?: string; reason?: string };
  result?: { text?: string; stop?: string; error?: string; usage?: { input_tokens?: string | number; output_tokens?: string | number } };
  subagent?: { parent_call_id?: string; child_id?: string; goal?: string; routed_category?: string; routed_model?: string; model?: string };
  team?: { parent_call_id?: string; roster?: Array<{ name?: string; role?: string; routed_category?: string; routed_model?: string; model?: string }> };
  parallel?: { parent_call_id?: string; kind?: string; branch_index?: number; branch_label?: string; goal?: string; routed_category?: string; routed_model?: string; model?: string };
};

export type ScheduleRow = {
  name: string;
  prompt: string;
  cron: string;
  oneShotAt: number | null;
  workspace: string;
  mode: number;
  mutating: boolean;
  enabled: boolean;
  fireCount: number;
  nextFireAt: number | null;
  lastFireAt: number | null;
  fireStage: "idle" | "claimed" | "running";
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
const optionalString = (value: unknown) => typeof value === "string" ? value : undefined;
const optionalNumber = (value: unknown) => typeof value === "number" ? value : undefined;

function stringFields(value: unknown, names: string[]) {
  const source = asRecord(value);
  if (!source) return undefined;
  return Object.fromEntries(names.map((name) => [name, optionalString(source[name])])) as Record<string, string | undefined>;
}

export function parseMecatlEvent(data: string): MecatlEvent {
  const raw = asRecord(JSON.parse(data));
  if (!raw || typeof raw.type !== "string" || !raw.type) throw new Error("event.type is required");
  const event: MecatlEvent = {
    type: raw.type,
    seq: typeof raw.seq === "string" || typeof raw.seq === "number" ? raw.seq : undefined,
    text: optionalString(raw.text),
  };
  event.tool_call = stringFields(raw.tool_call, ["id", "name", "args", "tool", "call_id"]);
  const toolResult = asRecord(raw.tool_result);
  if (toolResult) event.tool_result = {
    ...stringFields(toolResult, ["call_id", "content", "result", "tool"]),
    is_error: typeof toolResult.is_error === "boolean" ? toolResult.is_error : undefined,
  };
  event.ask = stringFields(raw.ask, ["ask_id", "tool", "args", "reason"]);
  const result = asRecord(raw.result);
  if (result) event.result = {
    ...stringFields(result, ["text", "stop", "error"]),
    usage: asRecord(result.usage) as MecatlEvent["result"] extends { usage?: infer U } ? U : never,
  };
  event.subagent = stringFields(raw.subagent, ["parent_call_id", "child_id", "goal", "routed_category", "routed_model", "model"]);
  const team = asRecord(raw.team);
  if (team) event.team = {
    parent_call_id: optionalString(team.parent_call_id),
    roster: Array.isArray(team.roster) ? team.roster.map((member) => stringFields(member, ["name", "role", "routed_category", "routed_model", "model"]) ?? {}) : undefined,
  };
  const parallel = asRecord(raw.parallel);
  if (parallel) event.parallel = {
    ...stringFields(parallel, ["parent_call_id", "kind", "branch_label", "goal", "routed_category", "routed_model", "model"]),
    branch_index: optionalNumber(parallel.branch_index),
  };
  return event;
}

function protoMillis(value: unknown): number | null {
  const timestamp = asRecord(value);
  const seconds = Number(timestamp?.seconds ?? 0);
  if (!Number.isFinite(seconds) || seconds === 0) return null;
  const nanos = Number(timestamp?.nanos ?? 0);
  return seconds * 1000 + Math.floor((Number.isFinite(nanos) ? nanos : 0) / 1e6);
}

export function decodeScheduleRows(value: unknown): ScheduleRow[] {
  const body = asRecord(value);
  if (!Array.isArray(body?.schedules)) return [];
  return body.schedules.map((entryValue) => {
    const entry = asRecord(entryValue) ?? {};
    const spec = asRecord(entry.spec) ?? {};
    const state = asRecord(entry.state) ?? {};
    const trigger = asRecord(spec.trigger) ?? {};
    return {
      name: String(spec.name ?? ""),
      prompt: String(spec.prompt ?? ""),
      cron: String(trigger.cron ?? ""),
      oneShotAt: protoMillis(trigger.one_shot),
      workspace: String(spec.workspace ?? ""),
      mode: Number(spec.mode ?? 0),
      mutating: Boolean(spec.mutating),
      enabled: Boolean(state.enabled),
      fireCount: Number(state.fire_count ?? 0),
      nextFireAt: protoMillis(state.next_fire_at),
      lastFireAt: protoMillis(state.last_fire_at),
      fireStage: protoMillis(state.last_fire_started_at) !== null
        ? "running"
        : String(state.last_fire_session_id ?? "") === "pending" ? "claimed" : "idle",
    };
  });
}
