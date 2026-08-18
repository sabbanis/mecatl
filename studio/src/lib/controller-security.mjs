export function isLoopbackHost(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

export function requestIsAllowed(
  request,
  requestURL,
  { allowedOrigins, mcpProxyPrefix },
) {
  let host;
  try {
    host = new URL(`http://${request.headers.host || ""}`).hostname;
  } catch {
    return false;
  }
  if (!isLoopbackHost(host)) return false;
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return false;

  const callback =
    request.method === "GET" && requestURL.pathname === "/oauth/callback";
  const internalMCP = requestURL.pathname.startsWith(mcpProxyPrefix);
  const readOnly =
    request.method === "GET" &&
    ["/status", "/model-router"].includes(requestURL.pathname);
  return (
    callback ||
    internalMCP ||
    readOnly ||
    request.headers["x-mecatl-studio-request"] === "1"
  );
}

export function validateGatewayURL(value, { allowLoopbackHTTP = false } = {}) {
  const parsed = new URL(value);
  if (parsed.username || parsed.password)
    throw new Error("Gateway URLs must not contain credentials");
  if (parsed.protocol === "https:") return parsed;
  if (
    parsed.protocol === "http:" &&
    isLoopbackHost(parsed.hostname) &&
    allowLoopbackHTTP
  )
    return parsed;
  throw new Error(
    "Gateway URLs must use HTTPS. Loopback HTTP requires MECATL_ALLOW_INSECURE_LOOPBACK_MCP=1 on the controller.",
  );
}
