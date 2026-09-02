/**
 * Decoders and encoders for the daemon's schedule registry.
 *
 * The sharp edge this module encodes: request bodies are decoded with
 * PROTOJSON; responses are encoded with stdlib `encoding/json`. The two
 * disagree on every well-known type — a Timestamp reads back as
 * `{seconds,nanos}` but must be sent as RFC 3339, a Duration reads back as
 * `{seconds}` but must be sent as `"5s"` — so a response body can never be
 * echoed back as a request body.
 */

import {
  asRecord,
  enumNumber,
  numeric,
  optionalString,
  protoMillis,
  protoSeconds,
  type UnknownRecord,
} from "./internal";

/**
 * Per-fire budgets (proto Limits). Zero DISABLES a limit rather than meaning
 * "unset", so these are plain numbers: the form, the wire, and the daemon all
 * read 0 as "no cap".
 */
type ScheduleLimits = {
  maxTurns: number;
  maxToolCalls: number;
  maxConsecutiveFailures: number;
};

/**
 * The spec fields Studio's form does not expose, carried VERBATIM across an
 * edit.
 *
 * `PUT /v1/schedules/{name}` REPLACES the whole spec: the daemon preserves
 * only the firing state, the creation timestamp, and the captured owner.
 * Every other field a request omits is therefore deleted from the schedule —
 * so a field this UI has no control for still has to make the round trip, or
 * editing a prompt would silently drop a provider selector an operator set
 * from the CLI.
 *
 * `parts` stays opaque on purpose. It is multimodal Content this client never
 * renders, and decoding it into a typed shape only to re-encode it would be a
 * second mapping of a message we need only hand back unchanged.
 */
export type ScheduleCarriedSpec = {
  selectorProvider: string;
  selectorModel: string;
  misfire: number;
  singleton: boolean;
  carryContext: boolean;
  /** A proto Duration in seconds, fractions allowed. 0 = the deployment default. */
  fireTimeoutSeconds: number;
  parts: unknown[];
};

export type ScheduleRow = {
  name: string;
  prompt: string;
  cron: string;
  oneShotAt: number | null;
  timezone: string;
  workspace: string;
  profile: string;
  mode: number;
  mutating: boolean;
  maxFires: number;
  limits: ScheduleLimits;
  oneShotRetry: boolean;
  oneShotMaxRetries: number;
  enabled: boolean;
  fireCount: number;
  nextFireAt: number | null;
  lastFireAt: number | null;
  fireStage: "idle" | "claimed" | "running";
  /** Prior fire's session id — "" while a fire is only claimed ("pending"). */
  lastFireSessionId: string;
  /**
   * Display label for the verified caller the schedule is attributed to, empty
   * when the daemon runs without caller enforcement. Read-only on the wire: a
   * create or update request naming an owner is ignored, so it is never part of
   * an edit draft.
   */
  owner: string;
  carried: ScheduleCarriedSpec;
};

/**
 * One fire record (`GET /v1/schedules/{name}/fires`, `…/fires/{id}`).
 *
 * A fire written by RecordFireStart is IN-FLIGHT — it has a `startedAt` and no
 * `stop`; a fire written by RecordFire is terminal. A record with neither is a
 * claim that never started its run (the crash-after-claim state), which is why
 * `inFlight` keys off the ABSENT stop rather than off `startedAt`.
 */
export type ScheduleFireRow = {
  id: string;
  scheduleName: string;
  sessionId: string;
  firedAt: number | null;
  startedAt: number | null;
  progressAt: number | null;
  deadline: number | null;
  stop: string;
  err: string;
  inFlight: boolean;
};

/**
 * The editable half of a spec: what the panel's form owns.
 *
 * The trigger is a SUM type here because it is one on the wire (cron XOR
 * one-shot, a cross-field rule the daemon enforces fail-closed). Modelling it
 * as two optional fields would let the form build a body the daemon must
 * reject.
 */
type ScheduleTriggerDraft =
  | { kind: "cron"; cron: string; timezone: string }
  | { kind: "one-shot"; at: number };

export type ScheduleSpecDraft = {
  name: string;
  prompt: string;
  trigger: ScheduleTriggerDraft;
  profile: "" | "no-fs";
  workspace: string;
  mode: number;
  mutating: boolean;
  maxFires: number;
  limits: ScheduleLimits;
  oneShotRetry: boolean;
  oneShotMaxRetries: number;
};

const PERMISSION_MODES: Record<string, number> = {
  PERMISSION_MODE_UNSPECIFIED: 0,
  PERMISSION_MODE_DEFAULT: 1,
  PERMISSION_MODE_PLAN: 2,
  PERMISSION_MODE_ACCEPT_EDITS: 3,
};

const MISFIRE_POLICIES: Record<string, number> = {
  MISFIRE_POLICY_UNSPECIFIED: 0,
  MISFIRE_FIRE_ONCE_NOW: 1,
  MISFIRE_SKIP: 2,
};

function decodeLimits(value: unknown): ScheduleLimits {
  const limits = asRecord(value) ?? {};
  return {
    maxTurns: numeric(limits.max_turns),
    maxToolCalls: numeric(limits.max_tool_calls),
    maxConsecutiveFailures: numeric(limits.max_consecutive_failures),
  };
}

// The owner's `name` is display-only by contract and `subject` is the
// identity, so the label prefers the name and falls back to the id rather than
// inventing a friendly string. An absent owner stays empty: an ownerless
// schedule is never rendered as an anonymous somebody.
function decodeOwner(value: unknown): string {
  const owner = asRecord(value);
  if (!owner) return "";
  return optionalString(owner.name) || optionalString(owner.subject) || "";
}

export function decodeScheduleRows(value: unknown): ScheduleRow[] {
  const body = asRecord(value);
  if (!Array.isArray(body?.schedules)) return [];
  return body.schedules.map((entryValue) => {
    const entry = asRecord(entryValue) ?? {};
    const spec = asRecord(entry.spec) ?? {};
    const state = asRecord(entry.state) ?? {};
    const trigger = asRecord(spec.trigger) ?? {};
    const selector = asRecord(spec.selector) ?? {};
    const lastFireSessionId = String(state.last_fire_session_id ?? "");
    return {
      name: String(spec.name ?? ""),
      prompt: String(spec.prompt ?? ""),
      cron: String(trigger.cron ?? ""),
      oneShotAt: protoMillis(trigger.one_shot),
      timezone: String(spec.timezone ?? ""),
      workspace: String(spec.workspace ?? ""),
      profile: String(spec.profile ?? ""),
      mode: enumNumber(spec.mode, PERMISSION_MODES),
      mutating: Boolean(spec.mutating),
      maxFires: numeric(spec.max_fires),
      limits: decodeLimits(spec.limits),
      oneShotRetry: Boolean(spec.one_shot_retry),
      oneShotMaxRetries: numeric(spec.one_shot_max_retries),
      enabled: Boolean(state.enabled),
      fireCount: numeric(state.fire_count),
      nextFireAt: protoMillis(state.next_fire_at),
      lastFireAt: protoMillis(state.last_fire_at),
      fireStage:
        protoMillis(state.last_fire_started_at) !== null
          ? "running"
          : lastFireSessionId === "pending"
            ? "claimed"
            : "idle",
      lastFireSessionId:
        lastFireSessionId === "pending" ? "" : lastFireSessionId,
      owner: decodeOwner(spec.owner),
      carried: {
        selectorProvider: String(selector.provider_id ?? ""),
        selectorModel: String(selector.model_id ?? ""),
        misfire: enumNumber(spec.misfire, MISFIRE_POLICIES),
        singleton: Boolean(spec.singleton),
        carryContext: Boolean(spec.carry_context),
        fireTimeoutSeconds: protoSeconds(spec.fire_timeout),
        parts: Array.isArray(spec.parts) ? spec.parts : [],
      },
    };
  });
}

function decodeFire(value: unknown): ScheduleFireRow | undefined {
  const fire = asRecord(value);
  const id = optionalString(fire?.id) ?? "";
  // A record with no id cannot be refreshed or correlated to a session; it is a
  // corrupt envelope rather than a fire, so it is dropped instead of rendered.
  if (!fire || !id) return undefined;
  const stop = optionalString(fire.stop) ?? "";
  return {
    id,
    scheduleName: optionalString(fire.schedule_name) ?? "",
    sessionId: optionalString(fire.session_id) ?? "",
    firedAt: protoMillis(fire.fired_at),
    startedAt: protoMillis(fire.started_at),
    progressAt: protoMillis(fire.progress_at),
    deadline: protoMillis(fire.deadline),
    stop,
    err: optionalString(fire.err) ?? "",
    inFlight: stop === "",
  };
}

/**
 * `GET /v1/schedules/{name}/fires`, newest first.
 *
 * The API documents the list as having NO guaranteed order, so the display
 * order is this decoder's job — an oversight surface that shows a random fire
 * first is worse than useless. A record with no `fired_at` sorts last rather
 * than first, which is where an un-clocked claim belongs.
 */
export function decodeScheduleFires(value: unknown): ScheduleFireRow[] {
  const body = asRecord(value);
  const rows = Array.isArray(body?.fires) ? body.fires : [];
  return rows
    .map(decodeFire)
    .filter((fire): fire is ScheduleFireRow => fire !== undefined)
    .sort((left, right) => (right.firedAt ?? 0) - (left.firedAt ?? 0));
}

/** The edit prefill: the stored row split into the half the form owns. */
export function scheduleDraftFromRow(row: ScheduleRow): ScheduleSpecDraft {
  return {
    name: row.name,
    prompt: row.prompt,
    trigger:
      !row.cron && row.oneShotAt !== null
        ? { kind: "one-shot", at: row.oneShotAt }
        : { kind: "cron", cron: row.cron, timezone: row.timezone },
    profile: row.profile === "no-fs" ? "no-fs" : "",
    workspace: row.workspace,
    mode: row.mode,
    mutating: row.mutating,
    maxFires: row.maxFires,
    limits: row.limits,
    oneShotRetry: row.oneShotRetry,
    oneShotMaxRetries: row.oneShotMaxRetries,
  };
}

/**
 * The body for `POST /v1/schedules` and `PUT /v1/schedules/{name}`.
 *
 * `carried` is omitted on a create (there is nothing to preserve yet) and
 * passed on an edit, where leaving it out would delete the fields this form
 * cannot edit. Server-owned fields — `created_at` and `owner` — are
 * deliberately never sent.
 */
export function encodeScheduleSpec(
  draft: ScheduleSpecDraft,
  carried?: ScheduleCarriedSpec,
): UnknownRecord {
  const spec: UnknownRecord = {
    name: draft.name,
    prompt: draft.prompt,
    profile: draft.profile,
    workspace: draft.workspace,
    mode: draft.mode,
    mutating: draft.mutating,
    limits: {
      max_turns: draft.limits.maxTurns,
      max_tool_calls: draft.limits.maxToolCalls,
      max_consecutive_failures: draft.limits.maxConsecutiveFailures,
    },
  };
  if (draft.trigger.kind === "cron") {
    // max_fires bounds a cron's total fires; a one-shot fires once by
    // definition and the daemon ignores it there. one_shot_retry is the mirror
    // image — the create-seam REJECTS a cron that carries it, so neither field
    // is sent on the trigger it does not belong to.
    spec.trigger = { cron: draft.trigger.cron };
    spec.timezone = draft.trigger.timezone;
    spec.max_fires = draft.maxFires;
  } else {
    spec.trigger = { one_shot: new Date(draft.trigger.at).toISOString() };
    spec.one_shot_retry = draft.oneShotRetry;
    if (draft.oneShotRetry) spec.one_shot_max_retries = draft.oneShotMaxRetries;
  }
  if (!carried) return spec;
  spec.singleton = carried.singleton;
  spec.misfire = carried.misfire;
  spec.carry_context = carried.carryContext;
  if (carried.selectorProvider || carried.selectorModel) {
    spec.selector = {
      provider_id: carried.selectorProvider,
      model_id: carried.selectorModel,
    };
  }
  if (carried.fireTimeoutSeconds > 0)
    spec.fire_timeout = `${carried.fireTimeoutSeconds}s`;
  if (carried.parts.length) spec.parts = carried.parts;
  return spec;
}
