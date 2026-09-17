import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { dirname, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  requestIsAllowed,
  validateGatewayURL,
} from "../src/lib/controller-security.mjs";

// Hermetic server-tier suite: a real `next start` of the production build in
// EXTERNAL mode, against a fake in-process daemon that records every request.
// This is the only layer that proves the proxy tier's behavior (bearer
// injection, CSRF 403, external-mode 409, verbatim body forwarding, offline
// 503) end to end. Wire decoding is the TypeScript SDK's (`@stacklok-oss/mecatl-sdk`)
// responsibility and is tested there. Requires `npm run build` first (npm test does that).

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = resolve(root, "node_modules/.bin/next");
const upstreamRequests = [];
let upstream;
let studio;
let studioBaseURL;
let offlineStudio;
let offlineBaseURL;

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

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error(`Next exited during test startup (${child.exitCode})`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* still starting */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("Next did not become ready for tests");
}

function startStudio(port, baseURL, mecatlBaseURL) {
  return spawn(nextBin, ["start", "-p", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      MECATL_BASE_URL: mecatlBaseURL,
      MECATL_AUTH_TOKEN: "test-secret",
      MECATL_WORKSPACE: "/workspace/from-deployment",
      MECATL_STUDIO_PUBLIC_ORIGIN: baseURL,
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
}

before(async () => {
  upstream = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      upstreamRequests.push({
        url: request.url,
        authorization: request.headers.authorization,
        body: Buffer.concat(chunks).toString() || null,
      });
      response.setHeader("Content-Type", "application/json");
      // The proxy forwards Content-Disposition (the controller's daemon-log
      // download names its file with it); the fake sets one everywhere so
      // the external-mode test can pin that it survives the hop.
      response.setHeader(
        "Content-Disposition",
        'inline; filename="from-upstream.json"',
      );
      // A daemon that rejects Studio's bearer (a static-token or audience
      // mismatch): an RFC 9457 401 with the stable code.
      if (request.url === "/v1/sessions/rejected-credential") {
        response.statusCode = 401;
        response.setHeader("WWW-Authenticate", 'Bearer realm="mecatl"');
        response.end(
          JSON.stringify({
            type: "urn:mecatl:error:unauthenticated",
            code: "unauthenticated",
            error: "missing or invalid bearer token",
            status: 401,
          }),
        );
        return;
      }
      if (request.url === "/v1/sessions") {
        response.end(JSON.stringify({ session_id: "session-from-upstream" }));
        return;
      }
      response.end(
        JSON.stringify({ models: [{ id: "test-model", provider_id: "test" }] }),
      );
    });
  });
  const upstreamPort = await listen(upstream);

  const studioPort = await freePort();
  studioBaseURL = `http://127.0.0.1:${studioPort}`;
  studio = startStudio(
    studioPort,
    studioBaseURL,
    `http://127.0.0.1:${upstreamPort}`,
  );

  // A second instance whose daemon does not exist: the offline deployment.
  const offlinePort = await freePort();
  const deadPort = await freePort();
  offlineBaseURL = `http://127.0.0.1:${offlinePort}`;
  offlineStudio = startStudio(
    offlinePort,
    offlineBaseURL,
    `http://127.0.0.1:${deadPort}`,
  );

  await Promise.all([
    waitForServer(studioBaseURL, studio),
    waitForServer(offlineBaseURL, offlineStudio),
  ]);
});

after(async () => {
  studio?.kill("SIGTERM");
  offlineStudio?.kill("SIGTERM");
  await new Promise((resolveClose) => upstream.close(resolveClose));
});

test("server-renders Mecatl Studio", async () => {
  const response = await fetch(`${studioBaseURL}/workspace/chat`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Mecatl Studio/);
  // The palette boot script (src/components/palette-boot-script.tsx) ships
  // inline in <head>: the stored-or-default palette lands on <html> before
  // first paint, so the marker must be in the server HTML, not only in a
  // client bundle.
  assert.match(html, /data-palette/);
  assert.match(html, /mecatl-studio\.palette/);
});

test("the About card server-renders Studio's own build stamp", async () => {
  const response = await fetch(`${studioBaseURL}/workspace/settings/provider`);
  assert.equal(response.status, 200);
  const html = await response.text();
  // The stamp is inlined at `next build` (next.config.ts `env`, read via
  // src/lib/studio-build.ts), so the server-rendered card already names it
  // — before any daemon call, and whatever the daemon answers. The value
  // is whatever THIS build computed (MECATL_STUDIO_BUILD, else
  // version+sha, else version+dev); the assertion is that a real, non-empty
  // stamp is there, never the sanitizer's "unavailable".
  const match = /data-testid="about-studio-build"[^>]*>([^<]+)</.exec(html);
  assert.ok(match, "the About card's Studio row is server-rendered");
  const stamp = match[1].trim();
  assert.notEqual(stamp, "");
  assert.notEqual(stamp, "unavailable");
  assert.match(stamp, /^[A-Za-z0-9._/+-]+$/);
});

test("external mode injects daemon auth server-side and disables local controls", async () => {
  const models = await fetch(`${studioBaseURL}/api/mecatl/v1/models`);
  assert.equal(models.status, 200);
  assert.equal(
    models.headers.get("content-disposition"),
    'inline; filename="from-upstream.json"',
  );
  assert.deepEqual(await models.json(), {
    models: [{ id: "test-model", provider_id: "test" }],
  });
  assert.deepEqual(upstreamRequests.at(-1), {
    url: "/v1/models",
    authorization: "Bearer test-secret",
    body: null,
  });

  const status = await fetch(`${studioBaseURL}/api/mecatl-control/status`).then(
    (response) => response.json(),
  );
  assert.equal(status.mode, "external");
  assert.equal(status.workspace, "/workspace/from-deployment");
  // The deployment spawned its own mecated: Studio neither knows nor sets
  // its posture/trust/shell flags, so the saved-permissions mirror is null
  // (the EFFECTIVE posture still reads off the daemon's capabilities).
  assert.equal(status.permissions, null);
  // Nor its project-trust decision: there is no controller registry to
  // read in external mode, so the workspace trust banner never renders.
  assert.equal(status.trust, null);
  // Same for the session store: its location / in-memory mode is the
  // deployment's own spawn flag, so the mirror is null and the Storage card
  // renders the managed note instead of a form.
  assert.equal(status.storage, null);
  // And its retention flags: the EFFECTIVE policy still reads off the
  // daemon's own storage health, so the Retention card shows the table
  // and the managed note instead of a form.
  assert.equal(status.retention, null);
  // And for the daemon defaults (default/subagent model, effort, caching,
  // base URLs, ToolHive, aliases/slots, credentials path): spawn flags of
  // the MANAGED daemon only, so the mirror is null and the card renders the
  // managed note instead of a form.
  assert.equal(status.daemonDefaults, null);

  const mutation = await fetch(
    `${studioBaseURL}/api/mecatl-control/model-router`,
    { method: "POST" },
  );
  assert.equal(mutation.status, 409);
  assert.match((await mutation.json()).error, /external mecated deployment/);

  // Skill AND provider management are controller-owned: external mode owns
  // nothing locally, so every write — and even the inventory reads — answers
  // 409. The provider rows pin that no external deployment's auth.yaml can
  // be probed, removed, or even enumerated through Studio.
  for (const [path, method] of [
    ["skills", "POST"],
    ["skills/pr-feedback/disable", "POST"],
    ["skills/pr-feedback/enable", "POST"],
    ["skills/pr-feedback/body", "PUT"],
    ["skills/pr-feedback", "DELETE"],
    ["skills/disabled", "GET"],
    ["providers", "GET"],
    ["providers/known", "GET"],
    ["providers/openrouter/test", "POST"],
    ["providers/openrouter", "DELETE"],
    // The custom-definition write and the key-only (`providers logout`)
    // removal edit the MANAGED daemon's settings.yaml / auth.yaml.
    ["providers/custom", "POST"],
    ["providers/openrouter?scope=credential", "DELETE"],
    ["restart", "POST"],
    // Starting the ToolHive proxy spawns a process on the MANAGED
    // controller's machine; the external deployment owns its own gateway.
    ["toolhive/start", "POST"],
    // Posture / trust / shell-less mode are spawn flags of the MANAGED
    // daemon: the external deployment owns its own, read included.
    ["permissions", "GET"],
    ["permissions", "POST"],
    // The session-store location / in-memory switch is a spawn flag of the
    // MANAGED daemon too.
    ["storage", "POST"],
    // As are its retention limits / sweep cadence / main-deletion
    // acknowledgement.
    ["retention", "POST"],
    // The daemon log is the MANAGED controller's file of its child's
    // stderr; an external deployment writes its diagnostics wherever it
    // configured them, and Studio has no access to a remote daemon's log.
    ["logs", "GET"],
    ["logs/download", "GET"],
    // The daemon defaults (--default-model, --subagent-model, effort,
    // caching, base URLs, ToolHive, aliases/slots, --api-key-file) are
    // spawn flags of the MANAGED daemon: external owns them, read included.
    ["daemon-defaults", "GET"],
    ["daemon-defaults", "PUT"],
    // The diagnostics options (--log-level, the admin/metrics listener,
    // --perf-mcp, --goroutine-warn-threshold, --product-metrics opt-out,
    // controller-side quiet) are spawn flags of the MANAGED daemon too:
    // external owns them, read included.
    ["diagnostics-options", "GET"],
    ["diagnostics-options", "POST"],
    // The runtime admin surface (the loopback --metrics-addr listener the
    // MANAGED controller chose, its /metrics and /debug/vars relays) is the
    // managed daemon's: an external deployment configures its own
    // --metrics-addr / --perf-mcp, and Studio relays nothing for it.
    ["perf", "GET"],
    ["perf/metrics", "GET"],
    ["perf/vars", "GET"],
    // The runtime settings (learning mode/sensitivity, the steer opt-out,
    // the soul flags) are spawn flags + a CLI-tier file of the MANAGED
    // daemon, and the soul baseline approval is one of its spawns: external
    // owns them all, read included.
    ["runtime-settings", "GET"],
    ["runtime-settings", "PUT"],
    ["soul/approve", "POST"],
    // The two project-trust grants (the workspace banner's "Trust project"
    // / "Trust for this session") write the MANAGED controller's own trust
    // registry and restart its daemon: external owns its trust decision.
    ["permissions/trust", "POST"],
    ["permissions/trust-once", "POST"],
  ]) {
    const refused = await fetch(`${studioBaseURL}/api/mecatl-control/${path}`, {
      method,
    });
    assert.equal(refused.status, 409, `${method} ${path}`);
  }

  const csrf = await fetch(`${studioBaseURL}/api/mecatl/v1/sessions`, {
    method: "POST",
    headers: { origin: "https://evil.example", "content-type": "text/plain" },
    body: "{}",
  });
  assert.equal(csrf.status, 403);
});

test("session creation is forwarded verbatim — placement is server-owned", async () => {
  const created = await fetch(`${studioBaseURL}/api/mecatl/v1/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "default" }),
  });
  assert.equal(created.status, 200);
  const recorded = upstreamRequests.at(-1);
  assert.equal(recorded.url, "/v1/sessions");
  assert.equal(recorded.authorization, "Bearer test-secret");
  // The daemon decodes this body with unknown fields DISALLOWED and assigns
  // the workspace itself (ADR 0291): the proxy must add nothing — no
  // `workspace`, no rewrite — only the bearer credential.
  assert.deepEqual(JSON.parse(recorded.body), { mode: "default" });

  // Slash-command discovery is keyed by session, never by a workspace path:
  // the query string passes through untouched.
  const commands = await fetch(
    `${studioBaseURL}/api/mecatl/v1/commands?session_id=sess-1`,
  );
  assert.equal(commands.status, 200);
  assert.equal(upstreamRequests.at(-1).url, "/v1/commands?session_id=sess-1");
});

test("an unreachable daemon is a friendly 503, never demo content", async () => {
  const models = await fetch(`${offlineBaseURL}/api/mecatl/v1/models`);
  assert.equal(models.status, 503);
  assert.match((await models.json()).error, /unavailable/i);

  // The page itself still serves — the offline state is the UI's to render —
  // and carries no fabricated inventory.
  const page = await fetch(`${offlineBaseURL}/workspace/chat`);
  assert.equal(page.status, 200);
});

test("a daemon 401 is relayed verbatim — status, code, words and challenge — with the bearer still injected", async () => {
  const rejected = await fetch(
    `${studioBaseURL}/api/mecatl/v1/sessions/rejected-credential`,
  );
  // The proxy adds auth ONLY: the daemon's refusal crosses untouched, so the
  // client can classify it (Credential rejected, never "unreachable").
  assert.equal(rejected.status, 401);
  assert.equal(
    rejected.headers.get("www-authenticate"),
    'Bearer realm="mecatl"',
  );
  const body = await rejected.json();
  assert.equal(body.code, "unauthenticated");
  assert.match(body.error, /bearer token/);
  assert.deepEqual(upstreamRequests.at(-1), {
    url: "/v1/sessions/rejected-credential",
    authorization: "Bearer test-secret",
    body: null,
  });
});

test("controller policy rejects CSRF and DNS-rebinding requests", () => {
  const policy = {
    allowedOrigins: new Set(["http://localhost:3000"]),
    mcpProxyPrefix: "/mcp-proxy/unguessable/",
  };
  const url = new URL("http://127.0.0.1:8788/mcp");
  assert.equal(
    requestIsAllowed(
      { method: "POST", headers: { host: "127.0.0.1:8788" } },
      url,
      policy,
    ),
    false,
  );
  assert.equal(
    requestIsAllowed(
      {
        method: "POST",
        headers: { host: "127.0.0.1:8788", origin: "https://evil.example" },
      },
      url,
      policy,
    ),
    false,
  );
  assert.equal(
    requestIsAllowed(
      {
        method: "POST",
        headers: { host: "attacker.example", "x-mecatl-studio-request": "1" },
      },
      url,
      policy,
    ),
    false,
  );
  assert.equal(
    requestIsAllowed(
      {
        method: "POST",
        headers: {
          host: "127.0.0.1:8788",
          origin: "http://localhost:3000",
          "x-mecatl-studio-request": "1",
        },
      },
      url,
      policy,
    ),
    true,
  );
  // Skill and provider routes are NOT in the header-free read-only
  // allowlist: even the inventory GETs need the server-set studio header,
  // and a mutation without it is refused like any other controller write.
  // For /providers that gate is part of rule 3's perimeter — a page in
  // another loopback-origin app must not be able to enumerate auth.yaml's
  // provider names, key-test a stored credential, or delete a block.
  for (const [method, pathname] of [
    ["GET", "/skills/disabled"],
    ["POST", "/skills"],
    ["POST", "/skills/pr-feedback/disable"],
    ["DELETE", "/skills/pr-feedback"],
    ["GET", "/providers"],
    ["GET", "/providers/known"],
    ["POST", "/providers/openrouter/test"],
    ["DELETE", "/providers/openrouter"],
    // Writing a provider definition into settings.yaml or cutting a key
    // line from auth.yaml are file edits another loopback-origin page must
    // never be able to make.
    ["POST", "/providers/custom"],
    ["DELETE", "/providers/openrouter?scope=credential"],
    ["POST", "/restart"],
    // Starting the ToolHive proxy spawns a process; another loopback-origin
    // page must never be able to do that.
    ["POST", "/toolhive/start"],
    // The permissions document (posture / trust / shell-less) is likewise
    // header-gated on BOTH verbs: another loopback-origin page must not read
    // the daemon's trust flags, let alone raise its posture.
    ["GET", "/permissions"],
    ["POST", "/permissions"],
    // The session-store write relocates (or drops) the daemon's persistence;
    // another loopback-origin page must not be able to do that.
    ["POST", "/storage"],
    // The retention write can switch on automatic deletion of the user's
    // own chats; another loopback-origin page must never reach it.
    ["POST", "/retention"],
    // The runtime admin surface: /metrics can embed prompt text and file
    // paths, and /perf names the loopback listener's port — another
    // loopback-origin page must not read either.
    ["GET", "/perf"],
    ["GET", "/perf/metrics"],
    ["GET", "/perf/vars"],
    // The daemon log carries model-influenced text (prompt fragments,
    // provider error bodies): another loopback-origin page must not read
    // or download it.
    ["GET", "/logs"],
    ["GET", "/logs/download"],
    // The runtime settings name files on this machine (the soul path and
    // the picker's candidates) and the PUT/approve restart the daemon:
    // another loopback-origin page must not read or write them.
    ["GET", "/runtime-settings"],
    ["PUT", "/runtime-settings"],
    ["POST", "/soul/approve"],
    // The project-trust grants raise what a checked-in allow rule may
    // auto-approve and restart the daemon: another loopback-origin page must
    // never be able to trust the workspace on the user's behalf.
    ["POST", "/permissions/trust"],
    ["POST", "/permissions/trust-once"],
  ]) {
    assert.equal(
      requestIsAllowed(
        {
          method,
          headers: { host: "127.0.0.1:8788", origin: "http://localhost:3000" },
        },
        new URL(`http://127.0.0.1:8788${pathname}`),
        policy,
      ),
      false,
      `${method} ${pathname}`,
    );
  }
});

test("gateway egress requires HTTPS or an operator-enabled loopback exception", () => {
  assert.equal(
    validateGatewayURL("https://gateway.example/mcp").protocol,
    "https:",
  );
  assert.throws(
    () => validateGatewayURL("http://169.254.169.254/latest/meta-data"),
    /must use HTTPS/,
  );
  assert.throws(
    () => validateGatewayURL("http://127.0.0.1:9000/mcp"),
    /must use HTTPS/,
  );
  assert.equal(
    validateGatewayURL("http://127.0.0.1:9000/mcp", { allowLoopbackHTTP: true })
      .hostname,
    "127.0.0.1",
  );
  assert.throws(
    () => validateGatewayURL("https://user:secret@gateway.example/mcp"),
    /must not contain credentials/,
  );
});
