import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

import { requestIsAllowed, validateGatewayURL } from "../lib/controller-security.mjs";
import { decodeScheduleRows, parseMecatlEvent } from "../lib/protocol.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = resolve(root, "node_modules/.bin/next");
const upstreamRequests = [];
let upstream;
let studio;
let studioBaseURL;

async function listen(server) {
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  return server.address().port;
}

async function freePort() {
  const probe = http.createServer();
  const port = await listen(probe);
  await new Promise((resolveClose) => probe.close(resolveClose));
  return port;
}

async function waitForServer(url, process) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (process.exitCode !== null) throw new Error(`Next exited during test startup (${process.exitCode})`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* still starting */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("Next did not become ready for tests");
}

before(async () => {
  upstream = http.createServer((request, response) => {
    upstreamRequests.push({ url: request.url, authorization: request.headers.authorization });
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ models: [{ id: "test-model", provider_id: "test" }] }));
  });
  const upstreamPort = await listen(upstream);
  const studioPort = await freePort();
  studioBaseURL = `http://127.0.0.1:${studioPort}`;
  studio = spawn(nextBin, ["start", "-p", String(studioPort)], {
    cwd: root,
    env: {
      ...process.env,
      MECATL_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
      MECATL_AUTH_TOKEN: "test-secret",
      MECATL_WORKSPACE: "/workspace/from-deployment",
      MECATL_STUDIO_PUBLIC_ORIGIN: studioBaseURL,
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  await waitForServer(studioBaseURL, studio);
});

after(async () => {
  studio?.kill("SIGTERM");
  await new Promise((resolveClose) => upstream.close(resolveClose));
});

test("server-renders Mecatl Studio", async () => {
  const response = await fetch(studioBaseURL);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Mecatl Studio<\/title>/i);
  assert.match(html, /A focused local workspace for building with the mecatl agent harness/);
});

test("external mode injects daemon auth server-side and disables local controls", async () => {
  const models = await fetch(`${studioBaseURL}/api/mecatl/v1/models`);
  assert.equal(models.status, 200);
  assert.deepEqual(await models.json(), { models: [{ id: "test-model", provider_id: "test" }] });
  assert.deepEqual(upstreamRequests.at(-1), {
    url: "/v1/models",
    authorization: "Bearer test-secret",
  });

  const status = await fetch(`${studioBaseURL}/api/mecatl-control/status`).then((response) => response.json());
  assert.equal(status.mode, "external");
  assert.equal(status.workspace, "/workspace/from-deployment");

  const mutation = await fetch(`${studioBaseURL}/api/mecatl-control/model-router`, { method: "POST" });
  assert.equal(mutation.status, 409);
  assert.match((await mutation.json()).error, /external mecated deployment/);

  const csrf = await fetch(`${studioBaseURL}/api/mecatl/v1/sessions`, {
    method: "POST",
    headers: { origin: "https://evil.example", "content-type": "text/plain" },
    body: "{}",
  });
  assert.equal(csrf.status, 403);
});

test("controller policy rejects CSRF and DNS-rebinding requests", () => {
  const policy = {
    allowedOrigins: new Set(["http://localhost:3000"]),
    mcpProxyPrefix: "/mcp-proxy/unguessable/",
  };
  const url = new URL("http://127.0.0.1:8788/mcp");
  assert.equal(requestIsAllowed({ method: "POST", headers: { host: "127.0.0.1:8788" } }, url, policy), false);
  assert.equal(requestIsAllowed({ method: "POST", headers: { host: "127.0.0.1:8788", origin: "https://evil.example" } }, url, policy), false);
  assert.equal(requestIsAllowed({ method: "POST", headers: { host: "attacker.example", "x-mecatl-studio-request": "1" } }, url, policy), false);
  assert.equal(requestIsAllowed({ method: "POST", headers: { host: "127.0.0.1:8788", origin: "http://localhost:3000", "x-mecatl-studio-request": "1" } }, url, policy), true);
});

test("gateway egress requires HTTPS or an operator-enabled loopback exception", () => {
  assert.equal(validateGatewayURL("https://gateway.example/mcp").protocol, "https:");
  assert.throws(() => validateGatewayURL("http://169.254.169.254/latest/meta-data"), /must use HTTPS/);
  assert.throws(() => validateGatewayURL("http://127.0.0.1:9000/mcp"), /must use HTTPS/);
  assert.equal(validateGatewayURL("http://127.0.0.1:9000/mcp", { allowLoopbackHTTP: true }).hostname, "127.0.0.1");
  assert.throws(() => validateGatewayURL("https://user:secret@gateway.example/mcp"), /must not contain credentials/);
});

test("wire decoders preserve terminal failures, schedules, and unknown event kinds", () => {
  const failure = parseMecatlEvent(JSON.stringify({ type: "result", result: { stop: "error", error: "provider unavailable" } }));
  assert.equal(failure.result?.stop, "error");
  assert.equal(failure.result?.error, "provider unavailable");

  const route = parseMecatlEvent(JSON.stringify({ type: "provider.route", text: "openrouter → anthropic" }));
  assert.equal(route.type, "provider.route");
  assert.equal(route.text, "openrouter → anthropic");
  assert.throws(() => parseMecatlEvent(JSON.stringify({ result: {} })), /event\.type is required/);

  const rows = decodeScheduleRows({ schedules: [{
    spec: { name: "weekly", prompt: "Review", trigger: { cron: "0 9 * * 1" }, mode: 2, mutating: false },
    state: { enabled: true, fire_count: 3, next_fire_at: { seconds: "60", nanos: 500_000_000 }, last_fire_session_id: "pending" },
  }] });
  assert.equal(rows[0].nextFireAt, 60_500);
  assert.equal(rows[0].fireStage, "claimed");
  assert.equal(rows[0].mode, 2);
});
