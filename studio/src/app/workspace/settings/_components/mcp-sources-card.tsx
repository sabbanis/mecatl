"use client";

import { McpSourcesList } from "@/components/mcp/mcp-sources-list";
import { useMcpInventory } from "@/features/agent/hooks/use-mcp-inventory";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { Note, OfflineNote, SettingsCard } from "./settings-card";

export const MCP_NO_INVENTORY_TEXT = "This daemon reports no MCP inventory.";
export const MCP_BROKER_ONLY_TEXT =
  "This daemon serves MCP tools through its broker. Open a chat's MCP tools panel to see that chat's connectors.";

/**
 * Settings → MCP tools: the daemon's resolved MCP sources — static endpoints
 * and ToolHive discovery, the servers each contributed, the per-server skip
 * reasons, and the ToolHive groups — with a manual refresh (mecatui's
 * `/mcp` panel, read-only). Sits above the gateway connect form, which stays
 * the one place a managed daemon's gateway is configured.
 *
 * Gated on `serverCapabilities.mcp`. A daemon granting only
 * `mcp_connector_status` never receives the direct source read (the TUI
 * invariant) and is pointed at the chat panel's broker view instead; a
 * daemon with neither says so plainly. Never hides the gateway form.
 */
export function McpSourcesCard() {
  const { connected, serverCapabilities } = useRuntimeStatus();
  const mcp = serverCapabilities.mcp === true;
  const brokerOnly = !mcp && serverCapabilities.mcp_connector_status === true;
  const inventory = useMcpInventory({ enabled: connected && mcp });

  let body: React.ReactNode;
  if (!connected) {
    body = <OfflineNote />;
  } else if (mcp) {
    body = <McpSourcesList view={inventory} />;
  } else if (brokerOnly) {
    body = <Note>{MCP_BROKER_ONLY_TEXT}</Note>;
  } else {
    body = <Note>{MCP_NO_INVENTORY_TEXT}</Note>;
  }

  return (
    <SettingsCard
      title="MCP tools"
      description="The MCP servers the daemon resolved at startup, by source, and the ToolHive groups it discovers."
    >
      {body}
    </SettingsCard>
  );
}
