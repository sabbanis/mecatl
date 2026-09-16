/**
 * A fixture mecated for e2e: a tiny HTTP server speaking just enough of the
 * daemon's wire (stdlib-JSON responses, SSE prompt relay) for Studio's
 * surfaces to render real content through the real proxy tier. This is a test
 * double behind the API seam — not a UI-level demo fallback, which Studio
 * forbids.
 *
 * Studio drives every request through the TypeScript SDK
 * (`@stacklok-oss/mecatl-sdk`), so the fixture speaks the routes the SDK's
 * rpc-catalog resolves (sdk/typescript/src/rpc-catalog.ts): the SDK first
 * GETs /v1/compatibility and gates features on it, the prompt SSE frames are
 * proto-JSON events carrying `run_id` and ending with a `result`, and the
 * durable watch is an SSE of `{event, cursor, phase}` envelopes. Shapes are
 * the minimum the SDK accepts (sdk/typescript/test/scripted-state.ts); the
 * fixture is deliberately permissive — it rejects unknown fields nowhere.
 */
import http from "node:http";

const port = Number(process.env.FIXTURE_DAEMON_PORT || 8099);

const sessionID = "session-fixture-1";
const runID = "run-fixture-1";
// The MCP browser-authorization phase: a prompt whose text asks for
// "authorization" parks its tool call on this authorization and the stream
// ENDS without a result (the daemon's parked shape); the recheck/cancel
// controls stream the resolution plus the continuation run.
const authorizationID = "auth-fixture-1";
const continuationRunID = "run-fixture-2";
const placement = {
  kind: "local",
  label: "fixture",
  branch: "main",
  revision: "fixture",
};

const session = {
  session_id: sessionID,
  title: "Fix the flaky scheduler test",
  state: "idle",
  mode: "default",
  turns: 2,
  model_id: "fixture-model",
  placement,
  created_at_unix: 1_755_000_000,
  modified_at_unix: 1_755_003_600,
  capabilities: {
    rename: true,
    delete: true,
    view_transcript: true,
    reasons: {},
  },
};

// The deployment capabilities Studio's surfaces gate on (proto
// ServerCapabilities, snake_case on the wire): every inventory the fixture
// serves is advertised, so the pages render rather than hide themselves.
const capabilities = {
  mcp: true,
  slash_commands: true,
  memory: true,
  skills: true,
  teams: true,
  bash: true,
  image: false,
  audio: false,
  agents: true,
  soul: true,
  user_model: true,
  model_selection: true,
  posture: "trusted",
  worktrees: true,
  scheduling: true,
  storage_health: true,
  steer: true,
  manual_compaction: true,
};

const snapshot = {
  session_id: sessionID,
  mode: "default",
  state: "idle",
  placement,
  // The proto field is `model_id` (SessionResolvedModel), and the context
  // meter needs the window to draw its bar.
  resolved_model: {
    model_id: "fixture-model",
    provider_id: "fixture",
    context_window: 128000,
  },
  // The durable session-cumulative usage (engine/session/usage.go "main").
  token_usage: {
    main: { total: { input_tokens: 120, output_tokens: 40 }, models: {} },
  },
  capabilities,
};

const routes = {
  "GET /v1/compatibility": {
    api_major: 1,
    features: ["http_steer", "watch_session_events", "server_info"],
    capabilities,
  },
  "GET /v1/info": {
    build_id: "fixture",
    server_implementation: "fixture-daemon",
  },
  "GET /v1/storage/health": { status: "ok", store: "fixture" },
  "GET /v1/models": {
    models: [{ id: "fixture-model", provider_id: "fixture" }],
  },
  "GET /v1/sessions": { sessions: [session], next_cursor: "" },
  [`GET /v1/sessions/${sessionID}`]: snapshot,
  [`GET /v1/sessions/${sessionID}/transcript`]: {
    session_id: sessionID,
    complete: true,
    messages: [
      { role: "user", text: "Why does the scheduler test flake?" },
      {
        role: "assistant",
        text: "The fixture transcript renders: the test races the claim sentinel.",
      },
      // A scheduled task's delivery note exactly as the daemon records it
      // (fenced, with the provenance header): Studio renders it as a card.
      {
        role: "user",
        text: "<<<UNTRUSTED\n[scheduled task nightly-fixture-digest (fire fire-1) completed with stop reason: end_turn]\nDigest: 3 PRs merged, 0 failures.\n<<<UNTRUSTED\n",
      },
    ],
  },
  "GET /v1/schedules": {
    schedules: [
      {
        spec: {
          name: "nightly-fixture-digest",
          prompt: "Summarise the day",
          trigger: { cron: "0 9 * * *" },
          timezone: "UTC",
          mode: 2,
          mutating: false,
        },
        state: { enabled: true, fire_count: 3 },
      },
    ],
  },
  "GET /v1/schedules/nightly-fixture-digest/fires": {
    fires: [
      {
        id: "fire-1",
        schedule_name: "nightly-fixture-digest",
        session_id: "sched--nightly-fixture-digest-1",
        fired_at: { seconds: 1_755_000_000 },
        stop: "end_turn",
      },
    ],
  },
  "GET /v1/skills": {
    skills: [
      {
        name: "code-review-fixture",
        description: "Review a diff for correctness.",
      },
    ],
  },
  "GET /v1/usermodel": {
    entries: [
      {
        key: "prefers-tabs",
        description: "The operator prefers tabs over spaces.",
      },
    ],
    size_bytes: 64,
    sha256: "f".repeat(64),
  },
  "GET /v1/agents": {
    agents: [{ name: "reviewer", description: "Reviews changes." }],
  },
  // Slash-command discovery is keyed by `?session_id=` (placement is
  // server-owned, ADR 0291); the query is accepted and ignored here.
  "GET /v1/commands": { commands: [] },
  "GET /v1/worktrees": { worktrees: [] },
  "POST /v1/sessions": { session_id: sessionID, placement },
  [`POST /v1/sessions/${sessionID}/fork`]: {
    session_id: "session-fixture-fork",
    placement,
  },
  [`POST /v1/sessions/${sessionID}/approve`]: {},
  [`POST /v1/sessions/${sessionID}/cancel`]: {},
  [`POST /v1/sessions/${sessionID}/steer`]: {
    outcome: "accepted",
    message_id: "steer-fixture-1",
  },
  [`POST /v1/sessions/${sessionID}/cancel-steer`]: { outcome: "retracted" },
  [`POST /v1/sessions/${sessionID}/rename`]: {},
  [`POST /v1/sessions/${sessionID}/delete`]: {},
  [`DELETE /v1/sessions/${sessionID}`]: {},
  // Every route the advertised capabilities make reachable from the UI must
  // answer, or a flow under test dies on a 404 problem instead of its logic:
  // manual compaction, the mode picker, and the six mutating schedule actions.
  [`POST /v1/sessions/${sessionID}/compact`]: { compacted: false },
  // The live sign-in URL of the parked MCP authorization (fetched when the
  // operator opens or copies it — it never rides an event).
  [`GET /v1/sessions/${sessionID}/mcp-authorizations/${authorizationID}/presentation`]:
    { url: "https://example.test/authorize?state=fixture" },
  [`POST /v1/sessions/${sessionID}/mode`]: snapshot,
  "POST /v1/schedules": {},
  "PUT /v1/schedules/nightly-fixture-digest": {},
  "POST /v1/schedules/nightly-fixture-digest/pause": {},
  "POST /v1/schedules/nightly-fixture-digest/resume": {},
  "POST /v1/schedules/nightly-fixture-digest/fire": {},
  "DELETE /v1/schedules/nightly-fixture-digest": {},
};

// The prompt relay: proto-JSON events, every frame stamped with the run id
// the SDK binds the Run to, ending on the terminal `result` frame.
const promptFrames = [
  { type: "turn.start", run_id: runID, seq: "1", turn: 1 },
  {
    type: "message.delta",
    run_id: runID,
    seq: "2",
    turn: 1,
    text: "Streaming ",
  },
  {
    type: "message.delta",
    run_id: runID,
    seq: "3",
    turn: 1,
    text: "from the fixture.",
  },
  // The per-turn stat frame (tokens + elapsed model-call time).
  {
    type: "turn.end",
    run_id: runID,
    seq: "4",
    turn: 1,
    turn_end: {
      duration_ms: "4100",
      usage: { input_tokens: 10, output_tokens: 5, cache_read_tokens: 4 },
    },
  },
  {
    type: "result",
    run_id: runID,
    seq: "5",
    turn: 1,
    text: "Streaming from the fixture.",
    result: {
      stop: "end_turn",
      text: "Streaming from the fixture.",
      usage: { input_tokens: 10, output_tokens: 5 },
    },
  },
];

// A prompt parked on a browser sign-in: the daemon emits authorization.required
// and closes the stream WITHOUT a result. Nothing here is a truncation.
const authorizationPromptFrames = [
  { type: "turn.start", run_id: runID, seq: "1", turn: 1 },
  {
    type: "message.delta",
    run_id: runID,
    seq: "2",
    turn: 1,
    text: "Signing in to Fixture MCP… ",
  },
  {
    type: "authorization.required",
    run_id: runID,
    seq: "3",
    turn: 1,
    authorization: {
      authorization_id: authorizationID,
      call_id: "call-fixture-1",
      status: "pending",
      display_name: "Fixture MCP",
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    },
  },
];

// The recheck/cancel control stream: the terminal status, then the
// continuation run through its result (the parked call resumes on granted;
// on cancelled it records the cancellation and the model carries on).
function authorizationControlFrames(status) {
  const text =
    status === "granted"
      ? "Authorized: continuing from the fixture."
      : "Sign-in cancelled: continuing without the tool.";
  return [
    {
      type: "authorization.resolved",
      run_id: continuationRunID,
      seq: "1",
      authorization: {
        authorization_id: authorizationID,
        call_id: "call-fixture-1",
        status,
        display_name: "Fixture MCP",
      },
    },
    { type: "message.delta", run_id: continuationRunID, seq: "2", text },
    {
      type: "result",
      run_id: continuationRunID,
      seq: "3",
      text,
      result: {
        stop: "end_turn",
        text,
        usage: { input_tokens: 4, output_tokens: 6 },
      },
    },
  ];
}

const promptAsksForAuthorization = (raw) => {
  try {
    return /authoriz/i.test(String(JSON.parse(raw).text ?? ""));
  } catch {
    return false;
  }
};

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function writeProblem(response, status, code, detail) {
  response.writeHead(status, { "Content-Type": "application/problem+json" });
  response.end(
    JSON.stringify({
      type: `https://mecatl.stacklok.com/problems/${code}`,
      title: detail,
      status,
      code,
      detail,
    }),
  );
}

function writeSSE(response, frame) {
  response.write(`data: ${JSON.stringify(frame)}\n\n`);
}

http
  .createServer((request, response) => {
    const path = new URL(request.url, "http://fixture").pathname;
    const key = `${request.method} ${path}`;
    // Retry re-drives the recorded failed step and streams exactly like a
    // prompt (ADR 0239), so both share the relay.
    if (
      key === `POST /v1/sessions/${sessionID}/prompt` ||
      key === `POST /v1/sessions/${sessionID}/retry`
    ) {
      void readBody(request).then((raw) => {
        const frames =
          key.endsWith("/prompt") && promptAsksForAuthorization(raw)
            ? authorizationPromptFrames
            : promptFrames;
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        for (const frame of frames) writeSSE(response, frame);
        response.end();
      });
      return;
    }
    const controlPrefix = `POST /v1/sessions/${sessionID}/mcp-authorizations/${authorizationID}/`;
    if (key === `${controlPrefix}recheck` || key === `${controlPrefix}cancel`) {
      // Correlation-only, like the daemon's controlRequestBodyEmpty: ONE body
      // byte is a 400, so a client that posts `{}` fails here as it would live.
      void readBody(request).then((raw) => {
        if (raw.length > 0) {
          writeProblem(
            response,
            400,
            "invalid_argument",
            "MCP authorization controls do not accept a request body",
          );
          return;
        }
        response.writeHead(200, { "Content-Type": "text/event-stream" });
        const status = key.endsWith("/cancel") ? "cancelled" : "granted";
        for (const frame of authorizationControlFrames(status)) {
          writeSSE(response, frame);
        }
        response.end();
      });
      return;
    }
    if (key === `GET /v1/sessions/${sessionID}/watch`) {
      // A durable watch never ends on its own: send the replay→live boundary
      // and hold the connection open until the client detaches.
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      writeSSE(response, { cursor: "c2RrY3VyLzEtZml4dHVyZQ", phase: "live" });
      const keepalive = setInterval(() => response.write(": ping\n\n"), 15_000);
      request.on("close", () => clearInterval(keepalive));
      return;
    }
    const body = routes[key];
    response.writeHead(body ? 200 : 404, {
      "Content-Type": body ? "application/json" : "application/problem+json",
    });
    response.end(
      JSON.stringify(
        body ?? {
          type: "https://mecatl.stacklok.com/problems/not_found",
          title: "Not found",
          status: 404,
          code: "not_found",
          detail: `fixture has no ${key}`,
        },
      ),
    );
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`fixture daemon on 127.0.0.1:${port}`);
  });
