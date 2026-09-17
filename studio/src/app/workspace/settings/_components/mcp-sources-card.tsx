"use client";

import { Loader2, RotateCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type McpInventoryView,
  useMcpInventory,
} from "@/features/agent/hooks/use-mcp-inventory";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import type { McpSourceView } from "@/lib/harness/mcp";
import { SettingsCard } from "./settings-card";

export const MCP_SNAPSHOT_TEXT =
  "Tools added since the agent started appear after you refresh.";
export const MCP_UPDATED_TEXT = "Up to date.";
const MCP_REFRESHING_TEXT = "Refreshing…";

/**
 * Settings → MCP tools: the tools the agent can use, as a plain list — each
 * source under a readable name with whether it is on, the tool names it
 * contributed, and a one-line count of anything that could not be
 * connected. The same inventory the chat's MCP tools panel reads, without
 * the technical detail (kinds, transports, addresses, groups) an office
 * user has no use for.
 *
 * The card exists only when there is something to list. Gated on
 * `serverCapabilities.mcp`: an agent without it (a broker-only agent
 * granting just `mcp_connector_status` included) never receives the direct
 * source read and gets no card — no placeholder sentence either — and the
 * same goes for offline, the first read still in flight, and an empty list.
 * A FAILED read keeps the card, so the failure is visible and Refresh can
 * retry it. Never hides the gateway form below.
 */
export function McpSourcesCard() {
  const { connected, serverCapabilities } = useRuntimeStatus();
  const mcp = serverCapabilities.mcp === true;
  const inventory = useMcpInventory({ enabled: connected && mcp });

  if (!connected || !mcp || inventory.isLoading) return null;
  if (!inventory.error && inventory.sources.length === 0) return null;

  return (
    <SettingsCard title="MCP tools">
      <ToolsList view={inventory} />
    </SettingsCard>
  );
}

/** A readable name for a source the agent reports as "static" or "toolhive(<group>)". */
function sourceLabel(source: McpSourceView): string {
  if (source.kind === "static") return "Connected tools";
  if (source.kind === "toolhive") return "ToolHive";
  return source.name;
}

function statusText(
  view: Pick<McpInventoryView, "refreshing" | "refreshed">,
): string {
  if (view.refreshing) return MCP_REFRESHING_TEXT;
  if (view.refreshed) return MCP_UPDATED_TEXT;
  return MCP_SNAPSHOT_TEXT;
}

function skippedText(count: number): string {
  return count === 1
    ? "One tool couldn't be connected."
    : `${count} tools couldn't be connected.`;
}

function SourceRow({ source }: { source: McpSourceView }) {
  const tools = source.servers.filter((server) => server.name.trim() !== "");
  const skipped = source.diagnostics.length;
  return (
    <li className="py-3 first:pt-0 last:pb-0" data-testid="mcp-source">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{sourceLabel(source)}</span>
        <Badge variant={source.enabled ? "success" : "muted"}>
          {source.enabled ? "On" : "Off"}
        </Badge>
      </div>
      {tools.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {tools.map((server) => (
            <li key={`${server.name}:${server.url}`} data-testid="mcp-server">
              {server.name}
            </li>
          ))}
        </ul>
      )}
      {skipped > 0 && (
        <p
          className="mt-2 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-400"
          data-testid="mcp-skipped"
        >
          <TriangleAlert
            className="mt-0.5 size-3 shrink-0"
            aria-hidden="true"
          />
          <span>{skippedText(skipped)}</span>
        </p>
      )}
    </li>
  );
}

function ToolsList({ view }: { view: McpInventoryView }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" data-testid="mcp-footer">
          {statusText(view)}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 text-muted-foreground"
          disabled={view.refreshing}
          onClick={() => void view.refresh()}
        >
          {view.refreshing ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RotateCw className="size-3.5" aria-hidden="true" />
          )}
          <span className="text-xs">Refresh</span>
        </Button>
      </div>
      {view.error ? (
        <p className="text-sm text-destructive break-words" role="alert">
          {view.error}
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {view.sources.map((source) => (
            <SourceRow key={source.name} source={source} />
          ))}
        </ul>
      )}
    </div>
  );
}
