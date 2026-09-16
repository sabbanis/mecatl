/**
 * Compatibility shim for the SDK's MCP authorization control requests.
 *
 * The daemon's recheck/cancel routes are correlation-only: `controlRequestBodyEmpty`
 * (internal/adapter/server/http.go) reads ONE byte and answers 400 "MCP
 * authorization controls do not accept a request body" to anything at all.
 * SDK 0.2.0 classifies both routes as `requestBody: "json"`, so its HTTP
 * transport posts the literal `{}`. Until the SDK ships `requestBody: "none"`
 * for them (sdk/typescript/src/rpc-catalog.ts), Studio strips that empty
 * object — and ONLY that, on ONLY those two routes — before the request
 * leaves the browser. A fixed SDK sends no body and this becomes a no-op.
 */

const CONTROL_ROUTE =
  /\/v1\/sessions\/[^/?#]+\/mcp-authorizations\/[^/?#]+\/(?:recheck|cancel)$/;

function pathOf(input: RequestInfo | URL): string {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.pathname
        : input.url;
  // A relative proxy URL ("/api/mecatl/v1/...") is not parseable by URL().
  const withoutQuery = raw.split(/[?#]/, 1)[0] ?? raw;
  return withoutQuery.replace(/^[a-z]+:\/\/[^/]+/i, "");
}

/**
 * Returns `init` unchanged except when it is the SDK's empty-object POST to an
 * MCP authorization control route, in which case the body and its
 * content-type are removed.
 */
export function stripMcpAuthorizationControlBody(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): RequestInit | undefined {
  if (!init || init.body !== "{}") return init;
  if ((init.method ?? "GET").toUpperCase() !== "POST") return init;
  if (!CONTROL_ROUTE.test(pathOf(input))) return init;
  const headers = new Headers(init.headers);
  headers.delete("content-type");
  const { body: _body, ...rest } = init;
  return { ...rest, headers };
}
