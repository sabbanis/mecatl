import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import http from "node:http";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  requestIsAllowed,
  validateGatewayURL,
} from "../src/lib/controller-security.mjs";
import {
  KNOWN_AUTH_PROVIDERS,
  listAuthFileProviders,
  listSettingsProviders,
} from "../src/lib/provider-auth.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// Studio is a module INSIDE the mecatl monorepo, so the harness it drives is
// the repo root one directory up — the workspace it edits, the source of
// `bin/mecated` (built by `task build`), and the cwd every run inherits.
const mecatlDir = resolve(here, "../..");
const binary = resolve(mecatlDir, "bin/mecated");
const workspace = mecatlDir;
const studioStateDir = resolve(here, "../.scratch");
const operatorSettingsFile = resolve(studioStateDir, "operator-settings.yaml");
const routerSettingsFile = resolve(
  studioStateDir,
  "model-router-settings.yaml",
);
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
const authFile = process.env.XDG_CONFIG_HOME
  ? resolve(process.env.XDG_CONFIG_HOME, "mecatl/auth.yaml")
  : resolve(homedir(), ".config/mecatl/auth.yaml");
// The user-global operator settings file, same XDG convention as auth.yaml.
// mecated always reads it at the operator tier; it is where a hand-added
// custom `providers:` block (ADR 0238) lives unless an imported
// operator-settings.yaml (a CLI-tier file, which wins whole-block) carries
// its own.
const userSettingsFile = process.env.XDG_CONFIG_HOME
  ? resolve(process.env.XDG_CONFIG_HOME, "mecatl/settings.yaml")
  : resolve(homedir(), ".config/mecatl/settings.yaml");
// mecated's --ready-file target: the atomically-published mecated-ready/1
// document carrying the RESOLVED listener addresses (the daemon binds
// 127.0.0.1:0 and reports what the kernel picked), pid, api_major, features,
// and deployment. Written only after every listener is up, never removed by
// the daemon — the controller unlinks the stale one before each spawn.
const readyFilePath = resolve(studioStateDir, "mecated-ready.json");
// The named FIFO backing --lifetime-pipe-fd. mecated fstat's the descriptor
// and rejects anything that is not a real pipe (S_IFIFO) — and Node's stdio
// "pipe" entries are AF_UNIX socketpairs — so the pipe is made with
// mkfifo(1) and its NAME is unlinked as soon as both ends are open.
const lifetimeFifoPath = resolve(studioStateDir, "mecated-lifetime.fifo");
// How long to wait for the ready file. Remote MCP gateways may cold-start and
// mecatl gives their initialize handshake up to 30 seconds; MCP construction
// happens during composition, which completes BEFORE the ready file is
// written, so the wait stays comfortably longer than that.
const readyWaitMs = 60_000;

/** auth.yaml's text, or "" when it does not exist / cannot be read. */
async function readAuthFileText() {
  try {
    return await readFile(authFile, "utf8");
  } catch {
    return "";
  }
}

/**
 * Names only of the providers configured in auth.yaml — never their values.
 * The line scan lives in src/lib/provider-auth.mjs (shared with its vitest
 * suite): it deliberately cannot read a credential, only detect that a
 * `providers:` block names a key at one level of indent.
 */
async function listConfiguredProviderNames() {
  return listAuthFileProviders(await readAuthFileText()).map(
    (provider) => provider.name,
  );
}

/**
 * The operator-defined custom providers (ADR 0238) mecated will actually
 * see, mirroring its whole-block first-non-nil `providers:` capture across
 * the operator tier: the imported operator-settings.yaml (the CLI-tier file
 * this controller passes) is consulted first, then the user-global
 * settings.yaml. The section is non-secret by design — ids, flavors, base
 * URLs, auth methods; any key stays in auth.yaml.
 */
async function listCustomSettingsProviders() {
  const sources = operatorSettingsActive
    ? [operatorSettingsFile, userSettingsFile]
    : [userSettingsFile];
  for (const file of sources) {
    let text;
    try {
      text = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const providers = listSettingsProviders(text);
    if (providers !== null) return providers;
  }
  return [];
}

/**
 * Every provider name the daemon can be started on: the auth.yaml blocks
 * plus the settings-defined custom providers — a keyless
 * (`auth.method: none`) custom provider never appears in auth.yaml, so the
 * auth scan alone would refuse to select it.
 */
async function listSelectableProviderNames() {
  const names = await listConfiguredProviderNames();
  for (const provider of await listCustomSettingsProviders()) {
    if (!names.includes(provider.name)) names.push(provider.name);
  }
  return names;
}

// The kinds startMecatl/preferredKind understand: the two synthetic ones plus
// every provider auth.yaml can name a block for (KNOWN_AUTH_PROVIDERS is the
// same registry the guided-add UI offers).
const KNOWN_PROVIDER_KINDS = new Set([
  "mock",
  "toolhive",
  ...KNOWN_AUTH_PROVIDERS.map((entry) => entry.name),
]);
const configuredProvider =
  process.env.MECATL_STUDIO_PROVIDER?.trim().toLowerCase() || "";
if (configuredProvider && !KNOWN_PROVIDER_KINDS.has(configuredProvider)) {
  throw new Error(
    `MECATL_STUDIO_PROVIDER must be one of: ${[...KNOWN_PROVIDER_KINDS].join(", ")}`,
  );
}
// The LIVE active-provider selection. Seeded from MECATL_STUDIO_PROVIDER at
// startup, but — unlike that env var, which is frozen for the process's
// lifetime — reassignable at runtime through POST /providers/active (the
// Studio settings UI's provider switch), so an operator can move between the
// offline mock and a real provider without restarting `npm run dev`.
let activeProviderOverride = configuredProvider || null;
const managedAuthToken = (
  process.env.MECATL_AUTH_TOKEN || randomBytes(32).toString("base64url")
).replace(/^Bearer\s+/i, "");
const mcpProxySecret = randomBytes(24).toString("base64url");
const studioPublicOrigin =
  process.env.MECATL_STUDIO_PUBLIC_ORIGIN?.trim() || "http://localhost:3000";
const allowedOrigins = new Set(
  (
    process.env.MECATL_STUDIO_ORIGINS ||
    "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
allowedOrigins.add(studioPublicOrigin);
let child = null;
let provider = "offline mock";
let mecatlBaseURL = "";
// What the child's ready file reported at the last successful start: the
// non-secret compatibility descriptor a parent may surface (H1.3). Null
// until a child has published one.
let readyInfo = null;
let gateway = null;
let modelRouterConfig = null;
let operatorSettingsActive = false;
let startupLog = "";
let restartQueue = Promise.resolve();
let gatewayRefresh = null;
let shuttingDown = false;
let restartTimer = null;
let restartFailures = 0;
let startupError = "";
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

const delay = (milliseconds) =>
  new Promise((done) => setTimeout(done, milliseconds));

function jsonError(response, status, message) {
  response.statusCode = status;
  response.end(JSON.stringify({ error: message }));
}

async function readBody(request, limit = 1_048_576) {
  const declared = Number(request.headers["content-length"] || 0);
  if (declared > limit)
    throw Object.assign(new Error("request too large"), { statusCode: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit)
      throw Object.assign(new Error("request too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * A REAL pipe for mecated's --lifetime-pipe-fd. The daemon fstat's the
 * inherited descriptor and rejects anything that is not S_IFIFO — and Node's
 * stdio "pipe" entries are AF_UNIX socketpairs — so the pipe is a named FIFO
 * made with mkfifo(1), both ends opened, and the name unlinked (the
 * descriptors outlive it). The controller holds the WRITE end and never
 * writes: if this process dies — SIGKILL included — the kernel closes it,
 * the child reads EOF, and mecated stops through its ordinary graceful
 * shutdown. That is what keeps a controller crash from orphaning a daemon.
 */
async function createLifetimePipe() {
  await rm(lifetimeFifoPath, { force: true });
  await new Promise((done, fail) => {
    execFile("mkfifo", ["-m", "600", lifetimeFifoPath], (error) =>
      error ? fail(error) : done(),
    );
  });
  try {
    // Opening either end of a FIFO blocks until the other side opens, so the
    // two opens must run concurrently; together they complete immediately.
    const [readEnd, writeEnd] = await Promise.all([
      open(lifetimeFifoPath, "r"),
      open(lifetimeFifoPath, "w"),
    ]);
    return { readEnd, writeEnd };
  } finally {
    await rm(lifetimeFifoPath, { force: true });
  }
}

/**
 * Waits for THIS child's mecated-ready/1 document. The daemon publishes it
 * atomically (temp + rename) and only after composition and every listener
 * are up, so a successful read IS readiness — no connect polling, no
 * stability window. A parse failure is a foreign file, never a torn write;
 * a pid mismatch is the previous child's stale document (unlinked before the
 * spawn, so only a pathological race shows one) and polling continues.
 */
async function waitForReadyDoc(proc) {
  const deadline = Date.now() + readyWaitMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null)
      throw new Error(`mecatl exited during startup (code ${proc.exitCode})`);
    if (child !== proc)
      throw new Error("mecatl was replaced before it became ready");
    let text = "";
    try {
      text = await readFile(readyFilePath, "utf8");
    } catch {
      /* not published yet */
    }
    if (text) {
      let doc = null;
      try {
        doc = JSON.parse(text);
      } catch {
        /* not a ready document */
      }
      if (doc && doc.schema !== "mecated-ready/1")
        throw new Error(
          `mecated wrote an unsupported ready-file schema "${doc.schema}"`,
        );
      if (doc?.pid === proc.pid) {
        if (typeof doc.http_address !== "string" || doc.http_address === "")
          throw new Error("mecatl's ready file reports no HTTP listener");
        return doc;
      }
    }
    await delay(100);
  }
  throw new Error("mecatl did not publish its ready file in time");
}

function fetchMecatl(path, options = {}) {
  if (!mecatlBaseURL)
    throw new Error("mecated has not been assigned a listener yet");
  const headers = new Headers(options.headers);
  headers.set("authorization", `Bearer ${managedAuthToken}`);
  return fetch(new URL(path, mecatlBaseURL), { ...options, headers });
}

function providerLabel(kind) {
  if (kind === "mock") return "offline mock";
  if (kind === "toolhive") return "ToolHive LLM gateway";
  return (
    KNOWN_AUTH_PROVIDERS.find((entry) => entry.name === kind)?.label ?? kind
  );
}

function startupFailure(kind, message) {
  startupError =
    kind !== "mock" && kind !== "toolhive"
      ? `${providerLabel(kind)} could not start. Add providers.${kind}.api_key to ${authFile}, then switch to it again. mecated: ${message}`
      : message;
  return new Error(startupError);
}

// A short probe, deliberately: when no token is cached the proxy blocks on an
// interactive browser login, and a controller start must never hang on that.
// Timing out simply means "not offerable right now" and studio falls back.
async function detectToolhiveGateway() {
  try {
    const response = await fetch(`${toolhiveGatewayURL}/models`, {
      signal: AbortSignal.timeout(2500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Provider credentials are owned by mecated's conventional auth file, never
// copied through a browser form or patched into the child's environment here.
// MECATL_STUDIO_PROVIDER / the /providers/active switch select a provider
// without carrying its credential.
const preferredKind = () =>
  activeProviderOverride || (toolhiveReady ? "toolhive" : "mock");

function normalizeModelRouter(input) {
  const classifierModel =
    typeof input?.classifierModel === "string"
      ? input.classifierModel.trim()
      : "";
  if (!classifierModel || classifierModel.length > 200)
    throw new Error("Choose a valid classifier model");
  if (
    !Array.isArray(input?.categories) ||
    input.categories.length < 2 ||
    input.categories.length > 8
  ) {
    throw new Error("Semantic routing needs between 2 and 8 categories");
  }
  const seen = new Set();
  const categories = input.categories.map((category) => {
    const name =
      typeof category?.name === "string"
        ? category.name.trim().toLowerCase()
        : "";
    const description =
      typeof category?.description === "string"
        ? category.description.trim()
        : "";
    const model =
      typeof category?.model === "string" ? category.model.trim() : "";
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(name))
      throw new Error(
        "Category names must start with a letter and use only letters, numbers, underscores, or dashes",
      );
    if (seen.has(name)) throw new Error(`Category name ${name} is duplicated`);
    if (!description || description.length > 300)
      throw new Error(
        `Category ${name} needs a distinct description of at most 300 characters`,
      );
    if (!model || model.length > 200)
      throw new Error(`Choose a model for category ${name}`);
    seen.add(name);
    return { name, description, model };
  });
  const defaultCategory =
    typeof input?.defaultCategory === "string"
      ? input.defaultCategory.trim().toLowerCase()
      : "";
  if (!seen.has(defaultCategory))
    throw new Error(
      "The default category must match one of the routing categories",
    );
  return {
    enabled: input?.enabled !== false,
    classifierModel,
    defaultCategory,
    categories,
  };
}

async function loadModelRouter() {
  try {
    return normalizeModelRouter(
      JSON.parse(await readFile(routerStateFile, "utf8")),
    );
  } catch (error) {
    if (error?.code !== "ENOENT")
      process.stderr.write(
        `[router] saved configuration ignored: ${error.message || error}\n`,
      );
    return null;
  }
}

async function hasOperatorSettings() {
  try {
    await readFile(operatorSettingsFile, "utf8");
    return true;
  } catch (error) {
    if (error?.code !== "ENOENT")
      process.stderr.write(
        `[settings] operator configuration ignored: ${error.message || error}\n`,
      );
    return false;
  }
}

function wellKnownURL(base, name) {
  const url = new URL(base);
  const issuerPath =
    url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
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

function requireHttpsEndpoint(value, label) {
  if (!value) throw new Error(`OAuth metadata does not include ${label}`);
  const endpoint = new URL(value);
  if (endpoint.protocol !== "https:")
    throw new Error(`OAuth ${label} must use HTTPS`);
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
    const match = challenge.match(
      /resource_metadata\s*=\s*(?:"([^"]+)"|([^,\s]+))/i,
    );
    if (match?.[1] || match?.[2]) resourceCandidates.push(match[1] || match[2]);
    await probe.body?.cancel().catch(() => undefined);
  } catch {
    /* fall through to RFC 9728 well-known locations */
  }

  resourceCandidates.push(
    wellKnownURL(gatewayURL, "oauth-protected-resource"),
    new URL(
      "/.well-known/oauth-protected-resource",
      gatewayURL.origin,
    ).toString(),
  );

  let resourceMetadata = null;
  for (const candidate of [...new Set(resourceCandidates)]) {
    let candidateURL;
    try {
      candidateURL = requireHttpsEndpoint(
        candidate,
        "protected resource metadata URL",
      );
    } catch {
      continue;
    }
    resourceMetadata = await fetchJSON(candidateURL);
    if (resourceMetadata) break;
  }

  const authorizationServer =
    resourceMetadata?.authorization_servers?.[0] || gatewayURL.origin;
  const metadataCandidates = [
    wellKnownURL(authorizationServer, "oauth-authorization-server"),
    wellKnownURL(authorizationServer, "openid-configuration"),
    new URL(
      "/.well-known/openid-configuration",
      new URL(authorizationServer).origin,
    ).toString(),
  ];
  let metadata = null;
  for (const candidate of [...new Set(metadataCandidates)]) {
    metadata = await fetchJSON(candidate);
    if (metadata) break;
  }
  if (!metadata)
    throw new Error(
      "The gateway did not advertise usable MCP OAuth authorization-server metadata",
    );

  const authorizationEndpoint = requireHttpsEndpoint(
    metadata.authorization_endpoint,
    "authorization endpoint",
  );
  const tokenEndpoint = requireHttpsEndpoint(
    metadata.token_endpoint,
    "token endpoint",
  );
  const registrationEndpoint = requireHttpsEndpoint(
    metadata.registration_endpoint,
    "dynamic client registration endpoint",
  );
  const resourceScopes = Array.isArray(resourceMetadata?.scopes_supported)
    ? resourceMetadata.scopes_supported
    : [];
  const authScopes = Array.isArray(metadata.scopes_supported)
    ? metadata.scopes_supported
    : [];
  const defaultScopes = ["openid", "profile", "email", "offline_access"];
  const preferredAuthScopes = defaultScopes.filter((scope) =>
    authScopes.includes(scope),
  );
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
  const wait = Math.min(10_000, 750 * 2 ** restartFailures);
  process.stderr.write(
    `[supervisor] mecated stopped unexpectedly; restarting in ${wait}ms\n`,
  );
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
        process.stderr.write(
          `[supervisor] restart failed: ${error.message || error}\n`,
        );
        scheduleMecatlRestart();
      }
    });
  }, wait);
}

async function refreshGatewayAccessToken(force = false) {
  if (!gateway?.refreshToken || !gateway.clientId || !gateway.tokenEndpoint)
    return false;
  if (!force && gateway.expiresAt && gateway.expiresAt > Date.now() + 60_000)
    return true;
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
      process.stderr.write(
        `[oauth] refresh rejected (${tokenResponse.status}, ${String(tokenResult.error || "unknown_error").slice(0, 80)})\n`,
      );
      throw new Error(
        tokenResult.error_description ||
          tokenResult.error ||
          "Gateway token refresh failed",
      );
    }
    gateway.token = tokenResult.access_token;
    if (tokenResult.refresh_token)
      gateway.refreshToken = tokenResult.refresh_token;
    gateway.expiresAt =
      Date.now() + Math.max(60, Number(tokenResult.expires_in) || 300) * 1000;
    process.stderr.write("[oauth] gateway access token refreshed\n");
    return true;
  })().finally(() => {
    gatewayRefresh = null;
  });
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
    const timer = setTimeout(() => {
      current.kill("SIGKILL");
      done();
    }, 2000);
    current.once("exit", () => {
      clearTimeout(timer);
      done();
    });
    current.kill("SIGTERM");
  });
  if (child === current) child = null;
  // Let loopback listeners finish closing before the next child binds them.
  await delay(250);
}

async function startMecatl(kind) {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  await stopChild();
  startupLog = "";
  startupError = "";
  // No listener is assigned until THIS child's ready file names one: the old
  // base URL points at a dead port, and fetchMecatl's guard is the honest
  // answer while the restart is in flight.
  mecatlBaseURL = "";
  readyInfo = null;
  await mkdir(studioStateDir, { recursive: true, mode: 0o700 });
  // The daemon never removes its ready file (a SIGKILLed one could not), so
  // the previous child's document must go before the spawn — otherwise the
  // wait below could read yesterday's addresses. The pid check is the
  // backstop for the pathological race.
  await rm(readyFilePath, { force: true });
  const args = [
    "serve",
    "--workspace",
    workspace,
    "--store-dir",
    ".scratch/studio-sessions",
    "--grpc-addr",
    "127.0.0.1:0",
    // An ephemeral HTTP port: the kernel picks it at bind(2) time and the
    // ready file reports it RESOLVED — no pre-bind pick, no TOCTOU window.
    "--http-addr",
    "127.0.0.1:0",
    "--ready-file",
    readyFilePath,
  ];
  if (operatorSettingsActive)
    args.push("--permission-config", operatorSettingsFile);
  else if (modelRouterConfig)
    args.push("--permission-config", routerSettingsFile);
  // mecated refuses to start on a missing --skills-dir, and an empty directory is
  // the correct "no skills yet" state, so create it before every spawn.
  await mkdir(skillsDir, { recursive: true });
  args.push("--skills-dir", skillsDir);
  await mkdir(memoryDir, { recursive: true });
  args.push("--memory-dir", memoryDir);
  if (kind === "mock") {
    args.push("--mock");
  } else if (kind === "toolhive") {
    // No credential and no base-URL flag for the gateway: mecated finds the
    // loopback proxy through ToolHive's own config and registers it as the
    // "toolhive" provider on its own. Naming it as the default is all it takes.
    args.push("--default-provider", "toolhive");
  } else {
    // Any auth.yaml-configured provider (openrouter, anthropic, openai,
    // opencode, …) or a settings-defined custom provider (ADR 0238) —
    // mecated validates the id fail-fast at startup.
    args.push("--default-provider", kind);
  }
  const env = { ...process.env, MECATL_AUTH_TOKEN: managedAuthToken };
  if (gateway) {
    // Mecatl's SDK opens the optional standalone SSE notification stream after
    // initialization. Some authenticated gateways (including Connector Gateway)
    // close that GET stream and thereby cancel an otherwise valid MCP session.
    // Keep the optional stream on loopback and forward request/response traffic.
    args.push(
      "--mcp-server",
      `${gateway.name}=http://127.0.0.1:8788/mcp-proxy/${mcpProxySecret}/${encodeURIComponent(gateway.name)}`,
    );
  }
  // The lifetime pipe is best-effort: without mkfifo(1) the daemon still
  // starts, it just loses the parent-crash cleanup (SIGINT/SIGTERM reaping
  // below still covers the clean paths).
  let lifetime = null;
  try {
    lifetime = await createLifetimePipe();
    // The FIFO's read end lands at fd 3 in the child (stdio index 3 below).
    args.push("--lifetime-pipe-fd", "3");
  } catch (error) {
    process.stderr.write(
      `[supervisor] lifetime pipe unavailable (${error.message || error}); spawning without parent-crash protection\n`,
    );
  }
  const proc = spawn(binary, args, {
    cwd: mecatlDir,
    env,
    stdio: [
      "ignore",
      "ignore",
      "pipe",
      ...(lifetime ? [lifetime.readEnd.fd] : []),
    ],
  });
  child = proc;
  if (lifetime) {
    // The child owns its duplicate of the read end now; the controller keeps
    // ONLY the write end, open and never written to, until this child exits.
    void lifetime.readEnd.close().catch(() => undefined);
    const writeEnd = lifetime.writeEnd;
    const releaseWriteEnd = () => void writeEnd.close().catch(() => undefined);
    proc.once("exit", releaseWriteEnd);
    proc.once("error", releaseWriteEnd);
  }
  proc.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    startupLog = (startupLog + text).slice(-24_000);
    process.stderr.write(`[mecatl] ${text}`);
  });
  proc.once("exit", () => {
    if (child === proc) child = null;
    if (!expectedExits.has(proc)) scheduleMecatlRestart();
  });
  provider = providerLabel(kind);
  // The ready file replaces the old connect-poll + stability window: it is
  // written atomically and only after composition and every listener are up,
  // so its appearance IS readiness and its http_address arrives resolved.
  let doc;
  try {
    doc = await waitForReadyDoc(proc);
  } catch (error) {
    throw startupFailure(kind, error.message || "mecatl did not become ready");
  }
  mecatlBaseURL = `http://${doc.http_address}`;
  readyInfo = {
    apiMajor: Number(doc.api_major ?? 0),
    features: Array.isArray(doc.features)
      ? doc.features.filter((feature) => typeof feature === "string")
      : [],
    deployment: typeof doc.deployment === "string" ? doc.deployment : "",
  };
  // MCP gateway construction happens during composition, BEFORE the ready
  // file is written — so when the daemon came up degraded rather than dead,
  // the handshake failure is already in the startup log.
  if (gateway && /Unauthorized/i.test(startupLog)) {
    throw new Error(
      "MCP Gateway rejected the bearer token (Unauthorized). Paste a current gateway access token and try again.",
    );
  }
  if (
    gateway &&
    /MCP manager construction failed|no servers could be connected/i.test(
      startupLog,
    )
  ) {
    throw new Error(
      "MCP Gateway could not be initialized. Check that the URL is a Streamable HTTP endpoint and that its credential is valid.",
    );
  }
  restartFailures = 0;
}

const server = http.createServer(async (request, response) => {
  const requestURL = new URL(request.url, "http://127.0.0.1:8788");
  const mcpProxyPrefix = `/mcp-proxy/${mcpProxySecret}/`;
  if (
    !requestIsAllowed(request, requestURL, { allowedOrigins, mcpProxyPrefix })
  ) {
    jsonError(response, 403, "request origin is not allowed");
    return;
  }
  if (requestURL.pathname.startsWith("/mecatl/")) {
    try {
      const body =
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await readBody(request);
      const headers = {};
      for (const key of [
        "content-type",
        "accept",
        "mcp-session-id",
        "mcp-protocol-version",
        "last-event-id",
      ]) {
        if (request.headers[key]) headers[key] = request.headers[key];
      }
      const path =
        requestURL.pathname.slice("/mecatl".length) + requestURL.search;
      const upstream = await fetchMecatl(path, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
      });
      response.statusCode = upstream.status;
      for (const key of [
        "content-type",
        "cache-control",
        "mcp-session-id",
        "www-authenticate",
      ]) {
        const value = upstream.headers.get(key);
        if (value) response.setHeader(key, value);
      }
      if (upstream.body)
        for await (const chunk of upstream.body) response.write(chunk);
      response.end();
    } catch (error) {
      jsonError(
        response,
        error.statusCode || 502,
        error.message || "mecated proxy failed",
      );
    }
    return;
  }
  if (requestURL.pathname.startsWith(mcpProxyPrefix)) {
    const proxyName = decodeURIComponent(
      requestURL.pathname.slice(mcpProxyPrefix.length),
    );
    if (!gateway || proxyName !== gateway.name) {
      response.statusCode = 404;
      response.end("gateway not configured");
      return;
    }
    if (request.method === "GET") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      response.write(": loopback notification channel\n\n");
      const heartbeat = setInterval(
        () => response.write(": keepalive\n\n"),
        15_000,
      );
      request.once("close", () => clearInterval(heartbeat));
      return;
    }
    if (!["POST", "DELETE"].includes(request.method || "")) {
      response.statusCode = 405;
      response.end("method not allowed");
      return;
    }
    try {
      const requestBody =
        request.method === "POST" ? await readBody(request) : undefined;
      await refreshGatewayAccessToken(false);
      const headers = { Authorization: `Bearer ${gateway.token}` };
      for (const key of [
        "content-type",
        "accept",
        "mcp-session-id",
        "mcp-protocol-version",
        "last-event-id",
      ]) {
        if (request.headers[key]) headers[key] = request.headers[key];
      }
      let upstream = await fetch(gateway.url, {
        method: request.method,
        headers,
        body: requestBody,
      });
      if (upstream.status === 401 && gateway.refreshToken) {
        await upstream.arrayBuffer();
        await refreshGatewayAccessToken(true);
        headers.Authorization = `Bearer ${gateway.token}`;
        upstream = await fetch(gateway.url, {
          method: request.method,
          headers,
          body: requestBody,
        });
      }
      process.stderr.write(
        `[mcp-proxy] ${request.method} ${upstream.status} ${upstream.headers.get("content-type") || ""}\n`,
      );
      response.statusCode = upstream.status;
      for (const key of [
        "content-type",
        "cache-control",
        "mcp-session-id",
        "www-authenticate",
      ]) {
        const value = upstream.headers.get(key);
        if (value) response.setHeader(key, value);
      }
      if (upstream.body) {
        for await (const chunk of upstream.body) response.write(chunk);
      }
      response.end();
    } catch (error) {
      process.stderr.write(
        `[mcp-proxy] ${request.method} failed: ${error.message || error}\n`,
      );
      jsonError(
        response,
        error.statusCode || 502,
        error.message || "gateway proxy failed",
      );
    }
    return;
  }
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  if (request.method === "GET" && requestURL.pathname === "/mcp/oauth/start") {
    try {
      const name = requestURL.searchParams.get("name") || "";
      const gatewayURL = new URL(requestURL.searchParams.get("url") || "");
      if (!/^[A-Za-z0-9_]+$/.test(name))
        throw new Error(
          "Gateway name may contain only letters, numbers, and underscores",
        );
      if (gatewayURL.protocol !== "https:")
        throw new Error("OAuth gateways must use HTTPS");
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
      if (!registrationResponse.ok)
        throw new Error(
          registration.error_description ||
            registration.error ||
            "Gateway refused OAuth client registration",
        );
      if (!registration.client_id)
        throw new Error("Gateway registration did not return a client ID");
      const state = randomBytes(24).toString("base64url");
      const verifier = randomBytes(48).toString("base64url");
      const challenge = createHash("sha256")
        .update(verifier)
        .digest("base64url");
      const scope = registration.scope || discovery.scope;
      oauthAttempts.set(state, {
        name,
        url: gatewayURL.toString(),
        clientId: registration.client_id,
        tokenEndpoint: discovery.tokenEndpoint,
        scope,
        resource: discovery.resource,
        verifier,
        expires: Date.now() + 10 * 60_000,
      });
      const authorizationURL = new URL(discovery.authorizationEndpoint);
      authorizationURL.searchParams.set("response_type", "code");
      authorizationURL.searchParams.set("client_id", registration.client_id);
      authorizationURL.searchParams.set("redirect_uri", oauthRedirectUri);
      authorizationURL.searchParams.set("scope", scope);
      if (discovery.resource)
        authorizationURL.searchParams.set("resource", discovery.resource);
      authorizationURL.searchParams.set("state", state);
      authorizationURL.searchParams.set("code_challenge", challenge);
      authorizationURL.searchParams.set("code_challenge_method", "S256");
      if (requestURL.searchParams.get("redirect") === "1") {
        response.writeHead(302, { Location: authorizationURL.toString() });
        response.end();
      } else {
        response.end(
          JSON.stringify({ authorizationUrl: authorizationURL.toString() }),
        );
      }
    } catch (error) {
      response.statusCode = 400;
      response.end(
        JSON.stringify({
          error: error.message || "Could not start gateway sign-in",
        }),
      );
    }
    return;
  }
  if (request.method === "GET" && requestURL.pathname === "/oauth/callback") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    const state = requestURL.searchParams.get("state") || "";
    const attempt = oauthAttempts.get(state);
    oauthAttempts.delete(state);
    try {
      if (requestURL.searchParams.get("error"))
        throw new Error(
          requestURL.searchParams.get("error_description") ||
            requestURL.searchParams.get("error"),
        );
      if (!attempt || attempt.expires < Date.now())
        throw new Error(
          "The gateway sign-in attempt expired. Start it again from Mecatl Studio.",
        );
      const code = requestURL.searchParams.get("code");
      if (!code)
        throw new Error("Gateway sign-in did not return an authorization code");
      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: attempt.clientId,
        redirect_uri: oauthRedirectUri,
        code_verifier: attempt.verifier,
      });
      if (attempt.resource) tokenBody.set("resource", attempt.resource);
      const tokenResponse = await fetch(attempt.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody,
        signal: AbortSignal.timeout(15_000),
      });
      const tokenResult = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokenResult.access_token)
        throw new Error(
          tokenResult.error_description ||
            tokenResult.error ||
            "Gateway token exchange failed",
        );
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
          expiresAt:
            Date.now() +
            Math.max(60, Number(tokenResult.expires_in) || 300) * 1000,
        };
        try {
          await startMecatl(preferredKind());
        } catch (error) {
          gateway = previousGateway;
          await startMecatl(preferredKind());
          throw error;
        }
      });
      response.end(
        `<!doctype html><title>Mecatl Gateway Connected</title><style>body{font:16px system-ui;padding:40px;color:#25231f}</style><h1>Gateway connected</h1><p>You can close this window.</p><script>window.opener?.postMessage({type:"mecatl-mcp-oauth",ok:true},${JSON.stringify(studioPublicOrigin)});setTimeout(()=>window.close(),700)</script>`,
      );
    } catch (error) {
      const message = String(error.message || "Gateway sign-in failed").replace(
        /[<>&"']/g,
        "",
      );
      process.stderr.write(`[oauth] callback failed: ${message}\n`);
      response.statusCode = 400;
      response.end(
        `<!doctype html><title>Mecatl Gateway Error</title><style>body{font:16px system-ui;padding:40px;color:#25231f}</style><h1>Could not connect</h1><p>${message}</p><script>window.opener?.postMessage({type:"mecatl-mcp-oauth",ok:false,error:${JSON.stringify(message)}},${JSON.stringify(studioPublicOrigin)})</script>`,
      );
    }
    return;
  }
  if (
    request.method === "POST" &&
    requestURL.pathname === "/mcp/oauth/refresh"
  ) {
    try {
      if (!gateway?.refreshToken)
        throw new Error("Gateway does not have a refresh token; sign in again");
      await refreshGatewayAccessToken(true);
      response.end(JSON.stringify({ ok: true }));
    } catch (error) {
      response.statusCode = 400;
      response.end(
        JSON.stringify({
          error: error.message || "Gateway token refresh failed",
        }),
      );
    }
    return;
  }
  // Restart mecated with the CURRENT provider, gateway and router config. The
  // daemon resolves skills and agent definitions once at startup (ListSkills is
  // a pure snapshot read), so a newly authored SKILL.md only reaches the model
  // after a restart. Provider credentials remain owned by mecated's auth file.
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
    const configuredProviders = await listSelectableProviderNames();
    response.end(
      JSON.stringify({
        mode: "managed",
        provider,
        isMock: provider === "offline mock",
        running: Boolean(child),
        startupError,
        authFile,
        // Where a custom `providers:` block lands (ADR 0238): the imported
        // operator-settings.yaml when one is active (a CLI-tier file wins
        // that section whole-block), otherwise the user-global settings.
        settingsFile: operatorSettingsActive
          ? operatorSettingsFile
          : userSettingsFile,
        // The child's ready-file compatibility descriptor (never a
        // credential): api_major, feature identifiers, and the operator's
        // deployment label, verbatim from mecated-ready/1.
        apiMajor: readyInfo?.apiMajor ?? null,
        features: readyInfo?.features ?? [],
        deployment: readyInfo?.deployment ?? "",
        // Names only — never values. What MECATL_STUDIO_PROVIDER / the
        // /providers/active switch may select among (auth.yaml blocks plus
        // settings-defined custom providers), and which one is active right
        // now, if any.
        configuredProviders,
        selectedProvider: activeProviderOverride,
        // The client has no other way to learn this: it is resolved from THIS
        // file's location, so a clone anywhere works with no source edit.
        workspace,
        gateway: gateway ? { name: gateway.name, url: gateway.url } : null,
        toolhiveGateway: {
          available: toolhiveReady,
          baseURL: toolhiveGatewayURL,
          active: provider === "ToolHive LLM gateway",
        },
        modelRouter: modelRouterConfig
          ? {
              enabled: modelRouterConfig.enabled,
              categories: modelRouterConfig.categories.length,
            }
          : null,
        operatorSettings: operatorSettingsActive,
        skills: { dir: skillsDir, scope: "project" },
        memory: { dir: memoryDir, scope: "project" },
      }),
    );
    return;
  }
  if (request.method !== "POST" || requestURL.pathname !== "/mcp") {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }
  try {
    if (
      !String(request.headers["content-type"] || "")
        .toLowerCase()
        .startsWith("application/json")
    ) {
      throw Object.assign(new Error("Content-Type must be application/json"), {
        statusCode: 415,
      });
    }
    const input = JSON.parse(
      (await readBody(request, 16_384)).toString("utf8"),
    );
    if (!/^[A-Za-z0-9_]+$/.test(input.name || ""))
      throw new Error(
        "Gateway name may contain only letters, numbers, and underscores",
      );
    const parsed = validateGatewayURL(input.url, {
      allowLoopbackHTTP: process.env.MECATL_ALLOW_INSECURE_LOOPBACK_MCP === "1",
    });
    const token =
      typeof input.token === "string"
        ? input.token.trim().replace(/^Bearer\s+/i, "")
        : "";
    const candidate = { name: input.name, url: parsed.toString(), token };
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
    response.end(
      JSON.stringify({
        ok: true,
        gateway: { name: gateway.name, url: gateway.url },
      }),
    );
  } catch (error) {
    jsonError(
      response,
      error.statusCode || 400,
      error.message || "Could not update the Mecatl controller",
    );
  }
});

server.listen(8788, "127.0.0.1", async () => {
  process.stdout.write("Mecatl local controller: http://127.0.0.1:8788\n");
  operatorSettingsActive = await hasOperatorSettings();
  modelRouterConfig = await loadModelRouter();
  toolhiveReady = await detectToolhiveGateway();
  process.stdout.write(
    toolhiveReady
      ? `ToolHive LLM gateway detected at ${toolhiveGatewayURL}\n`
      : `ToolHive LLM gateway not reachable at ${toolhiveGatewayURL} (start it with "thv llm proxy start"); falling back to the offline mock\n`,
  );
  try {
    await startMecatl(preferredKind());
  } catch (error) {
    startupError ||= error.message || "mecated could not start";
    process.stderr.write(`${startupError}\n`);
  }
});

// Clean-exit reaping. The CRASH path needs none of this: the lifetime pipe's
// write end dies with this process — SIGKILL included — and mecated reads EOF
// and shuts itself down, so a controller crash can no longer orphan a daemon.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    shuttingDown = true;
    if (restartTimer) clearTimeout(restartTimer);
    await stopChild();
    server.close(() => process.exit(0));
  });
}
