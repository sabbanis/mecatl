/**
 * Browser-side client for the mecatl daemon, reached through the same-origin
 * /api/mecatl proxy (which injects auth and the workspace server-side).
 *
 * All wire decoding lives in the protocol seam (src/lib/protocol); this
 * module owns transport: fetch calls, SSE frame buffering, and the stream
 * robustness rules (idle timeout, terminal-result guard).
 */

import type { StreamEvent } from "@/features/agent/types";
import { validSkillName } from "@/lib/controller-security.mjs";
import {
  decodeScheduleFires,
  decodeScheduleRows,
  decodeSessionInventory,
  decodeSessionPermissionMode,
  decodeSessionTranscript,
  encodeScheduleSpec,
  encodeSessionPermissionMode,
  parseMecatlEvent,
  type ScheduleCarriedSpec,
  type ScheduleFireRow,
  type ScheduleRow,
  type ScheduleSpecDraft,
  type SessionInventoryPage,
  type SessionPermissionMode,
  type SessionSummary,
  type SessionTranscript,
  translateEvent,
} from "@/lib/protocol";

// The daemon API base: the proxy is transparent (no path rewriting), so the
// /v1 prefix belongs to the client's own URLs.
const HARNESS_API = "/api/mecatl/v1";

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
 *
 * The create body's `mode` runs through the daemon's same modeFromString as
 * POST /mode, so "accept_edits" is accepted at creation directly — no
 * create-then-setMode dance is needed for an accept-edits draft.
 */
export async function createHarnessSession(
  mode: "default" | "plan" | "accept_edits" = "default",
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

/**
 * The parent session was mid-run: the daemon refuses to fork history from a
 * running/awaiting source (HTTP 412). Thrown as its own type so the thread UI
 * can say "wait for the current response" instead of a generic failure.
 */
export class ThreadSourceBusyError extends Error {
  constructor(detail: string) {
    super(detail || "The source session is still running.");
    this.name = "ThreadSourceBusyError";
  }
}

/**
 * Creates the daemon session backing a message thread: a normal session whose
 * conversation is seeded from the parent's history (source_session_id
 * carryover), then renamed so the sidebar reads "Thread: …". The workspace is
 * proxy-injected, exactly like createHarnessSession. A running/awaiting
 * parent answers 412, surfaced as ThreadSourceBusyError.
 */
export async function createThreadHarnessSession(
  parentSessionId: string,
  title: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`${HARNESS_API}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "default",
      source_session_id: parentSessionId,
    }),
    signal,
  });
  if (response.status === 412) {
    throw new ThreadSourceBusyError(await readError(response));
  }
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { session_id?: string };
  if (!body.session_id) throw new Error("harness returned no session id");
  try {
    await renameHarnessSession(body.session_id, title);
  } catch {
    // The rename is cosmetic (the sidebar label). The thread session itself
    // is live and must not be lost to a failed rename.
  }
  return body.session_id;
}

/**
 * How long a live stream may go silent before Studio declares it dead. Two
 * minutes comfortably exceeds a slow tool call's quiet stretch while still
 * catching a daemon that went away without closing the socket.
 */
const STREAM_IDLE_TIMEOUT_MS = 120_000;

async function readWithIdleTimeout<T>(read: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error("Mecatl stopped sending updates for two minutes.")),
      STREAM_IDLE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([read, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Streams one prompt turn, invoking `onEvent` per translated event.
 *
 * The response is text/event-stream: frames are separated by a blank line and
 * the payload rides a `data:` line, so partial frames must be buffered across
 * reads rather than parsed per chunk.
 *
 * Two guards make a dead run fail loudly instead of hanging as "Done.":
 * each read races the idle timeout, and a stream that closes without a
 * terminal `result` frame throws — the daemon always ends a run with one.
 */
export interface PromptPart {
  kind: "image" | "audio";
  mime_type: string;
  /** Standard base64 (the daemon decodes JSON strings into bytes). */
  data: string;
}

export async function streamHarnessPrompt(
  sessionId: string,
  text: string,
  parts: PromptPart[],
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/prompt`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parts.length > 0 ? { text, parts } : { text }),
      signal,
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  if (!response.body) throw new Error("harness returned no event stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawResult = false;

  while (true) {
    const { value, done } = await readWithIdleTimeout(reader.read());
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
      let events: StreamEvent[];
      try {
        events = translateEvent(parseMecatlEvent(payload), sessionId);
      } catch {
        // A frame Studio cannot decode is surfaced, never silently dropped.
        onEvent({
          type: "notice",
          text: "Mecatl sent a frame this Studio version could not decode.",
        });
        continue;
      }
      for (const translated of events) {
        if (translated.type === "run_result") sawResult = true;
        onEvent(translated);
      }
    }
  }
  if (!sawResult) {
    throw new Error(
      "The connection closed before Mecatl returned a final result.",
    );
  }
}

export type HarnessApprovalVerdict = "allow_once" | "allow_always" | "deny";

/**
 * Resolves a parked permission ask with the daemon's three-way verdict:
 * allow_once, allow_always (persists a permission rule), or deny.
 */
export async function respondToHarnessApproval(
  sessionId: string,
  askId: string,
  verdict: HarnessApprovalVerdict,
): Promise<void> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ask_id: askId, verdict }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
}

// ── Session inventory / transcripts (daemon session store) ──────────────────

/** One page of `GET /v1/sessions`. */
async function fetchSessionInventoryPage(
  cursor?: string,
  pageSize = 100,
  signal?: AbortSignal,
): Promise<SessionInventoryPage> {
  const query = new URLSearchParams({ page_size: String(pageSize) });
  if (cursor) query.set("cursor", cursor);
  const response = await fetch(`${HARNESS_API}/sessions?${query}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  return decodeSessionInventory(await response.json());
}

/**
 * Walks the session inventory to completion, bounded so a pathological store
 * cannot loop the UI forever. Only a COMPLETE walk may be used to conclude a
 * session is gone — a partial page proves nothing about absent rows.
 */
export async function fetchAllSessions(
  signal?: AbortSignal,
  maxPages = 25,
): Promise<{ sessions: SessionSummary[]; complete: boolean }> {
  const sessions: SessionSummary[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchSessionInventoryPage(cursor, 100, signal);
    sessions.push(...result.sessions);
    if (!result.nextCursor) return { sessions, complete: true };
    cursor = result.nextCursor;
  }
  return { sessions, complete: false };
}

/**
 * Renames a session. Returns the daemon's clamped title echo, which the UI
 * adopts rather than assuming its input survived unmodified.
 */
export async function renameHarnessSession(
  sessionId: string,
  title: string,
): Promise<string> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/rename`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { title?: string };
  return body.title ?? title;
}

/**
 * Reads a session's current permission mode from its snapshot
 * (`GET /v1/sessions/{id}` echoes the aggregate's mode string).
 */
export async function fetchHarnessSessionMode(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SessionPermissionMode> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}`,
    { signal, cache: "no-store" },
  );
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { mode?: string };
  return decodeSessionPermissionMode(body.mode);
}

/**
 * Changes a session's permission mode (POST /v1/sessions/{id}/mode, protojson
 * snake_case body — modeled on renameHarnessSession). The response echoes the
 * updated session; the echoed mode is returned so the UI adopts the daemon's
 * word rather than assuming its input took. The daemon refuses a mid-turn
 * change (the aggregate rejects it while running/awaiting), which surfaces
 * here as a thrown error.
 */
export async function setHarnessSessionMode(
  sessionId: string,
  mode: SessionPermissionMode,
): Promise<SessionPermissionMode> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/mode`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: encodeSessionPermissionMode(mode) }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { mode?: string };
  return decodeSessionPermissionMode(body.mode);
}

/** Physically deletes a session's snapshot and sidecars. */
export async function deleteHarnessSession(sessionId: string): Promise<void> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/delete`,
    { method: "POST" },
  );
  if (!response.ok) throw new Error(await readError(response));
}

/**
 * Reads the authoritative message-level transcript
 * (`GET /v1/sessions/{id}/transcript`). This is the store's snapshot, so it
 * covers scheduler-tick fires whose conversation never reached the durable
 * event log, and it works identically in external mode.
 */
export async function fetchSessionTranscriptMessages(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SessionTranscript> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/transcript`,
    { signal, cache: "no-store" },
  );
  if (!response.ok) throw new Error(await readError(response));
  return decodeSessionTranscript(await response.json());
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
export interface HarnessUserModel {
  entries: { key: string; description: string }[];
  /** Aggregate byte length of the rendered entries. */
  sizeBytes: number;
  /** Lowercase-hex SHA-256 over the rendered entries — change detection. */
  sha256: string;
}

export async function fetchHarnessUserModel(
  signal?: AbortSignal,
): Promise<HarnessUserModel> {
  const response = await fetch(`${HARNESS_API}/usermodel`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    entries?: { key?: string; description?: string }[];
    size_bytes?: number | string;
    sha256?: string;
  };
  return {
    entries: (body.entries ?? []).map((entry) => ({
      key: entry.key ?? "",
      description: entry.description ?? "",
    })),
    sizeBytes: Number(body.size_bytes ?? 0) || 0,
    sha256: body.sha256 ?? "",
  };
}

// ── Schedules ───────────────────────────────────────────────────────────────

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

/**
 * Reads the schedule registry through the full protocol decoder: spec fields
 * (mode, mutating, workspace, timezone, limits), state, fire stage, and the
 * carried spec an edit must round-trip. Distinguishes "scheduler not wired"
 * (non-OK list — the daemon answers 501 without a schedule store) from a
 * genuinely empty registry.
 */
export async function listScheduleRows(
  signal?: AbortSignal,
): Promise<ScheduleRow[]> {
  const response = await fetch(`${HARNESS_API}/schedules`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  return decodeScheduleRows(await response.json());
}

/**
 * Creates (POST) or replaces (PUT) a schedule spec. Requests are protojson —
 * built by encodeScheduleSpec, never by echoing a decoded response — and an
 * update must pass the row's `carried` spec or the fields this UI cannot edit
 * would be silently deleted (PUT replaces the whole spec).
 */
export async function saveHarnessSchedule(
  draft: ScheduleSpecDraft,
  options: { update: boolean; carried?: ScheduleCarriedSpec },
): Promise<void> {
  const body = JSON.stringify(encodeScheduleSpec(draft, options.carried));
  const response = await fetch(
    options.update
      ? `${HARNESS_API}/schedules/${encodeURIComponent(draft.name)}`
      : `${HARNESS_API}/schedules`,
    {
      method: options.update ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body,
    },
  );
  if (!response.ok) throw new Error(await readError(response));
}

/** Reads a schedule's fire history, newest first. */
export async function listScheduleFires(
  name: string,
  signal?: AbortSignal,
): Promise<ScheduleFireRow[]> {
  const response = await fetch(
    `${HARNESS_API}/schedules/${encodeURIComponent(name)}/fires`,
    { signal, cache: "no-store" },
  );
  if (!response.ok) throw new Error(await readError(response));
  return decodeScheduleFires(await response.json());
}

// ── Slash commands ───────────────────────────────────────────────────────────

/**
 * Reads the workspace's discovered slash commands. The workspace query is
 * injected by the proxy — the browser deliberately never knows the path.
 */
export async function listHarnessCommands(
  signal?: AbortSignal,
): Promise<{ name: string; description: string }[]> {
  const response = await fetch(`${HARNESS_API}/commands`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    commands?: { name?: string; description?: string }[];
  };
  return (body.commands ?? []).map((command) => ({
    name: command.name ?? "",
    description: command.description ?? "",
  }));
}

// ── Skills ──────────────────────────────────────────────────────────────────

/**
 * Reads the skill inventory the daemon resolved at startup from its --skills-dir.
 * The model sees only each skill's name and one-line summary until it chooses to
 * load one, which is exactly what this returns.
 */
export interface HarnessSkillInfo {
  name: string;
  description: string;
  /** Learned-lifecycle provenance; absent for immutable external skills. */
  agentOwned: boolean;
  ownerAgent: string;
  activeVersion: string;
}

export async function listHarnessSkills(
  signal?: AbortSignal,
): Promise<HarnessSkillInfo[]> {
  const response = await fetch(`${HARNESS_API}/skills`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    skills?: {
      name?: string;
      description?: string;
      agent_owned?: boolean;
      owner_agent?: string;
      active_version?: string;
    }[];
  };
  return (body.skills ?? []).map((skill) => ({
    name: skill.name ?? "",
    description: skill.description ?? "",
    agentOwned: skill.agent_owned === true,
    ownerAgent: skill.owner_agent ?? "",
    activeVersion: skill.active_version ?? "",
  }));
}

/** Reads the selectable provider/model inventory. Carries no secret material. */
export async function listHarnessModels(signal?: AbortSignal): Promise<
  {
    id: string;
    providerId: string;
    displayName: string;
    contextLimit: number;
    image: boolean;
    reasoning: boolean;
  }[]
> {
  const response = await fetch(`${HARNESS_API}/models`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    models?: {
      id?: string;
      provider_id?: string;
      display_name?: string;
      context_limit?: number;
      image?: boolean;
      reasoning?: boolean;
    }[];
  };
  return (body.models ?? []).map((model) => ({
    id: model.id ?? "",
    providerId: model.provider_id ?? "",
    displayName: model.display_name ?? model.id ?? "",
    contextLimit: Number(model.context_limit ?? 0),
    image: model.image === true,
    reasoning: model.reasoning === true,
  }));
}

// ── Controller: provider, model router, MCP gateway ─────────────────────────

const CONTROL_API = "/api/mecatl-control";

export interface HarnessControlStatus {
  /** "external" when Studio proxies to MECATL_BASE_URL; "managed" otherwise. */
  mode: "managed" | "external";
  provider: string;
  running: boolean;
  gateway: { name: string; url: string } | null;
  modelRouter: { enabled: boolean; categories: number } | null;
  operatorSettings: boolean;
  skillsDir: string;
  memoryDir: string;
  /**
   * Provider NAMES found in the operator's auth.yaml — never credentials.
   * Managed mode can now add/remove blocks THROUGH the controller (which
   * owns the file server-side); no key value ever crosses this boundary.
   */
  configuredProviders: string[];
  /** Which of those MECATL_STUDIO_PROVIDER currently selects, if set. */
  selectedProvider: string | null;
  /** The auth.yaml path on the controller's machine (guided-add copy). */
  authFile: string;
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
      mode?: string;
      provider?: string;
      running?: boolean;
      gateway?: { name?: string; url?: string } | null;
      modelRouter?: { enabled?: boolean; categories?: number } | null;
      operatorSettings?: boolean;
      skills?: { dir?: string };
      memory?: { dir?: string };
      configuredProviders?: unknown;
      selectedProvider?: string | null;
      authFile?: string;
    };
    return {
      mode: body.mode === "external" ? "external" : "managed",
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
      configuredProviders: Array.isArray(body.configuredProviders)
        ? body.configuredProviders.filter(
            (name): name is string => typeof name === "string",
          )
        : [],
      selectedProvider: body.selectedProvider ?? null,
      authFile: body.authFile ?? "",
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
export async function connectHarnessGateway(
  name: string,
  url: string,
  token?: string,
): Promise<void> {
  const response = await fetch(`${CONTROL_API}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      url,
      token: token?.trim() || undefined,
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

// ── Controller: provider management ─────────────────────────────────────────
// auth.yaml stays server-side property of the controller: these calls move
// NAMES and booleans, never key material. There is deliberately no
// "add provider with key" call — adding one is a guided copy-into-auth.yaml
// (see the Add-provider dialog), so a credential never transits the browser.

/** One provider block found in the controller's auth.yaml — names and
 *  booleans only, never values (Studio rule 3). */
export interface HarnessProviderInfo {
  name: string;
  configured: boolean;
  /** A non-empty api_key / oauth access_token exists in the block. */
  keyPresent: boolean;
  source: string;
  /** The controller can key-test this kind with one cheap keyed call. */
  testable: boolean;
}

export async function listHarnessProviders(
  signal?: AbortSignal,
): Promise<HarnessProviderInfo[]> {
  const response = await fetch(`${CONTROL_API}/providers`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    providers?: {
      name?: string;
      configured?: boolean;
      keyPresent?: boolean;
      source?: string;
      testable?: boolean;
    }[];
  };
  return (body.providers ?? [])
    .filter((row) => typeof row.name === "string" && row.name !== "")
    .map((row) => ({
      name: row.name ?? "",
      configured: row.configured !== false,
      keyPresent: row.keyPresent === true,
      source: row.source ?? "auth.yaml",
      testable: row.testable === true,
    }));
}

/** One provider kind the daemon understands, with the guided-add snippet
 *  (a `<YOUR_KEY>` placeholder — never a real value). */
export interface KnownHarnessProvider {
  name: string;
  label: string;
  testable: boolean;
  snippet: string;
  note: string;
}

export async function listKnownHarnessProviders(
  signal?: AbortSignal,
): Promise<KnownHarnessProvider[]> {
  const response = await fetch(`${CONTROL_API}/providers/known`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    known?: {
      name?: string;
      label?: string;
      testable?: boolean;
      snippet?: string;
      note?: string;
    }[];
  };
  return (body.known ?? [])
    .filter((row) => typeof row.name === "string" && row.name !== "")
    .map((row) => ({
      name: row.name ?? "",
      label: row.label ?? row.name ?? "",
      testable: row.testable === true,
      snippet: row.snippet ?? "",
      note: row.note ?? "",
    }));
}

/** The controller's verdict on a stored key after ONE bounded probe. */
export interface HarnessProviderKeyTest {
  ok: boolean;
  /** HTTP status from the provider (0 = unreachable/timeout). */
  status: number;
  /** True when the provider answered 401/403 — the KEY is bad, not the wire. */
  rejected: boolean;
  error: string;
}

/**
 * Asks the controller to test a provider's STORED key with one cheap
 * authenticated call. The key itself never reaches the browser — only the
 * verdict does. Throws when the test could not run at all (unknown provider,
 * no key in auth.yaml, external mode's 409).
 */
export async function testHarnessProviderKey(
  name: string,
): Promise<HarnessProviderKeyTest> {
  const response = await fetch(
    `${CONTROL_API}/providers/${encodeURIComponent(name)}/test`,
    { method: "POST" },
  );
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    ok?: boolean;
    status?: number;
    rejected?: boolean;
    error?: string;
  };
  return {
    ok: body.ok === true,
    status: Number(body.status ?? 0),
    rejected: body.rejected === true,
    error: body.error ?? "",
  };
}

/** Removes a provider's block from auth.yaml. RESTARTS the daemon. */
export async function removeHarnessProvider(name: string): Promise<void> {
  const response = await fetch(
    `${CONTROL_API}/providers/${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(await readError(response));
}

/** Restarts the daemon with its current config — how a provider block just
 *  added to auth.yaml (guided add) becomes visible to mecated. */
export async function restartHarnessDaemon(): Promise<void> {
  const response = await fetch(`${CONTROL_API}/restart`, { method: "POST" });
  if (!response.ok) throw new Error(await readError(response));
}

// ── Controller: workspace skills management ─────────────────────────────────
// The daemon has no skill write API (its skills snapshot is resolved once at
// startup), so skill CRUD goes to the managed-mode controller, which owns the
// pinned --skills-dir and restarts mecated when a change touches what the
// daemon can see. External mode has no controller: every one of these answers
// 409 there, and the UI renders the controls disabled instead of calling them.

/** A skill parked in the controller's `.disabled/` holding area. */
export interface DisabledSkillInfo {
  name: string;
  description: string;
}

/** Client-side mirror of the controller's name gate, so a bad name fails with
 *  this message rather than as a mystery 400. */
function requireSkillName(name: string): string {
  if (!validSkillName(name)) {
    throw new Error(
      "Skill names use lowercase letters, digits, hyphens, and underscores (max 64 characters)",
    );
  }
  return encodeURIComponent(name);
}

/** Skills the controller has disabled (moved out of the daemon's sight). */
export async function listDisabledHarnessSkills(
  signal?: AbortSignal,
): Promise<DisabledSkillInfo[]> {
  const response = await fetch(`${CONTROL_API}/skills/disabled`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    disabled?: { name?: string; description?: string }[];
  };
  return (body.disabled ?? [])
    .filter((skill) => typeof skill.name === "string" && skill.name !== "")
    .map((skill) => ({
      name: skill.name ?? "",
      description: skill.description ?? "",
    }));
}

/** Creates a new skill folder with its SKILL.md, enabled. RESTARTS the daemon
 *  — a new skill is invisible until the startup snapshot is rebuilt. */
export async function createHarnessSkill(
  name: string,
  body: string,
): Promise<void> {
  requireSkillName(name);
  const response = await fetch(`${CONTROL_API}/skills`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, body }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

/** Reads a skill's SKILL.md from the controller (either side of disabled). */
export async function fetchHarnessSkillBody(
  name: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(
    `${CONTROL_API}/skills/${requireSkillName(name)}/body`,
    { signal, cache: "no-store" },
  );
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { body?: string };
  return body.body ?? "";
}

/** Writes a skill's SKILL.md. RESTARTS the daemon when the skill is enabled. */
export async function saveHarnessSkillBody(
  name: string,
  body: string,
): Promise<void> {
  const response = await fetch(
    `${CONTROL_API}/skills/${requireSkillName(name)}/body`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
}

/** Moves a skill in or out of the disabled holding area. RESTARTS the daemon. */
export async function setHarnessSkillEnabled(
  name: string,
  enabled: boolean,
): Promise<void> {
  const response = await fetch(
    `${CONTROL_API}/skills/${requireSkillName(name)}/${enabled ? "enable" : "disable"}`,
    { method: "POST" },
  );
  if (!response.ok) throw new Error(await readError(response));
}

/** Deletes a skill's directory from the workspace. RESTARTS the daemon. */
export async function deleteHarnessSkill(name: string): Promise<void> {
  const response = await fetch(
    `${CONTROL_API}/skills/${requireSkillName(name)}`,
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
export async function startHarnessGatewayOAuth(
  name: string,
  url: string,
): Promise<string> {
  const query = new URLSearchParams({ name, url });
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

/** Cancels the in-flight run for a session. */
export async function cancelHarnessRun(sessionId: string): Promise<void> {
  await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/cancel`,
    { method: "POST" },
  ).catch(() => undefined);
}

/** The daemon's verdict on a steer request. `accepted`/`appended` mean the
 *  text will be injected into the in-flight run at the next turn boundary;
 *  `too_late` means the run is past injection and the caller keeps the text
 *  (send it as a normal prompt instead). */
export type HarnessSteerOutcome = "accepted" | "appended" | "too_late";

/**
 * Injects a message into a session's in-flight run. `messageId` is the
 * client-minted correlation id: the stream's later `steer` echo names the id
 * of the LAST message merged into the drained bundle, and the client splits
 * its ordered pending list on that watermark.
 */
export async function steerHarnessRun(
  sessionId: string,
  text: string,
  messageId: string,
): Promise<{ outcome: HarnessSteerOutcome; messageId: string }> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/steer`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, message_id: messageId }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as {
    outcome?: string;
    message_id?: string;
  };
  // Anything other than an explicit accept resolves as too_late: the caller
  // keeps the text and sends it as a normal prompt — never loses it.
  const outcome: HarnessSteerOutcome =
    body.outcome === "accepted" || body.outcome === "appended"
      ? body.outcome
      : "too_late";
  return { outcome, messageId: body.message_id ?? messageId };
}

/**
 * Retracts the whole pending steer bundle (the daemon models one bundle per
 * run, not per-message retraction). `none_pending` means nothing was waiting
 * — the bundle already drained into the run or none was ever sent.
 */
export async function cancelHarnessSteer(
  sessionId: string,
): Promise<"retracted" | "none_pending"> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/steer-cancel`,
    { method: "POST" },
  );
  if (!response.ok) throw new Error(await readError(response));
  const body = (await response.json()) as { outcome?: string };
  return body.outcome === "retracted" ? "retracted" : "none_pending";
}
