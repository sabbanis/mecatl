/**
 * Server-side proxy to a locally running mecatl daemon (`mecated serve`).
 *
 * The browser cannot call the daemon directly: its HTTP surface sends no CORS
 * headers, and a page served over https reaching http://127.0.0.1 additionally
 * trips Private Network Access preflights. Proxying through this route keeps
 * every daemon call same-origin.
 *
 * The daemon is only reachable from the machine it runs on, so this route is a
 * LOCAL DEVELOPMENT affordance: on a deployed instance there is no daemon at
 * 127.0.0.1 and the probe simply fails, which the chat hook treats as "no
 * harness" and falls back to mock responses.
 */

const DEFAULT_HARNESS_URL = "http://127.0.0.1:8081";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/**
 * Resolves the daemon base URL. Non-loopback targets are refused unless
 * MECATL_ALLOW_REMOTE is set: mecated exposes file, edit and shell tools, so
 * quietly proxying to an arbitrary host on the strength of one env var would be
 * a confused-deputy hole in a prototype that is also deployed publicly.
 */
function harnessBaseUrl(): URL | null {
  const raw = process.env.MECATL_URL ?? DEFAULT_HARNESS_URL;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (
    !LOOPBACK_HOSTS.has(parsed.hostname) &&
    process.env.MECATL_ALLOW_REMOTE !== "true"
  ) {
    return null;
  }
  return parsed;
}

/**
 * Session creation requires a workspace — the directory every file and shell
 * tool is rooted at — and the daemon rejects a create without one. It is
 * supplied here from MECATL_WORKSPACE so a machine-specific absolute path never
 * reaches the client bundle or the repo.
 */
async function withWorkspace(raw: string, path: string[]): Promise<string> {
  // Team creation needs it too: a run is launched as a one-member team.
  const needsWorkspace =
    path.length === 1 && (path[0] === "sessions" || path[0] === "teams");
  const workspace = process.env.MECATL_WORKSPACE;
  if (!needsWorkspace || !workspace) return raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (typeof parsed.workspace === "string" && parsed.workspace) return raw;
    return JSON.stringify({ ...parsed, workspace });
  } catch {
    return raw;
  }
}

async function forward(request: Request, path: string[]): Promise<Response> {
  const base = harnessBaseUrl();
  if (!base) {
    return Response.json(
      { error: "harness proxy is not configured for this target" },
      { status: 502 },
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(`/v1/${path.join("/")}`, base);
  target.search = incoming.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", request.headers.get("accept") ?? "application/json");
  const token = process.env.MECATL_AUTH_TOKEN;
  if (token) headers.set("authorization", `Bearer ${token}`);

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await withWorkspace(await request.text(), path);

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      signal: request.signal,
      cache: "no-store",
    });

    // Stream the response through untouched: /prompt is text/event-stream and
    // must not be collected before the client sees the first token.
    const outHeaders = new Headers();
    const responseType = response.headers.get("content-type");
    if (responseType) outHeaders.set("content-type", responseType);
    outHeaders.set("cache-control", "no-store, no-transform");
    // 204/304 must carry no body: forwarding the (empty) stream makes Chrome
    // abort the request, which shows up as a failed call even though the action
    // succeeded.
    const bodyless = response.status === 204 || response.status === 304;
    return new Response(bodyless ? null : response.body, {
      status: response.status,
      headers: outHeaders,
    });
  } catch (error) {
    // The daemon not running is the common case, not an exception: report it as
    // a clean 503 so the caller can fall back instead of surfacing a stack.
    return Response.json(
      {
        error: `harness unreachable at ${base.origin}`,
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 503 },
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function POST(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function DELETE(request: Request, context: RouteContext) {
  const { path } = await context.params;
  return forward(request, path);
}

export const dynamic = "force-dynamic";
export const maxDuration = 300;
