"use client";

import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { GatewaySection } from "../_components/gateway-section";
import { McpDiscoveryCard } from "../_components/mcp-discovery-card";
import { McpSourcesCard } from "../_components/mcp-sources-card";
import { RuntimeStatusLine } from "../_components/runtime-status-line";

export default function GatewaySettingsPage() {
  const runtime = useHarnessRuntime();
  return (
    <>
      <RuntimeStatusLine runtime={runtime} />
      <McpSourcesCard />
      {/* The managed daemon's discovery FLAGS (--toolhive, --toolhive-group,
          --mcp-resource-tools, --mcp-prompts) under the inventory they shape. */}
      <McpDiscoveryCard />
      <GatewaySection runtime={runtime} />
    </>
  );
}
