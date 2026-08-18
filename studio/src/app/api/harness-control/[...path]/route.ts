/**
 * Server-side proxy to the local Mecatl Studio controller (default
 * 127.0.0.1:8788) — the sidecar that supervises `mecated` and owns the config
 * the daemon is started with: provider credential, semantic model router, and
 * the MCP gateway wiring.
 *
 * This is a SEPARATE service from the daemon itself (see /api/harness). The
 * split matters: daemon calls read and drive sessions, whereas every write here
 * RESTARTS the daemon, which drops in-flight runs.
 *
 * Local development only, same as the daemon proxy: a deployed instance has no
 * controller on loopback and these calls fail cleanly.
 */

const DEFAULT_CONTROL_URL = "http://127.0.0.1:8788";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function controlBaseUrl(): URL | null {
  const raw = process.env.MECATL_CONTROL_URL ?? DEFAULT_CONTROL_URL;
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

async function forward(request: Request, path: string[]): Promise<Response> {
  const base = controlBaseUrl();
  if (!base) {
    return Response.json(
      { error: "harness control proxy is not configured for this target" },
      { status: 502 },
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(`/${path.join("/")}`, base);
  target.search = incoming.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      signal: request.signal,
      cache: "no-store",
    });
    const text = await response.text();
    return new Response(text || null, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error: `harness controller unreachable at ${base.origin}`,
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

export const dynamic = "force-dynamic";
// A provider or gateway write restarts mecated and waits for its health probe.
export const maxDuration = 120;
