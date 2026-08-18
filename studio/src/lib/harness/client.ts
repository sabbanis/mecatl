/**
 * Browser-side client for a locally running mecatl daemon, reached through the
 * /api/harness proxy.
 *
 * mecatl's own SSE frames map almost 1:1 onto this prototype's StreamEvent
 * union, so this module's job is naming and shape translation, not invention:
 * `message.delta` → token, `tool.call`/`tool.result` → tool_call/tool_result,
 * `permission.ask` → approval, `result` → usage + done.
 */

import type { StreamEvent } from "@/features/agent/types";

const HARNESS_API = "/api/harness";

/** Raw mecatl SSE frame. Field names are snake_case on the wire. */
interface HarnessEvent {
  type?: string;
  seq?: string | number;
  text?: string;
  tool_call?: {
    id?: string;
    call_id?: string;
    name?: string;
    tool?: string;
    args?: string;
  };
  tool_result?: {
    call_id?: string;
    tool?: string;
    content?: string;
    result?: string;
    is_error?: boolean;
  };
  ask?: { ask_id?: string; tool?: string; args?: string; reason?: string };
  result?: {
    text?: string;
    stop?: string;
    usage?: { input_tokens?: string | number; output_tokens?: string | number };
  };
}

export interface HarnessStatus {
  live: boolean;
  detail: string;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

/**
 * Cheap liveness probe. A deployed instance has no daemon on loopback, so this
 * failing is the expected path there — callers fall back to mock behaviour.
 */
export async function probeHarness(
  signal?: AbortSignal,
): Promise<HarnessStatus> {
  try {
    const response = await fetch(`${HARNESS_API}/models`, {
      signal,
      cache: "no-store",
    });
    if (!response.ok) return { live: false, detail: await readError(response) };
    return { live: true, detail: "connected" };
  } catch (error) {
    return {
      live: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Creates a harness session. The workspace every file and shell tool is rooted
 * at is injected by the proxy from MECATL_WORKSPACE, so it is deliberately not a
 * parameter here — the browser never needs to know the server's paths.
 */
export async function createHarnessSession(
  mode: "default" | "plan" = "default",
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`${HARNESS_API}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
    signal,
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { session_id?: string };
  if (!body.session_id) throw new Error("harness returned no session id");
  return body.session_id;
}

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

/** Translates one mecatl frame into zero or more prototype StreamEvents. */
function translate(event: HarnessEvent, sessionId: string): StreamEvent[] {
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
          description: `${ask.tool ?? "A tool"} needs your approval.`,
          details: [ask.reason, prettyArgs(ask.args)]
            .filter(Boolean)
            .join("\n\n"),
        },
      ];
    }
    case "result": {
      const usage = event.result?.usage;
      if (!usage) return [];
      return [
        {
          type: "usage",
          inputTokens: Number(usage.input_tokens ?? 0),
          outputTokens: Number(usage.output_tokens ?? 0),
          estimatedCost: null,
        },
      ];
    }
    default:
      // turn.start, subagent.*, team.*, compaction.* and friends carry no UI
      // surface in this prototype yet. Dropping them is deliberate.
      return [];
  }
}

/**
 * Streams one prompt turn, invoking `onEvent` per translated event.
 *
 * The response is text/event-stream: frames are separated by a blank line and
 * the payload rides a `data:` line, so partial frames must be buffered across
 * reads rather than parsed per chunk.
 */
export async function streamHarnessPrompt(
  sessionId: string,
  text: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/prompt`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  if (!response.body) throw new Error("harness returned no event stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame
        .split("\n")
        .find((candidate) => candidate.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice("data:".length).trim();
      if (!payload) continue;
      let parsed: HarnessEvent;
      try {
        parsed = JSON.parse(payload) as HarnessEvent;
      } catch {
        continue;
      }
      for (const translated of translate(parsed, sessionId)) {
        onEvent(translated);
      }
    }
  }
}

/** Resolves a parked permission ask. */
export async function respondToHarnessApproval(
  sessionId: string,
  askId: string,
  allow: boolean,
): Promise<void> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ask_id: askId, allow }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
}

// ── Memory (user model) ─────────────────────────────────────────────────────

/**
 * Reads the harness user model: durable facts the agent has stored about the
 * operator, cross-project. The API returns the INDEX only — key plus one-line
 * description — and never entry values, which the agent loads with RecallUser.
 *
 * There is no write endpoint: the agent curates memory through injection-scanned
 * tool calls, so this is read-only by construction, not by choice.
 */
export async function fetchHarnessUserModel(
  signal?: AbortSignal,
): Promise<{ key: string; description: string }[]> {
  const response = await fetch(`${HARNESS_API}/usermodel`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    entries?: { key?: string; description?: string }[];
  };
  return (body.entries ?? []).map((entry) => ({
    key: entry.key ?? "",
    description: entry.description ?? "",
  }));
}

// ── Schedules ───────────────────────────────────────────────────────────────

interface HarnessTimestamp {
  seconds?: string | number;
  nanos?: number;
}

/** proto3 JSON omits a zero Timestamp entirely, which means "never" here. */
function timestampMillis(value?: HarnessTimestamp): number | null {
  const seconds = Number(value?.seconds ?? 0);
  if (!seconds) return null;
  return seconds * 1000 + Math.floor((value?.nanos ?? 0) / 1e6);
}

export interface HarnessSchedule {
  name: string;
  prompt: string;
  cron: string;
  enabled: boolean;
  fireCount: number;
  lastFireAt: number | null;
  nextFireAt: number | null;
  live: boolean;
  /** Prior fire's session id — "" while a fire is only claimed ("pending"). */
  lastFireSessionId: string;
}

export async function listHarnessSchedules(
  signal?: AbortSignal,
): Promise<HarnessSchedule[]> {
  const response = await fetch(`${HARNESS_API}/schedules`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    schedules?: {
      spec?: {
        name?: string;
        prompt?: string;
        trigger?: { cron?: string };
      };
      state?: {
        enabled?: boolean;
        fire_count?: number;
        last_fire_at?: HarnessTimestamp;
        next_fire_at?: HarnessTimestamp;
        last_fire_started_at?: HarnessTimestamp;
        last_fire_session_id?: string;
      };
    }[];
  };
  return (body.schedules ?? []).map((entry) => ({
    name: entry.spec?.name ?? "",
    prompt: entry.spec?.prompt ?? "",
    cron: entry.spec?.trigger?.cron ?? "",
    enabled: Boolean(entry.state?.enabled),
    fireCount: Number(entry.state?.fire_count ?? 0),
    lastFireAt: timestampMillis(entry.state?.last_fire_at),
    nextFireAt: timestampMillis(entry.state?.next_fire_at),
    // A Claim leaves the "pending" sentinel before the run starts; both that and
    // a set started_at mean a fire is live right now.
    live:
      timestampMillis(entry.state?.last_fire_started_at) !== null ||
      entry.state?.last_fire_session_id === "pending",
    lastFireSessionId:
      entry.state?.last_fire_session_id === "pending"
        ? ""
        : (entry.state?.last_fire_session_id ?? ""),
  }));
}

/**
 * Creates a schedule. Non-mutating schedules MUST run in plan mode — the daemon
 * rejects anything wider — so this always creates the read-only kind and leaves
 * write-capable schedules to a deliberate act elsewhere.
 */
export async function createHarnessSchedule(
  name: string,
  cron: string,
  prompt: string,
): Promise<void> {
  const response = await fetch(`${HARNESS_API}/schedules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      prompt,
      trigger: { cron },
      mode: "PERMISSION_MODE_PLAN",
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

/**
 * Runs one schedule action. NOTE: "fire" is synchronous on the harness — the
 * request stays open for the whole agent run, which can be minutes.
 */
export async function harnessScheduleAction(
  name: string,
  action: "pause" | "resume" | "fire" | "delete",
): Promise<void> {
  const encoded = encodeURIComponent(name);
  const path =
    action === "delete"
      ? `${HARNESS_API}/schedules/${encoded}`
      : `${HARNESS_API}/schedules/${encoded}/${action}`;
  const response = await fetch(path, {
    method: action === "delete" ? "DELETE" : "POST",
  });
  if (!response.ok) throw new Error(await readError(response));
}

// ── Skills ──────────────────────────────────────────────────────────────────

/**
 * Reads the skill inventory the daemon resolved at startup from its --skills-dir.
 * The model sees only each skill's name and one-line summary until it chooses to
 * load one, which is exactly what this returns.
 */
export async function listHarnessSkills(
  signal?: AbortSignal,
): Promise<{ name: string; description: string }[]> {
  const response = await fetch(`${HARNESS_API}/skills`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    skills?: { name?: string; description?: string }[];
  };
  return (body.skills ?? []).map((skill) => ({
    name: skill.name ?? "",
    description: skill.description ?? "",
  }));
}

/** Reads the selectable provider/model inventory. Carries no secret material. */
export async function listHarnessModels(
  signal?: AbortSignal,
): Promise<{ id: string; providerId: string; displayName: string }[]> {
  const response = await fetch(`${HARNESS_API}/models`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    models?: { id?: string; provider_id?: string; display_name?: string }[];
  };
  return (body.models ?? []).map((model) => ({
    id: model.id ?? "",
    providerId: model.provider_id ?? "",
    displayName: model.display_name ?? model.id ?? "",
  }));
}

// ── Controller: provider, model router, MCP gateway ─────────────────────────

const CONTROL_API = "/api/harness-control";

/**
 * The MCP gateway this deployment uses. Fixed rather than user-entered: the
 * connector gateway is the one supported tool source here, and letting an
 * arbitrary URL be typed in invites pointing the agent's tool catalog at
 * something nobody vetted.
 *
 * Streamable HTTP over https, which is the only MCP transport mecatl supports.
 */
export const MCP_GATEWAY_URL = "https://connector-gateway.stacklok.dev/gw/mcp";
export const MCP_GATEWAY_NAME = "gateway";

export interface HarnessControlStatus {
  provider: string;
  running: boolean;
  gateway: { name: string; url: string } | null;
  modelRouter: { enabled: boolean; categories: number } | null;
  operatorSettings: boolean;
  skillsDir: string;
  memoryDir: string;
}

export async function fetchHarnessControlStatus(
  signal?: AbortSignal,
): Promise<HarnessControlStatus | null> {
  try {
    const response = await fetch(`${CONTROL_API}/status`, {
      signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      provider?: string;
      running?: boolean;
      gateway?: { name?: string; url?: string } | null;
      modelRouter?: { enabled?: boolean; categories?: number } | null;
      operatorSettings?: boolean;
      skills?: { dir?: string };
      memory?: { dir?: string };
    };
    return {
      provider: body.provider ?? "unknown",
      running: Boolean(body.running),
      gateway: body.gateway?.url
        ? { name: body.gateway.name ?? "gateway", url: body.gateway.url }
        : null,
      modelRouter: body.modelRouter
        ? {
            enabled: Boolean(body.modelRouter.enabled),
            categories: Number(body.modelRouter.categories ?? 0),
          }
        : null,
      operatorSettings: Boolean(body.operatorSettings),
      skillsDir: body.skills?.dir ?? "",
      memoryDir: body.memory?.dir ?? "",
    };
  } catch {
    return null;
  }
}

export interface HarnessRouterCategory {
  name: string;
  description: string;
  model: string;
}

export interface HarnessRouterConfig {
  enabled: boolean;
  classifierModel: string;
  defaultCategory: string;
  categories: HarnessRouterCategory[];
  /** True when routing comes from an imported operator settings file, which this UI must not overwrite. */
  managedByOperator: boolean;
}

export async function fetchHarnessRouter(
  signal?: AbortSignal,
): Promise<HarnessRouterConfig | null> {
  const response = await fetch(`${CONTROL_API}/model-router`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    config?: {
      enabled?: boolean;
      classifierModel?: string;
      defaultCategory?: string;
      categories?: { name?: string; description?: string; model?: string }[];
    } | null;
    managedBy?: string;
  };
  return {
    enabled: Boolean(body.config?.enabled),
    classifierModel: body.config?.classifierModel ?? "",
    defaultCategory: body.config?.defaultCategory ?? "",
    categories: (body.config?.categories ?? []).map((category) => ({
      name: category.name ?? "",
      description: category.description ?? "",
      model: category.model ?? "",
    })),
    managedByOperator: body.managedBy === "operator-settings",
  };
}

/** Saves routing config. RESTARTS the daemon. */
export async function saveHarnessRouter(
  config: Omit<HarnessRouterConfig, "managedByOperator">,
): Promise<void> {
  const response = await fetch(`${CONTROL_API}/model-router`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error(await readError(response));
}

/**
 * Connects an MCP gateway. RESTARTS the daemon, and a failed handshake rolls the
 * previous gateway back on the controller side.
 *
 * The token is passed straight through to the loopback controller and is never
 * stored, logged, or echoed by this UI.
 */
export async function connectHarnessGateway(token?: string): Promise<void> {
  const response = await fetch(`${CONTROL_API}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: MCP_GATEWAY_NAME,
      url: MCP_GATEWAY_URL,
      token: token?.trim() || undefined,
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

// ── Skill authoring (local files) ───────────────────────────────────────────

const SKILLS_API = "/api/harness-skills";

export interface HarnessSkillFile {
  name: string;
  description: string;
  body: string;
}

/**
 * Reads skills from DISK, which is deliberately a different source from
 * listHarnessSkills(): the daemon resolves its inventory once at startup, so a
 * freshly authored skill exists on disk while the running agent still cannot see
 * it. Reconciling the two is what lets the UI show a "restart to load" state
 * instead of pretending the write took effect.
 */
export async function fetchHarnessSkillFiles(
  signal?: AbortSignal,
): Promise<{ dir: string; skills: HarnessSkillFile[] }> {
  const response = await fetch(SKILLS_API, { signal, cache: "no-store" });
  const body = (await response.json()) as {
    dir?: string;
    skills?: HarnessSkillFile[];
    error?: string;
  };
  if (!response.ok) throw new Error(body.error ?? "could not read skills");
  return { dir: body.dir ?? "", skills: body.skills ?? [] };
}

/** Creates or overwrites a skill's SKILL.md. */
export async function saveHarnessSkill(skill: HarnessSkillFile): Promise<void> {
  const response = await fetch(SKILLS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skill),
  });
  if (!response.ok) throw new Error(await readError(response));
}

/** Deletes a skill directory. */
export async function deleteHarnessSkill(name: string): Promise<void> {
  const response = await fetch(
    `${SKILLS_API}?name=${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(await readError(response));
}

/**
 * Restarts the daemon through the controller so newly written skills are
 * resolved. The controller holds the provider credential in memory, so the
 * daemon comes back with the same provider and gateway.
 */
export async function reloadHarnessDaemon(): Promise<void> {
  const response = await fetch(`${CONTROL_API}/restart`, { method: "POST" });
  if (!response.ok) throw new Error(await readError(response));
}

// ── Agent runs (real instances in the harness) ──────────────────────────────

/**
 * A running agent is a team member: mecatl has no "run one named definition"
 * endpoint, but a member spec carries `agent_type` — the definition it adopts —
 * and each member gets its own session. So a one-member team IS the supported
 * way to run a definition outside a chat, and that is what this launches.
 */
export interface HarnessRunMember {
  name: string;
  state: string;
  sessionId: string;
}

export interface HarnessRun {
  teamId: string;
  members: HarnessRunMember[];
}

export async function launchHarnessRun(input: {
  name: string;
  agentType?: string;
  goal: string;
  mutating?: boolean;
}): Promise<HarnessRun> {
  const response = await fetch(`${HARNESS_API}/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      goal: input.goal,
      members: [
        {
          name: input.name,
          agent_type: input.agentType || undefined,
          lead: true,
          mutating: Boolean(input.mutating),
          initial_prompt: input.goal,
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    team_id?: string;
    members?: { name?: string; state?: string; session_id?: string }[];
  };
  return {
    teamId: body.team_id ?? "",
    members: (body.members ?? []).map((member) => ({
      name: member.name ?? "",
      state: member.state ?? "",
      sessionId: member.session_id ?? "",
    })),
  };
}

/**
 * Drives a launched run to completion, reporting each event type as it arrives.
 * The stream ends with a terminal outcome frame.
 */
export async function streamHarnessRun(
  teamId: string,
  onEvent: (kind: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${HARNESS_API}/teams/${encodeURIComponent(teamId)}/run`,
    { method: "POST", signal },
  );
  if (!response.ok) throw new Error(await readError(response));
  if (!response.body) throw new Error("run returned no event stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame
        .split("\n")
        .find((candidate) => candidate.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice("data:".length).trim();
      if (!payload) continue;
      try {
        const event = JSON.parse(payload) as { type?: string };
        onEvent(typeof event.type === "string" ? event.type : "event");
      } catch {
        // An unparseable frame is not worth failing the run over.
      }
    }
  }
}

/** Releases a finished run's resources. Its session transcripts survive. */
export async function deleteHarnessRun(teamId: string): Promise<void> {
  await fetch(`${HARNESS_API}/teams/${encodeURIComponent(teamId)}`, {
    method: "DELETE",
  }).catch(() => undefined);
}

export interface HarnessInstance {
  sessionId: string;
  kind: "team" | "subagent" | "scheduled" | "chat";
  /** Human-facing name derived from the id — NOT the raw title, which for
   * non-chat runs is the goal prompt and can leak absolute paths. */
  label: string;
  title: string;
  state: string;
  turns: number;
  modifiedAt: number;
}

/** Derives a displayable name from a run session id. */
function instanceLabel(
  id: string,
  kind: HarnessInstance["kind"],
  title: string,
): string {
  if (kind === "team") {
    const member = id.match(/^team-team-[0-9a-f]+-(.+)$/);
    if (member) return member[1];
    return id.replace(/^team-/, "");
  }
  if (kind === "scheduled") {
    const sched = id.match(/^sched--(.+)-\d{8}-\d{6}-[0-9a-f]+$/);
    if (sched) return sched[1];
    return id.replace(/^sched--/, "");
  }
  if (kind === "subagent") return id.replace(/^subagent-/, "");
  return title || id;
}

/**
 * Lists agent instances from the session store. Every run the harness performs
 * lands there as a session with a prefixed id, which is the only way to see
 * instances that outlived the page: there is no list-teams endpoint.
 */
export async function listHarnessInstances(
  signal?: AbortSignal,
): Promise<HarnessInstance[]> {
  const response = await fetch(`${HARNESS_API}/sessions`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    sessions?: {
      session_id?: string;
      title?: string;
      state?: string;
      turns?: number;
      modified_at_unix?: number | string;
    }[];
  };
  return (body.sessions ?? []).map((session) => {
    const id = session.session_id ?? "";
    const kind: HarnessInstance["kind"] = id.startsWith("team-")
      ? "team"
      : id.startsWith("subagent-")
        ? "subagent"
        : id.startsWith("sched--")
          ? "scheduled"
          : "chat";
    const title = session.title ?? "";
    return {
      sessionId: id,
      kind,
      label: instanceLabel(id, kind, title),
      title,
      state: session.state ?? "",
      turns: Number(session.turns ?? 0),
      modifiedAt: Number(session.modified_at_unix ?? 0) * 1000,
    };
  });
}

// ── Transcript replay ────────────────────────────────────────────────────────

export interface TranscriptEntry {
  role: "user" | "assistant" | "event";
  text: string;
}

/**
 * Reconstructs a finished session's conversation from the durable event log
 * (`/events` is a pure replay that ends at the log's tail — no live tail).
 * `user_prompt` and per-turn `result` events carry the clean text; tool calls
 * are summarised as event lines rather than replayed in full.
 */
export async function fetchHarnessTranscript(
  sessionId: string,
  signal?: AbortSignal,
): Promise<TranscriptEntry[]> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/events`,
    { signal, cache: "no-store" },
  );
  if (!response.ok) throw new Error(await readError(response));
  const raw = await response.text();
  const entries: TranscriptEntry[] = [];
  let toolCalls = 0;
  const flushTools = () => {
    if (toolCalls > 0) {
      entries.push({
        role: "event",
        text: `${toolCalls} tool call${toolCalls === 1 ? "" : "s"}`,
      });
      toolCalls = 0;
    }
  };
  const parseFrames = (frames: string[]) => frames;
  for (const frame of parseFrames(raw.split("\n\n"))) {
    const line = frame
      .split("\n")
      .find((candidate) => candidate.startsWith("data:"));
    if (!line) continue;
    let event: {
      type?: string;
      user_prompt?: { text?: string };
      result?: { text?: string };
      schedule?: { kind?: string; stop?: string };
    };
    try {
      event = JSON.parse(line.slice("data:".length).trim());
    } catch {
      continue;
    }
    switch (event.type) {
      case "user_prompt":
        flushTools();
        entries.push({ role: "user", text: event.user_prompt?.text ?? "" });
        break;
      case "result":
        flushTools();
        entries.push({ role: "assistant", text: event.result?.text ?? "" });
        break;
      case "tool.call":
        toolCalls += 1;
        break;
      case "schedule.fired":
        entries.push({
          role: "event",
          text: `scheduled fire · ${event.schedule?.stop || event.schedule?.kind || "recorded"}`,
        });
        break;
      default:
        break;
    }
  }
  flushTools();
  if (entries.some((entry) => entry.role !== "event")) return entries;

  // Nothing conversational in the durable log — a tick-loop fire records only
  // its outcome there. The full conversation lives in the store's snapshot on
  // disk, which the snapshot route can read in local development.
  try {
    const snapshot = await fetch(
      `/api/harness-transcript?session=${encodeURIComponent(sessionId)}`,
      { signal, cache: "no-store" },
    );
    if (!snapshot.ok) return entries;
    const body = (await snapshot.json()) as {
      entries?: {
        role: "user" | "assistant";
        text: string;
        toolCalls?: number;
      }[];
      stop?: string;
    };
    const fromSnapshot: TranscriptEntry[] = [];
    for (const message of body.entries ?? []) {
      if (message.toolCalls) {
        fromSnapshot.push({
          role: "event",
          text: `${message.toolCalls} tool call${message.toolCalls === 1 ? "" : "s"}`,
        });
      }
      fromSnapshot.push({ role: message.role, text: message.text });
    }
    if (fromSnapshot.length === 0) return entries;
    if (body.stop) {
      fromSnapshot.push({ role: "event", text: `stop: ${body.stop}` });
    }
    return fromSnapshot;
  } catch {
    return entries;
  }
}

// ── Agent definitions (local files) ─────────────────────────────────────────

const AGENTS_API = "/api/harness-agents";

export interface HarnessAgentFile {
  name: string;
  description: string;
  model: string;
  body: string;
  /** Which directory it came from — .mecatl/agents is ours, .claude/agents is shared. */
  source: string;
  writable: boolean;
  /** True when the definition carries a `hooks:` map, which runs ungated shell. */
  hasHooks: boolean;
}

/**
 * Reads agent definitions from DISK. Like skills, this is a different source
 * from the daemon's resolved inventory (`/v1/agents`): the daemon discovers
 * definitions once at startup, so a freshly written one exists on disk while the
 * running agent cannot delegate to it yet.
 */
export async function fetchHarnessAgentFiles(
  signal?: AbortSignal,
): Promise<{ dir: string; agents: HarnessAgentFile[] }> {
  const response = await fetch(AGENTS_API, { signal, cache: "no-store" });
  const body = (await response.json()) as {
    dir?: string;
    agents?: HarnessAgentFile[];
    error?: string;
  };
  if (!response.ok) throw new Error(body.error ?? "could not read agents");
  return { dir: body.dir ?? "", agents: body.agents ?? [] };
}

/** Creates or overwrites a definition under .mecatl/agents. */
export async function saveHarnessAgent(agent: {
  name: string;
  description: string;
  model: string;
  body: string;
}): Promise<void> {
  const response = await fetch(AGENTS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(agent),
  });
  if (!response.ok) throw new Error(await readError(response));
}

/** Deletes a definition from .mecatl/agents. */
export async function deleteHarnessAgent(name: string): Promise<void> {
  const response = await fetch(
    `${AGENTS_API}?name=${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(await readError(response));
}

/** Reads the daemon's RESOLVED agent inventory (what it can delegate to now). */
export async function listHarnessAgents(
  signal?: AbortSignal,
): Promise<{ name: string; description: string }[]> {
  const response = await fetch(`${HARNESS_API}/agents`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    agents?: { name?: string; description?: string }[];
  };
  return (body.agents ?? []).map((agent) => ({
    name: agent.name ?? "",
    description: agent.description ?? "",
  }));
}

/**
 * Begins the gateway's OAuth flow and returns the URL to send the user to.
 *
 * The controller performs discovery and dynamic client registration, then waits
 * for the provider to redirect back to its own loopback callback, where it
 * exchanges the code, stores the token and reconnects the daemon.
 */
export async function startHarnessGatewayOAuth(): Promise<string> {
  const query = new URLSearchParams({
    name: MCP_GATEWAY_NAME,
    url: MCP_GATEWAY_URL,
  });
  const response = await fetch(`${CONTROL_API}/mcp/oauth/start?${query}`);
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { authorizationUrl?: string };
  if (!body.authorizationUrl) {
    throw new Error("gateway returned no authorization URL");
  }
  return body.authorizationUrl;
}

/**
 * Waits for the controller to report a connected gateway.
 *
 * Polling rather than listening for the callback page's postMessage: that
 * message is addressed to a hardcoded origin (Studio's own port), so it never
 * arrives here. The controller's status is the shared source of truth either way.
 */
export async function waitForHarnessGateway(
  isCancelled: () => boolean,
  timeoutMs = 180_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isCancelled()) return false;
    const status = await fetchHarnessControlStatus();
    if (status?.gateway) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  return false;
}

/** Saves the AI provider credential. RESTARTS the daemon. */
export async function saveHarnessProviderKey(apiKey: string): Promise<void> {
  const response = await fetch(`${CONTROL_API}/openrouter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

/** Cancels the in-flight run for a session. */
export async function cancelHarnessRun(sessionId: string): Promise<void> {
  await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/cancel`,
    { method: "POST" },
  ).catch(() => undefined);
}
