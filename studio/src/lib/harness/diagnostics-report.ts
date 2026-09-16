/**
 * The `/diagnostics` report — Studio's rendering of the TUI's
 * `diagnosticsReport` (cmd/mecatui/ui/diagnostics.go). It is the ONE
 * built-in whose output reaches the model, so every field is sanitized
 * before it is written: tokens are bounded and character-restricted,
 * endpoints keep only scheme + host + clean path. Anything that fails the
 * check reads "unavailable" — never the raw value.
 *
 * Pure functions; the caller gathers the inputs from runtime status, the
 * server-info probe and the session's resolved model.
 */

const UNAVAILABLE = "unavailable";

/**
 * A short opaque identifier (build id, provider id, model id, mode): at most
 * 128 characters of `[A-Za-z0-9._/+-]`, else "unavailable". Mirrors the
 * TUI's `diagnosticToken` byte for byte.
 */
export function diagnosticToken(value: string | undefined | null): string {
  const trimmed = (value ?? "").trim();
  if (trimmed === "" || trimmed.length > 128) return UNAVAILABLE;
  return /^[A-Za-z0-9._/+-]+$/.test(trimmed) ? trimmed : UNAVAILABLE;
}

/** Collapses `.`/`..` segments and repeated slashes the way `path.Clean` does. */
function cleanPath(pathname: string): string {
  const out: string[] = [];
  for (const segment of pathname.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return `/${out.join("/")}`;
}

/**
 * An endpoint reduced to `scheme://host/clean-path`: userinfo, query and
 * fragment are dropped, control characters or an unparsable/hostless URL
 * read "unavailable". Mirrors the TUI's `diagnosticEndpoint`.
 */
export function diagnosticEndpoint(value: string | undefined | null): string {
  const raw = value ?? "";
  if (raw === "" || raw.length > 2048) return UNAVAILABLE;
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return UNAVAILABLE;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return UNAVAILABLE;
  }
  // `new URL` accepts scheme-only forms (`mailto:x`); the report wants a
  // network host, as the TUI's `u.Host == ""` check demands.
  if (!url.protocol || !url.host || !url.hostname) return UNAVAILABLE;
  const scheme = url.protocol.replace(/:$/, "").toLowerCase();
  return `${scheme}://${url.host}${cleanPath(url.pathname)}`;
}

export interface DiagnosticsReportInput {
  /** `navigator.userAgentData?.platform`, else "browser". */
  platform: string;
  /** `process.env.NEXT_PUBLIC_STUDIO_BUILD` when the build stamps one. */
  clientBuild: string;
  /** How Studio reaches the daemon (runtime status). */
  mode: "managed" | "external";
  /** GET /v1/info (ADR 0245); null against an older daemon. */
  serverInfo: {
    buildId: string;
    serverImplementation: string;
    providerEndpoint: string;
  } | null;
  /** Operator-set deployment label ("" when unset). */
  deployment: string;
  /** The session's resolved provider/model (GET-session echo); null when
   *  the daemon reports none or there is no session yet. */
  resolvedModel: { providerId: string; modelId: string } | null;
  /** Studio's permission-mode vocabulary. */
  permissionMode: string;
}

/**
 * The report's documented line set, in order:
 *
 *   Mecatl diagnostics (current client state only):
 *   platform: …
 *   client build: …
 *   server mode: managed|external
 *   server build: …
 *   server implementation: …
 *   LLM provider endpoint: …
 *   deployment: …
 *   active provider: …
 *   active model: …
 *   permission mode: …
 */
export function buildDiagnosticsReport(input: DiagnosticsReportInput): string {
  return [
    "Mecatl diagnostics (current client state only):",
    `platform: ${diagnosticToken(input.platform)}`,
    `client build: ${diagnosticToken(input.clientBuild)}`,
    `server mode: ${input.mode === "external" ? "external" : "managed"}`,
    `server build: ${diagnosticToken(input.serverInfo?.buildId)}`,
    `server implementation: ${diagnosticToken(input.serverInfo?.serverImplementation)}`,
    `LLM provider endpoint: ${diagnosticEndpoint(input.serverInfo?.providerEndpoint)}`,
    `deployment: ${diagnosticToken(input.deployment)}`,
    `active provider: ${diagnosticToken(input.resolvedModel?.providerId)}`,
    `active model: ${diagnosticToken(input.resolvedModel?.modelId)}`,
    `permission mode: ${diagnosticToken(input.permissionMode)}`,
  ].join("\n");
}

/** The browser's coarse platform hint, as the report wants it. */
export function browserPlatform(): string {
  if (typeof navigator === "undefined") return "browser";
  const data = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData;
  const platform = data?.platform?.trim();
  return platform ? platform : "browser";
}
