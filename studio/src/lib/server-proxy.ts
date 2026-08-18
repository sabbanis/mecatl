import "server-only";

const controllerBaseURL = "http://127.0.0.1:8788";
const forwardedRequestHeaders = [
  "accept",
  "content-type",
  "last-event-id",
  "mcp-protocol-version",
  "mcp-session-id",
];
const forwardedResponseHeaders = [
  "cache-control",
  "content-type",
  "mcp-session-id",
  "www-authenticate",
];
const studioOrigins = () =>
  new Set(
    (
      process.env.MECATL_STUDIO_PUBLIC_ORIGIN ||
      "http://localhost:3000,http://127.0.0.1:3000"
    )
      .split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );

const externalBaseURL = () =>
  process.env.MECATL_BASE_URL?.trim().replace(/\/$/, "") || "";

function requestIsTrusted(request: Request) {
  const allowed = studioOrigins();
  const requestURL = new URL(request.url);
  const host = request.headers.get("host") || requestURL.host;
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim();
  const protocol =
    forwardedProtocol === "https" || forwardedProtocol === "http"
      ? `${forwardedProtocol}:`
      : requestURL.protocol;
  const requestOrigin = `${protocol}//${host}`;
  const browserOrigin = request.headers.get("origin");
  return (
    allowed.has(requestOrigin) && (!browserOrigin || allowed.has(browserOrigin))
  );
}

function forbidden() {
  return Response.json(
    { error: "request origin is not allowed" },
    { status: 403 },
  );
}

function copyRequestHeaders(request: Request) {
  const headers = new Headers();
  for (const name of forwardedRequestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function copyResponse(upstream: Response) {
  const headers = new Headers();
  for (const name of forwardedResponseHeaders) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

async function forward(
  request: Request,
  target: URL,
  headers: Headers,
  bodyOverride?: BodyInit,
) {
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody
        ? (bodyOverride ?? (await request.arrayBuffer()))
        : undefined,
      cache: "no-store",
      redirect: "manual",
    });
    return copyResponse(upstream);
  } catch {
    return Response.json(
      { error: "The Mecatl service is unavailable. It may be restarting." },
      { status: 503 },
    );
  }
}

// Session and team creation require a workspace — the directory every file and
// shell tool is rooted at — and the daemon rejects a create without one. It is
// resolved server-side (managed: from the controller's /status; external: from
// MECATL_WORKSPACE) so a machine-specific absolute path never reaches the
// client bundle, and so the browser can never choose it.
const workspaceInjectionPaths = new Set([
  "v1/sessions",
  "v1/teams",
  "v1/schedules",
]);

async function resolveWorkspace(external: string): Promise<string> {
  if (external) return process.env.MECATL_WORKSPACE?.trim() || "";
  try {
    const response = await fetch(`${controllerBaseURL}/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return "";
    const status = (await response.json()) as { workspace?: unknown };
    return typeof status.workspace === "string" ? status.workspace : "";
  } catch {
    return "";
  }
}

async function withWorkspace(
  request: Request,
  external: string,
): Promise<BodyInit | undefined> {
  try {
    const raw = await request.text();
    const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return raw;
    }
    if (!body.workspace) {
      const workspace = await resolveWorkspace(external);
      if (workspace) body.workspace = workspace;
    }
    return JSON.stringify(body);
  } catch {
    // Not JSON: forward untouched and let the daemon reject it.
    return undefined;
  }
}

export async function proxyMecatl(request: Request, path: string[]) {
  if (!requestIsTrusted(request)) return forbidden();
  const external = externalBaseURL();
  const base = external || `${controllerBaseURL}/mecatl`;
  const target = new URL(`${base}/${path.map(encodeURIComponent).join("/")}`);
  target.search = new URL(request.url).search;
  const headers = copyRequestHeaders(request);
  if (external) {
    const token = process.env.MECATL_AUTH_TOKEN?.trim();
    if (token)
      headers.set(
        "authorization",
        `Bearer ${token.replace(/^Bearer\s+/i, "")}`,
      );
  } else {
    headers.set("x-mecatl-studio-request", "1");
  }

  let bodyOverride: BodyInit | undefined;
  if (
    request.method === "POST" &&
    workspaceInjectionPaths.has(path.join("/"))
  ) {
    bodyOverride = await withWorkspace(request, external);
    if (typeof bodyOverride === "string") {
      headers.set("content-type", "application/json");
    }
  }
  // Slash-command discovery scans the workspace's command directories; the
  // workspace is a query parameter there, injected here for the same reason
  // it is injected into session bodies.
  if (
    request.method === "GET" &&
    path.join("/") === "v1/commands" &&
    !target.searchParams.get("workspace")
  ) {
    const workspace = await resolveWorkspace(external);
    if (workspace) target.searchParams.set("workspace", workspace);
  }
  return forward(request, target, headers, bodyOverride);
}

export async function proxyControl(request: Request, path: string[]) {
  if (!requestIsTrusted(request)) return forbidden();
  const external = externalBaseURL();
  if (external) {
    if (request.method === "GET" && path.join("/") === "status") {
      return Response.json({
        mode: "external",
        provider: "external daemon",
        running: true,
        workspace: process.env.MECATL_WORKSPACE?.trim() || "",
        gateway: null,
        modelRouter: null,
        operatorSettings: true,
        skills: null,
        memory: null,
      });
    }
    return Response.json(
      { error: "This setting is owned by the external mecated deployment." },
      { status: 409 },
    );
  }

  const target = new URL(
    `${controllerBaseURL}/${path.map(encodeURIComponent).join("/")}`,
  );
  target.search = new URL(request.url).search;
  const headers = copyRequestHeaders(request);
  headers.set("x-mecatl-studio-request", "1");
  return forward(request, target, headers);
}
