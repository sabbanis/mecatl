/**
 * The daemon's MCP inventory over the SDK's `client.mcp` namespace
 * (`McpInventory`) — the data behind mecatui's `/mcp` panel
 * (cmd/mecatui/ui/mcp.go): the resolved SOURCES (static endpoints and
 * ToolHive discovery, each with the servers it contributed and the per-server
 * skip reasons) and the distinct ToolHive GROUPS.
 *
 * Two capability bits gate two different inventories, and the TUI invariant
 * holds here too: `capabilities.mcp` admits these direct source/group reads;
 * `capabilities.mcp_connector_status` alone admits ONLY the per-session
 * broker connector inventory (`./enrollment` `fetchSessionConnectors`) and
 * must never trigger a source, resource or prompt RPC.
 *
 * The daemon's source inventory is a SNAPSHOT resolved at startup: a server
 * started later appears only after a manual refresh re-reads it.
 */

import type { McpConnectorStatus } from "@stacklok-oss/mecatl-sdk";
import { HarnessApiError } from "./errors";
import { getHarnessClient, harness } from "./sdk";

/** One resolved MCP server a source contributed (proto `McpServerInfo`). */
interface McpServerView {
  name: string;
  url: string;
  /** The wire transport, e.g. "streamable-http". */
  transport: string;
  /** The ToolHive group ("" for the static source). */
  group: string;
}

/** One resolved MCP source (proto `McpSource`). */
export interface McpSourceView {
  /** The source identity, e.g. "static" or "toolhive(default)". */
  name: string;
  /** The coarse kind: "static" | "toolhive" (kept open for newer daemons). */
  kind: string;
  /** Whether the source was active in the resolution. */
  enabled: boolean;
  /** The ToolHive group ("" for the static source). */
  group: string;
  servers: McpServerView[];
  /** This source's per-server skip reasons, verbatim from the daemon. */
  diagnostics: string[];
}

/**
 * Reads the resolved source inventory (`GET /v1/mcp/sources`). Every field
 * is normalised to a present value so the UI never branches on `undefined`.
 */
export async function listHarnessMcpSources(
  signal?: AbortSignal,
): Promise<McpSourceView[]> {
  const response = await harness(() =>
    getHarnessClient().mcp.listSources(
      { $typeName: "mecatl.v1.ListMcpSourcesRequest" },
      { signal },
    ),
  );
  return (response.sources ?? []).map((source) => ({
    name: source.name ?? "",
    kind: source.kind ?? "",
    enabled: source.enabled === true,
    group: source.group ?? "",
    servers: (source.servers ?? []).map((server) => ({
      name: server.name ?? "",
      url: server.url ?? "",
      transport: server.transport ?? "",
      group: server.group ?? "",
    })),
    diagnostics: (source.diagnostics ?? []).filter(
      (line) => typeof line === "string" && line.trim() !== "",
    ),
  }));
}

/**
 * Reads the distinct ToolHive groups (`GET /v1/mcp/toolhive/groups`),
 * blank entries dropped. Best-effort decoration next to the sources: a
 * caller renders "groups unavailable" on failure rather than hiding sources.
 */
export async function listHarnessToolHiveGroups(
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await harness(() =>
    getHarnessClient().mcp.listToolHiveGroups(
      { $typeName: "mecatl.v1.ListToolHiveGroupsRequest" },
      { signal },
    ),
  );
  return (response.groups ?? []).filter(
    (group) => typeof group === "string" && group.trim() !== "",
  );
}

/**
 * True for the daemon's "no MCP provider is wired" refusal
 * (`no_mcp_provider`, 412): the deployment resolved no MCP integration at
 * all, so there is nothing to list — a plain notice, not an error.
 */
export function isNoMcpProvider(error: unknown): boolean {
  return error instanceof HarnessApiError && error.code === "no_mcp_provider";
}

/** The user-facing sentence for `isNoMcpProvider`. */
export const NO_MCP_PROVIDER_TEXT = "No MCP provider is wired on this daemon.";

// ── Broker connector labels (verbatim from cmd/mecatui/ui/mcp.go) ──────────

/**
 * The connector inventory's enrollment state as the TUI words it
 * (`brokerEnrollmentLabel`). An unknown word reads "Status unavailable" —
 * never a guess about connectivity.
 */
export function enrollmentLabel(state: string): string {
  switch (state) {
    case "not_required":
      return "No setup required";
    case "not_started":
      return "No active setup";
    case "pending":
      return "Setup in progress";
    case "completed":
      return "Catalogue ready";
    default:
      return "Status unavailable";
  }
}

/**
 * One connector's catalogue state as the TUI words it
 * (`brokerCatalogueLabel`). Catalogue status is what the broker has seen of
 * the connector's tool list; it is never a live connection check.
 */
export function catalogueLabel(state: string): string {
  switch (state) {
    case "hidden":
      return "Awaiting discovery";
    case "declared":
      return "Tools declared";
    case "discovered":
      return "Tools discovered";
    default:
      return "Status unavailable";
  }
}

/**
 * The tool-count cell for one connector: the number only once the
 * catalogue is declared or discovered, else an em dash (the TUI's rule —
 * a hidden catalogue's zero is not a fact about the connector).
 */
export function connectorToolCount(
  connector: Pick<McpConnectorStatus, "catalogueState" | "toolCount">,
): string {
  return connector.catalogueState === "declared" ||
    connector.catalogueState === "discovered"
    ? String(connector.toolCount)
    : "—";
}

/**
 * The availability line for a connector inventory whose `availability` is
 * not "available": the broker itself reported it unavailable, or the daemon
 * could not say. Both are wordings, not machine tokens.
 */
export function availabilityLabel(availability: string): string {
  return availability === "unavailable"
    ? "Broker state unavailable"
    : "Status unavailable";
}
