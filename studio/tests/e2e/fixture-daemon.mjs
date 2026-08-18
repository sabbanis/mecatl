/**
 * A fixture mecated for e2e: a tiny HTTP server speaking just enough of the
 * daemon's wire (stdlib-JSON responses, SSE prompt relay) for Studio's
 * surfaces to render real content through the real proxy tier. This is a test
 * double behind the API seam — not a UI-level demo fallback, which Studio
 * forbids.
 */
import http from "node:http";

const port = Number(process.env.FIXTURE_DAEMON_PORT || 8099);

const session = {
  session_id: "session-fixture-1",
  title: "Fix the flaky scheduler test",
  state: "idle",
  turns: 2,
  model_id: "fixture-model",
  workspace: "/workspace/fixture",
  created_at_unix: 1_755_000_000,
  modified_at_unix: 1_755_003_600,
  capabilities: {
    rename: true,
    delete: true,
    view_transcript: true,
    reasons: {},
  },
};

const routes = {
  "GET /v1/models": {
    models: [{ id: "fixture-model", provider_id: "fixture" }],
  },
  "GET /v1/sessions": { sessions: [session], next_cursor: "" },
  "GET /v1/sessions/session-fixture-1/transcript": {
    session_id: "session-fixture-1",
    complete: true,
    messages: [
      { role: "user", text: "Why does the scheduler test flake?" },
      {
        role: "assistant",
        text: "The fixture transcript renders: the test races the claim sentinel.",
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
  "GET /v1/commands": { commands: [] },
};

http
  .createServer((request, response) => {
    const path = new URL(request.url, "http://fixture").pathname;
    const key = `${request.method} ${path}`;
    if (key === "POST /v1/sessions/session-fixture-1/prompt") {
      response.writeHead(200, { "Content-Type": "text/event-stream" });
      const frames = [
        { type: "message.delta", text: "Streaming " },
        { type: "message.delta", text: "from the fixture." },
        {
          type: "result",
          result: {
            stop: "end_turn",
            text: "Streaming from the fixture.",
            usage: { input_tokens: 10, output_tokens: 5 },
          },
        },
      ];
      for (const frame of frames)
        response.write(`data: ${JSON.stringify(frame)}\n\n`);
      response.end();
      return;
    }
    const body = routes[key];
    response.writeHead(body ? 200 : 404, {
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify(body ?? { error: `fixture has no ${key}` }));
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`fixture daemon on 127.0.0.1:${port}`);
  });
