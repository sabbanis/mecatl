import "server-only";

import { resolveExternalAuthorization } from "@/lib/oidc-session";
import { requestIsTrusted } from "@/lib/request-trust";

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
const externalBaseURL = () =>
  process.env.MECATL_BASE_URL?.trim().replace(/\/$/, "") || "";

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
// shell tool is rooted at. It is resolved server-side (managed: from the
// controller's /status; external: from MECATL_WORKSPACE) so a machine-specific
// absolute path never reaches the client bundle, and so the browser can never
// choose it.
//
// SERVER-ASSIGNED deployments (ADR 0237): a daemon with a network-facing
// listener assigns the workspace itself and REJECTS any non-empty client
// workspace with 400 "deployment assigns the workspace". Against such a
// daemon, leave MECATL_WORKSPACE unset in external mode — an unset value
// deliberately injects nothing, which is the correct empty-workspace create.
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
    // Bearer injection (rule 3 — credentials never come from the browser):
    // an OIDC-configured deployment injects the CURRENT access token
    // (refreshed server-side on demand, requirement H3); without OIDC config
    // this is the static MECATL_AUTH_TOKEN path, unchanged. A signed-out or
    // expired OIDC session answers 401 with actionable copy instead of
    // forwarding a request the daemon would reject opaquely.
    const auth = await resolveExternalAuthorization();
    if (auth.kind === "unauthorized")
      return Response.json(
        { error: auth.error, code: auth.code },
        { status: auth.status },
      );
    if (auth.kind === "unavailable")
      return Response.json({ error: auth.error }, { status: auth.status });
    if (auth.kind === "bearer")
      headers.set("authorization", `Bearer ${auth.token}`);
  } else {
    headers.set("x-mecatl-studio-request", "1");
  }

  let bodyOverride: BodyInit | undefined;
  let injectedWorkspace = false;
  if (
    request.method === "POST" &&
    workspaceInjectionPaths.has(path.join("/"))
  ) {
    bodyOverride = await withWorkspace(request, external);
    if (typeof bodyOverride === "string") {
      headers.set("content-type", "application/json");
      injectedWorkspace = bodyOverride.includes('"workspace"');
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
  const response = await forward(request, target, headers, bodyOverride);
  // A server-assigned deployment refusing OUR injected workspace is a
  // configuration problem this tier created — name the fix instead of
  // relaying a bare 400 the user cannot act on (ADR 0237).
  if (injectedWorkspace && response.status === 400) {
    try {
      const clone = response.clone();
      const body = (await clone.json()) as { error?: string };
      if (body.error?.includes("deployment assigns the workspace")) {
        return Response.json(
          {
            ...body,
            error: `${body.error} — this deployment assigns its own workspace: unset MECATL_WORKSPACE in Studio's environment so creates are sent workspace-free.`,
          },
          { status: 400 },
        );
      }
    } catch {
      // Not JSON — relay untouched.
    }
  }
  return response;
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
