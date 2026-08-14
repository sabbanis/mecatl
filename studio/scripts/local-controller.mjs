import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
// Studio is a module INSIDE the mecatl monorepo, so the harness it drives is
// the repo root one directory up — the workspace it edits, the source of
// `bin/mecated` (built by `task build`), and the cwd every run inherits.
const mecatlDir = resolve(here, "../..");
const binary = resolve(mecatlDir, "bin/mecated");
const workspace = mecatlDir;
const studioStateDir = resolve(here, "../.scratch");
const operatorSettingsFile = resolve(studioStateDir, "operator-settings.yaml");
const routerSettingsFile = resolve(studioStateDir, "model-router-settings.yaml");
const routerStateFile = resolve(studioStateDir, "model-router.json");
// Project-scoped skills only. A SKILL.md steers the model the same way AGENTS.md
// does, so discovery is deliberately pinned to the workspace and we never pass
// --skills-conventional (which would also pull in ~/.claude/skills and the
// user-global mecatl dir — a much wider trust surface than this app should open).
const skillsDir = resolve(workspace, ".mecatl/skills");
// Per-project memory (the Remember/Recall/SearchMemory tools) is OFF in mecated
// until --memory-dir is passed, unlike the user model which is on by default. The
// store is per-project by design, so it lives beside the session store rather than
// in a shared location. Consolidation stays off: it spends tokens in the background.
const memoryDir = resolve(workspace, ".scratch/studio-memory");
let child = null;
let provider = "offline mock";
let openRouterApiKey = "";
let gateway = null;
let modelRouterConfig = null;
let operatorSettingsActive = false;
let startupLog = "";
let restartQueue = Promise.resolve();
let gatewayRefresh = null;
let shuttingDown = false;
let restartTimer = null;
let restartFailures = 0;
const expectedExits = new WeakSet();
const oauthAttempts = new Map();
const oauthRedirectUri = "http://127.0.0.1:8788/oauth/callback";
// The ToolHive LLM gateway reaches mecated through "thv llm proxy", a LOOPBACK
// reverse proxy that injects a fresh OIDC token per request. The controller
// never holds a gateway credential itself — that is the whole point of routing
// through the proxy rather than pasting a key. mecated auto-detects the same
// proxy from ToolHive's own config, so the port here is only used for the
// readiness probe that decides whether "toolhive" is an offerable provider.
const toolhiveGatewayURL = "http://127.0.0.1:14000/v1";
let toolhiveReady = false;

const delay = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

// A short probe, deliberately: when no token is cached the proxy blocks on an
// interactive browser login, and a controller start must never hang on that.
// Timing out simply means "not offerable right now" and studio falls back.
async function detectToolhiveGateway() {
  try {
    const response = await fetch(`${toolhiveGatewayURL}/models`, { signal: AbortSignal.timeout(2500) });
    return response.ok;
  } catch {
    return false;
  }
}

// Provider preference. An explicitly connected OpenRouter key is a deliberate
// user choice and still outranks everything; otherwise the gateway is the
// default and the canned mock is only the last resort.
const preferredKind = () => (openRouterApiKey ? "openrouter" : toolhiveReady ? "toolhive" : "mock");

function normalizeModelRouter(input) {
  const classifierModel = typeof input?.classifierModel === "string" ? input.classifierModel.trim() : "";
  if (!classifierModel || classifierModel.length > 200) throw new Error("Choose a valid classifier model");
  if (!Array.isArray(input?.categories) || input.categories.length < 2 || input.categories.length > 8) {
    throw new Error("Semantic routing needs between 2 and 8 categories");
  }
  const seen = new Set();
  const categories = input.categories.map((category) => {
    const name = typeof category?.name === "string" ? category.name.trim().toLowerCase() : "";
    const description = typeof category?.description === "string" ? category.description.trim() : "";
    const model = typeof category?.model === "string" ? category.model.trim() : "";
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(name)) throw new Error("Category names must start with a letter and use only letters, numbers, underscores, or dashes");
    if (seen.has(name)) throw new Error(`Category name ${name} is duplicated`);
    if (!description || description.length > 300) throw new Error(`Category ${name} needs a distinct description of at most 300 characters`);
    if (!model || model.length > 200) throw new Error(`Choose a model for category ${name}`);
    seen.add(name);
    return { name, description, model };
  });
  const defaultCategory = typeof input?.defaultCategory === "string" ? input.defaultCategory.trim().toLowerCase() : "";
  if (!seen.has(defaultCategory)) throw new Error("The default category must match one of the routing categories");
  return { enabled: input?.enabled !== false, classifierModel, defaultCategory, categories };
}

const yamlString = (value) => JSON.stringify(String(value));

function renderModelRouterYAML(config) {
  const categories = config.categories.map((category) => [
    `      - name: ${yamlString(category.name)}`,
    `        description: ${yamlString(category.description)}`,
    `        model: ${yamlString(category.model)}`,
  ].join("\n")).join("\n");
  return [
    "# Managed by Mecatl Studio. This is loaded at the trusted CLI/operator tier.",
    "models:",
    "  slots:",
    `    router: ${yamlString(config.classifierModel)}`,
    "  router:",
    `    disabled: ${config.enabled ? "false" : "true"}`,
    "    classifier-slot: router",
    `    default-category: ${yamlString(config.defaultCategory)}`,
    "    categories:",
    categories,
    "",
  ].join("\n");
}

async function persistModelRouter(config) {
  await mkdir(studioStateDir, { recursive: true, mode: 0o700 });
  const yamlTemp = `${routerSettingsFile}.tmp`;
  const jsonTemp = `${routerStateFile}.tmp`;
  await writeFile(yamlTemp, renderModelRouterYAML(config), { mode: 0o600 });
  await writeFile(jsonTemp, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  await rename(yamlTemp, routerSettingsFile);
  await rename(jsonTemp, routerStateFile);
}

async function loadModelRouter() {
  try {
    return normalizeModelRouter(JSON.parse(await readFile(routerStateFile, "utf8")));
  } catch (error) {
    if (error?.code !== "ENOENT") process.stderr.write(`[router] saved configuration ignored: ${error.message || error}\n`);
    return null;
  }
}

async function hasOperatorSettings() {
  try {
    await readFile(operatorSettingsFile, "utf8");
    return true;
  } catch (error) {
    if (error?.code !== "ENOENT") process.stderr.write(`[settings] operator configuration ignored: ${error.message || error}\n`);
    return false;
  }
}

function wellKnownURL(base, name) {
  const url = new URL(base);
  const issuerPath = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return new URL(`/.well-known/${name}${issuerPath}`, url.origin).toString();
}

async function fetchJSON(url) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options = {}, timeout = 10_000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
}

function requireHttpsEndpoint(value, label) {
  if (!value) throw new Error(`OAuth metadata does not include ${label}`);
  const endpoint = new URL(value);
  if (endpoint.protocol !== "https:") throw new Error(`OAuth ${label} must use HTTPS`);
  return endpoint.toString();
}

async function discoverOAuth(gatewayURL) {
  const resourceCandidates = [];
  try {
    const probe = await fetch(gatewayURL, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    const challenge = probe.headers.get("www-authenticate") || "";
    const match = challenge.match(/resource_metadata\s*=\s*(?:"([^"]+)"|([^,\s]+))/i);
    if (match?.[1] || match?.[2]) resourceCandidates.push(match[1] || match[2]);
    await probe.body?.cancel().catch(() => undefined);
  } catch { /* fall through to RFC 9728 well-known locations */ }

  resourceCandidates.push(
    wellKnownURL(gatewayURL, "oauth-protected-resource"),
    new URL("/.well-known/oauth-protected-resource", gatewayURL.origin).toString(),
  );

  let resourceMetadata = null;
  for (const candidate of [...new Set(resourceCandidates)]) {
    let candidateURL;
    try { candidateURL = requireHttpsEndpoint(candidate, "protected resource metadata URL"); }
    catch { continue; }
    resourceMetadata = await fetchJSON(candidateURL);
    if (resourceMetadata) break;
  }

  const authorizationServer = resourceMetadata?.authorization_servers?.[0] || gatewayURL.origin;
  const metadataCandidates = [
    wellKnownURL(authorizationServer, "oauth-authorization-server"),
    wellKnownURL(authorizationServer, "openid-configuration"),
    new URL("/.well-known/openid-configuration", new URL(authorizationServer).origin).toString(),
  ];
  let metadata = null;
  for (const candidate of [...new Set(metadataCandidates)]) {
    metadata = await fetchJSON(candidate);
    if (metadata) break;
  }
  if (!metadata) throw new Error("The gateway did not advertise usable MCP OAuth authorization-server metadata");

  const authorizationEndpoint = requireHttpsEndpoint(metadata.authorization_endpoint, "authorization endpoint");
  const tokenEndpoint = requireHttpsEndpoint(metadata.token_endpoint, "token endpoint");
  const registrationEndpoint = requireHttpsEndpoint(metadata.registration_endpoint, "dynamic client registration endpoint");
  const resourceScopes = Array.isArray(resourceMetadata?.scopes_supported) ? resourceMetadata.scopes_supported : [];
  const authScopes = Array.isArray(metadata.scopes_supported) ? metadata.scopes_supported : [];
  const defaultScopes = ["openid", "profile", "email", "offline_access"];
  const preferredAuthScopes = defaultScopes.filter((scope) => authScopes.includes(scope));
  const scopes = [...new Set([...resourceScopes, ...preferredAuthScopes])];

  return {
    authorizationEndpoint,
    tokenEndpoint,
    registrationEndpoint,
    resource: resourceMetadata?.resource || gatewayURL.toString(),
    scope: scopes.join(" ") || "openid profile email offline_access",
  };
}

function queueRestart(operation) {
  const run = restartQueue.then(operation, operation);
  restartQueue = run.catch(() => undefined);
  return run;
}

function scheduleMecatlRestart() {
  if (shuttingDown || restartTimer || child) return;
  const wait = Math.min(10_000, 750 * (2 ** restartFailures));
  process.stderr.write(`[supervisor] mecated stopped unexpectedly; restarting in ${wait}ms\n`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    queueRestart(async () => {
      if (shuttingDown || child) return;
      try {
        await startMecatl(preferredKind());
        restartFailures = 0;
        process.stderr.write("[supervisor] mecated restarted\n");
      } catch (error) {
        restartFailures += 1;
        process.stderr.write(`[supervisor] restart failed: ${error.message || error}\n`);
        scheduleMecatlRestart();
      }
    });
  }, wait);
}

async function refreshGatewayAccessToken(force = false) {
  if (!gateway?.refreshToken || !gateway.clientId || !gateway.tokenEndpoint) return false;
  if (!force && gateway.expiresAt && gateway.expiresAt > Date.now() + 60_000) return true;
  if (gatewayRefresh) return gatewayRefresh;
  gatewayRefresh = (async () => {
    // No `scope` on refresh: RFC 6749 §6 makes it optional (the server reuses
    // the originally granted scopes), and this provider rejects the request as
    // malformed when it is present — which silently killed every auto-refresh
    // and made gateway auth die on the hour.
    const refreshBody = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: gateway.refreshToken,
      client_id: gateway.clientId,
    });
    if (gateway.resource) refreshBody.set("resource", gateway.resource);
    const tokenResponse = await fetch(gateway.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: refreshBody,
    });
    const tokenResult = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenResult.access_token) {
      process.stderr.write(`[oauth] refresh rejected (${tokenResponse.status}): ${JSON.stringify(tokenResult).slice(0, 300)}\n`);
      throw new Error(tokenResult.error_description || tokenResult.error || "Gateway token refresh failed");
    }
    gateway.token = tokenResult.access_token;
    if (tokenResult.refresh_token) gateway.refreshToken = tokenResult.refresh_token;
    gateway.expiresAt = Date.now() + Math.max(60, Number(tokenResult.expires_in) || 300) * 1000;
    process.stderr.write("[oauth] gateway access token refreshed\n");
    return true;
  })().finally(() => { gatewayRefresh = null; });
  return gatewayRefresh;
}

async function stopChild() {
  if (!child) {
    await delay(200);
    return;
  }
  const current = child;
  expectedExits.add(current);
  await new Promise((done) => {
    const timer = setTimeout(() => { current.kill("SIGKILL"); done(); }, 2000);
    current.once("exit", () => { clearTimeout(timer); done(); });
    current.kill("SIGTERM");
  });
  if (child === current) child = null;
  // Let loopback listeners finish closing before the next child binds them.
  await delay(250);
}

async function startMecatl(kind, apiKey = openRouterApiKey) {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  await stopChild();
  startupLog = "";
  const args = ["serve", "--workspace", workspace, "--store-dir", ".scratch/studio-sessions"];
  if (operatorSettingsActive) args.push("--permission-config", operatorSettingsFile);
  else if (modelRouterConfig) args.push("--permission-config", routerSettingsFile);
  // mecated refuses to start on a missing --skills-dir, and an empty directory is
  // the correct "no skills yet" state, so create it before every spawn.
  await mkdir(skillsDir, { recursive: true });
  args.push("--skills-dir", skillsDir);
  await mkdir(memoryDir, { recursive: true });
  args.push("--memory-dir", memoryDir);
  if (kind === "openrouter") args.push("--default-provider", "openrouter");
  // No credential and no base-URL flag for the gateway: mecated finds the
  // loopback proxy through ToolHive's own config and registers it as the
  // "toolhive" provider on its own. Naming it as the default is all it takes.
  else if (kind === "toolhive") args.push("--default-provider", "toolhive");
  else args.push("--mock");
  const env = { ...process.env };
  if (kind === "openrouter") env.OPENROUTER_API_KEY = apiKey;
  if (gateway) {
    // Mecatl's SDK opens the optional standalone SSE notification stream after
    // initialization. Some authenticated gateways (including Connector Gateway)
    // close that GET stream and thereby cancel an otherwise valid MCP session.
    // Keep the optional stream on loopback and forward request/response traffic.
    args.push("--mcp-server", `${gateway.name}=http://127.0.0.1:8788/mcp-proxy/${encodeURIComponent(gateway.name)}`);
  }
  const proc = spawn(binary, args, { cwd: mecatlDir, env, stdio: ["ignore", "ignore", "pipe"] });
  child = proc;
  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    startupLog = (startupLog + text).slice(-24_000);
    process.stderr.write(`[mecatl] ${text}`);
  });
  proc.once("exit", () => {
    if (child === proc) child = null;
    if (!expectedExits.has(proc)) scheduleMecatlRestart();
  });
  provider = kind === "openrouter" ? "OpenRouter" : kind === "toolhive" ? "ToolHive LLM gateway" : "offline mock";
  await delay(250);
  // Remote MCP gateways may cold-start and mecatl intentionally gives their
  // initialize handshake up to 30 seconds. Keep the controller's readiness
  // window longer than that so it never kills a valid in-flight connection.
  for (let attempt = 0; attempt < 320; attempt += 1) {
    if (proc.exitCode !== null) throw new Error(`mecatl exited during startup (code ${proc.exitCode})`);
    await delay(125);
    let ready = false;
    try {
      const response = await fetch("http://127.0.0.1:8081/v1/models");
      ready = response.ok;
    } catch { /* server is still starting */ }
    if (!ready) continue;
    // A response from an older listener is not enough. Require this exact child
    // to remain alive and answer again after a stability window.
    await delay(450);
    if (proc.exitCode !== null || child !== proc) throw new Error("mecatl exited before the connection became stable");
    if (gateway && /Unauthorized/i.test(startupLog)) {
      throw new Error("MCP Gateway rejected the bearer token (Unauthorized). Paste a current gateway access token and try again.");
    }
    if (gateway && /MCP manager construction failed|no servers could be connected/i.test(startupLog)) {
      throw new Error("MCP Gateway could not be initialized. Check that the URL is a Streamable HTTP endpoint and that its credential is valid.");
    }
    const stable = await fetch("http://127.0.0.1:8081/v1/models").then((response) => response.ok).catch(() => false);
    if (!stable) continue;
    restartFailures = 0;
    return;
  }
  throw new Error("mecatl did not become ready");
}

const server = http.createServer(async (request, response) => {
  const requestURL = new URL(request.url, "http://127.0.0.1:8788");
  if (requestURL.pathname.startsWith("/mcp-proxy/")) {
    const proxyName = decodeURIComponent(requestURL.pathname.slice("/mcp-proxy/".length));
    if (!gateway || proxyName !== gateway.name) {
      response.statusCode = 404;
      response.end("gateway not configured");
      return;
    }
    if (request.method === "GET") {
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      response.write(": loopback notification channel\n\n");
      const heartbeat = setInterval(() => response.write(": keepalive\n\n"), 15_000);
      request.once("close", () => clearInterval(heartbeat));
      return;
    }
    if (!["POST", "DELETE"].includes(request.method || "")) {
      response.statusCode = 405;
      response.end("method not allowed");
      return;
    }
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      await refreshGatewayAccessToken(false);
      const headers = { Authorization: `Bearer ${gateway.token}` };
      for (const key of ["content-type", "accept", "mcp-session-id", "mcp-protocol-version", "last-event-id"]) {
        if (request.headers[key]) headers[key] = request.headers[key];
      }
      const requestBody = request.method === "POST" ? Buffer.concat(chunks) : undefined;
      let upstream = await fetch(gateway.url, { method: request.method, headers, body: requestBody });
      if (upstream.status === 401 && gateway.refreshToken) {
        await upstream.arrayBuffer();
        await refreshGatewayAccessToken(true);
        headers.Authorization = `Bearer ${gateway.token}`;
        upstream = await fetch(gateway.url, { method: request.method, headers, body: requestBody });
      }
      process.stderr.write(`[mcp-proxy] ${request.method} ${upstream.status} ${upstream.headers.get("content-type") || ""}\n`);
      response.statusCode = upstream.status;
      for (const key of ["content-type", "cache-control", "mcp-session-id", "www-authenticate"]) {
        const value = upstream.headers.get(key);
        if (value) response.setHeader(key, value);
      }
      if (upstream.body) {
        for await (const chunk of upstream.body) response.write(chunk);
      }
      response.end();
    } catch (error) {
      process.stderr.write(`[mcp-proxy] ${request.method} failed: ${error.message || error}\n`);
      response.statusCode = 502;
      response.end(JSON.stringify({ error: error.message || "gateway proxy failed" }));
    }
    return;
  }
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "GET" && requestURL.pathname === "/mcp/oauth/start") {
    try {
      const name = requestURL.searchParams.get("name") || "";
      const gatewayURL = new URL(requestURL.searchParams.get("url") || "");
      if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("Gateway name may contain only letters, numbers, and underscores");
      if (gatewayURL.protocol !== "https:") throw new Error("OAuth gateways must use HTTPS");
      const discovery = await discoverOAuth(gatewayURL);
      const registrationResponse = await fetch(discovery.registrationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Mecatl Studio",
          application_type: "native",
          redirect_uris: [oauthRedirectUri],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const registration = await registrationResponse.json().catch(() => ({}));
      if (!registrationResponse.ok) throw new Error(registration.error_description || registration.error || "Gateway refused OAuth client registration");
      if (!registration.client_id) throw new Error("Gateway registration did not return a client ID");
      const state = randomBytes(24).toString("base64url");
      const verifier = randomBytes(48).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      const scope = registration.scope || discovery.scope;
      oauthAttempts.set(state, { name, url: gatewayURL.toString(), clientId: registration.client_id, tokenEndpoint: discovery.tokenEndpoint, scope, resource: discovery.resource, verifier, expires: Date.now() + 10 * 60_000 });
      const authorizationURL = new URL(discovery.authorizationEndpoint);
      authorizationURL.searchParams.set("response_type", "code");
      authorizationURL.searchParams.set("client_id", registration.client_id);
      authorizationURL.searchParams.set("redirect_uri", oauthRedirectUri);
      authorizationURL.searchParams.set("scope", scope);
      if (discovery.resource) authorizationURL.searchParams.set("resource", discovery.resource);
      authorizationURL.searchParams.set("state", state);
      authorizationURL.searchParams.set("code_challenge", challenge);
      authorizationURL.searchParams.set("code_challenge_method", "S256");
      if (requestURL.searchParams.get("redirect") === "1") {
        response.writeHead(302, { Location: authorizationURL.toString() });
        response.end();
      } else {
        response.end(JSON.stringify({ authorizationUrl: authorizationURL.toString() }));
      }
    } catch (error) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: error.message || "Could not start gateway sign-in" }));
    }
    return;
  }
  if (request.method === "GET" && requestURL.pathname === "/oauth/callback") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    const state = requestURL.searchParams.get("state") || "";
    const attempt = oauthAttempts.get(state);
    oauthAttempts.delete(state);
    try {
      if (requestURL.searchParams.get("error")) throw new Error(requestURL.searchParams.get("error_description") || requestURL.searchParams.get("error"));
      if (!attempt || attempt.expires < Date.now()) throw new Error("The gateway sign-in attempt expired. Start it again from Mecatl Studio.");
      const code = requestURL.searchParams.get("code");
      if (!code) throw new Error("Gateway sign-in did not return an authorization code");
      const tokenBody = new URLSearchParams({ grant_type: "authorization_code", code, client_id: attempt.clientId, redirect_uri: oauthRedirectUri, code_verifier: attempt.verifier });
      if (attempt.resource) tokenBody.set("resource", attempt.resource);
      const tokenResponse = await fetchWithTimeout(attempt.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody,
      }, 15_000);
      const tokenResult = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenResult.access_token) throw new Error(tokenResult.error_description || tokenResult.error || "Gateway token exchange failed");
      await queueRestart(async () => {
        const previousGateway = gateway;
        gateway = {
          name: attempt.name,
          url: attempt.url,
          token: tokenResult.access_token,
          refreshToken: tokenResult.refresh_token || "",
          clientId: attempt.clientId,
          tokenEndpoint: attempt.tokenEndpoint,
          scope: attempt.scope,
          resource: attempt.resource,
          expiresAt: Date.now() + Math.max(60, Number(tokenResult.expires_in) || 300) * 1000,
          insecureHttp: false,
        };
        try { await startMecatl(preferredKind()); }
        catch (error) { gateway = previousGateway; await startMecatl(preferredKind()); throw error; }
      });
      response.end('<!doctype html><title>Mecatl Gateway Connected</title><style>body{font:16px system-ui;padding:40px;color:#25231f}</style><h1>Gateway connected</h1><p>You can close this window.</p><script>window.opener?.postMessage({type:"mecatl-mcp-oauth",ok:true},"http://localhost:3000");setTimeout(()=>window.close(),700)</script>');
    } catch (error) {
      const message = String(error.message || "Gateway sign-in failed").replace(/[<>&"']/g, "");
      process.stderr.write(`[oauth] callback failed: ${message}\n`);
      response.statusCode = 400;
      response.end(`<!doctype html><title>Mecatl Gateway Error</title><style>body{font:16px system-ui;padding:40px;color:#25231f}</style><h1>Could not connect</h1><p>${message}</p><script>window.opener?.postMessage({type:"mecatl-mcp-oauth",ok:false,error:${JSON.stringify(message)}},"http://localhost:3000")</script>`);
    }
    return;
  }
  if (request.method === "POST" && requestURL.pathname === "/mcp/oauth/refresh") {
    try {
      if (!gateway?.refreshToken) throw new Error("Gateway does not have a refresh token; sign in again");
      await refreshGatewayAccessToken(true);
      response.end(JSON.stringify({ ok: true }));
    } catch (error) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: error.message || "Gateway token refresh failed" }));
    }
    return;
  }
  // Restart mecated with the CURRENT provider, gateway and router config. The
  // daemon resolves skills and agent definitions once at startup (ListSkills is
  // a pure snapshot read), so a newly authored SKILL.md only reaches the model
  // after a restart. Driving it from here preserves the provider credential,
  // which lives in this process's memory — restarting the controller instead
  // would drop it and silently fall back to the mock provider.
  if (request.method === "POST" && requestURL.pathname === "/restart") {
    try {
      await queueRestart(async () => {
        await startMecatl(preferredKind());
      });
      response.end(JSON.stringify({ ok: true, provider }));
    } catch (error) {
      response.statusCode = 400;
      response.end(
        JSON.stringify({ error: error.message || "Could not restart mecated" }),
      );
    }
    return;
  }
  if (request.method === "GET" && requestURL.pathname === "/status") {
    response.end(JSON.stringify({
      provider,
      running: Boolean(child),
      // The client has no other way to learn this: it is resolved from THIS
      // file's location, so a clone anywhere works with no source edit.
      workspace,
      gateway: gateway ? { name: gateway.name, url: gateway.url } : null,
      toolhiveGateway: { available: toolhiveReady, baseURL: toolhiveGatewayURL, active: provider === "ToolHive LLM gateway" },
      modelRouter: modelRouterConfig ? { enabled: modelRouterConfig.enabled, categories: modelRouterConfig.categories.length } : null,
      operatorSettings: operatorSettingsActive,
      skills: { dir: skillsDir, scope: "project" },
      memory: { dir: memoryDir, scope: "project" },
    }));
    return;
  }
  if (request.method === "GET" && requestURL.pathname === "/model-router") {
    response.end(JSON.stringify({ config: modelRouterConfig, managedBy: operatorSettingsActive ? "operator-settings" : "studio" }));
    return;
  }
  // Switch back to the gateway after an OpenRouter key was connected. Dropping
  // the key is what makes the switch stick: preferredKind() gives an explicitly
  // connected key precedence, so leaving it in place would flip straight back
  // on the next restart.
  if (request.method === "POST" && requestURL.pathname === "/toolhive") {
    try {
      toolhiveReady = await detectToolhiveGateway();
      if (!toolhiveReady) throw new Error(`No ToolHive LLM gateway on ${toolhiveGatewayURL}. Start it with "thv llm proxy start" and try again.`);
      await queueRestart(async () => {
        openRouterApiKey = "";
        await startMecatl("toolhive");
      });
      response.end(JSON.stringify({ ok: true, provider }));
    } catch (error) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: error.message || "Could not switch to the ToolHive LLM gateway" }));
    }
    return;
  }
  if (request.method !== "POST" || !["/openrouter", "/mcp", "/model-router"].includes(requestURL.pathname)) {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) {
      response.statusCode = 413;
      response.end(JSON.stringify({ error: "request too large" }));
      return;
    }
  }
  try {
    const input = JSON.parse(body);
    if (requestURL.pathname === "/model-router") {
      if (operatorSettingsActive) throw new Error("Routing is managed by the imported operator settings. Update the complete settings file to preserve its aliases, slots, and guardrails.");
      const nextConfig = normalizeModelRouter(input);
      await queueRestart(async () => {
        const previousConfig = modelRouterConfig;
        modelRouterConfig = nextConfig;
        await persistModelRouter(nextConfig);
        try {
          await startMecatl(preferredKind());
        } catch (error) {
          modelRouterConfig = previousConfig;
          if (previousConfig) await persistModelRouter(previousConfig);
          else await Promise.all([rm(routerSettingsFile, { force: true }), rm(routerStateFile, { force: true })]);
          await startMecatl(preferredKind());
          throw error;
        }
      });
      response.end(JSON.stringify({ ok: true, config: modelRouterConfig }));
      return;
    }
    if (requestURL.pathname === "/openrouter") {
      if (typeof input.apiKey !== "string" || !input.apiKey.trim()) throw new Error("OpenRouter API key is required");
      await queueRestart(async () => {
        openRouterApiKey = input.apiKey.trim();
        await startMecatl("openrouter", openRouterApiKey);
      });
      response.end(JSON.stringify({ ok: true, provider }));
      return;
    }
    if (!/^[A-Za-z0-9_]+$/.test(input.name || "")) throw new Error("Gateway name may contain only letters, numbers, and underscores");
    const parsed = new URL(input.url);
    const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && (loopback || input.insecureHttp))) throw new Error("Use HTTPS, or explicitly allow insecure HTTP");
    const token = typeof input.token === "string" ? input.token.trim().replace(/^Bearer\s+/i, "") : "";
    const candidate = { name: input.name, url: parsed.toString(), token, insecureHttp: Boolean(input.insecureHttp && parsed.protocol === "http:" && !loopback) };
    await queueRestart(async () => {
      const previousGateway = gateway;
      gateway = candidate;
      try {
        await startMecatl(preferredKind());
      } catch (error) {
        // Keep the provider usable and keep rejected gateway credentials out of
        // controller state. The caller still receives the original handshake error.
        gateway = previousGateway;
        await startMecatl(preferredKind());
        throw error;
      }
    });
    response.end(JSON.stringify({ ok: true, gateway: { name: gateway.name, url: gateway.url } }));
  } catch (error) {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: error.message || "Could not update the Mecatl controller" }));
  }
});

server.listen(8788, "127.0.0.1", async () => {
  process.stdout.write("Mecatl local controller: http://127.0.0.1:8788\n");
  operatorSettingsActive = await hasOperatorSettings();
  modelRouterConfig = await loadModelRouter();
  toolhiveReady = await detectToolhiveGateway();
  process.stdout.write(toolhiveReady
    ? `ToolHive LLM gateway detected at ${toolhiveGatewayURL}\n`
    : `ToolHive LLM gateway not reachable at ${toolhiveGatewayURL} (start it with "thv llm proxy start"); falling back to the offline mock\n`);
  try { await startMecatl(preferredKind()); }
  catch (error) { process.stderr.write(`${error.message}\n`); }
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    shuttingDown = true;
    if (restartTimer) clearTimeout(restartTimer);
    await stopChild();
    server.close(() => process.exit(0));
  });
}
