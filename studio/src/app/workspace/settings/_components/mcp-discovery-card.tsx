"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DaemonOptionsCard } from "./daemon-options-card";
import { SettingsRow } from "./settings-card";

/**
 * Settings → MCP tools → MCP discovery: the managed daemon's discovery
 * flags — ToolHive workload discovery (`--toolhive`, on by default; the
 * daemon lists ALREADY-RUNNING workloads and never starts one) and the
 * group it reads (`--toolhive-group`, "" = ToolHive's "default"), the
 * resource meta-tools (`--mcp-resource-tools`) and prompt expansion
 * (`--mcp-prompts`). What the daemon then resolved is the inventory card
 * above (mecatui's `/mcp` panel); this card is the TUI's flags.
 *
 * Every switch is a trust boundary in mecated's own words: discovered
 * workloads' tools, remote resources and server prompts all enter the model
 * context. Managed mode only; every save restarts the daemon.
 */
export function McpDiscoveryCard() {
  return (
    <DaemonOptionsCard
      title="MCP discovery"
      description="How the managed daemon finds MCP servers at startup and which MCP extras it registers. Changes restart it."
      testId="mcp-discovery"
      confirmTitle="Change MCP discovery and restart the daemon?"
      externalNote={
        <>
          Pass <code>--toolhive</code>, <code>--toolhive-group</code>,{" "}
          <code>--mcp-resource-tools</code> or <code>--mcp-prompts</code> to the
          server host&rsquo;s mecated and restart that server.
        </>
      }
    >
      {({ options, busy, update }) => (
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="ToolHive discovery"
            htmlFor="toolhive-discovery"
            description="Register the tools of the ToolHive workloads already running on this machine. Fails soft to none when no container runtime is reachable; the daemon never starts a workload. Same trust class as a static MCP endpoint."
          >
            <Switch
              id="toolhive-discovery"
              checked={options.mcp.toolhive}
              disabled={busy}
              onCheckedChange={(toolhive) => update({ mcp: { toolhive } })}
            />
          </SettingsRow>
          <SettingsRow
            label="ToolHive group"
            htmlFor="toolhive-group"
            description="The workload group to discover from. Empty means ToolHive's default group."
          >
            <Input
              id="toolhive-group"
              value={options.mcp.toolhiveGroup}
              placeholder="default"
              disabled={busy || !options.mcp.toolhive}
              spellCheck={false}
              maxLength={64}
              onChange={(event) =>
                update({ mcp: { toolhiveGroup: event.target.value } })
              }
              className="w-44 font-mono text-xs min-[500px]:w-60"
            />
          </SettingsRow>
          <SettingsRow
            label="Resource meta-tools"
            htmlFor="mcp-resource-tools"
            description="Register ListMcpResources / ReadMcpResource when a connected server exposes resources. A remote resource's contents enter the model context like any other MCP output."
          >
            <Switch
              id="mcp-resource-tools"
              checked={options.mcp.resourceTools}
              disabled={busy}
              onCheckedChange={(resourceTools) =>
                update({ mcp: { resourceTools } })
              }
            />
          </SettingsRow>
          <SettingsRow
            label="Prompt expansion"
            htmlFor="mcp-prompts"
            description="Expand /mcp__<server>__<prompt> inputs into the server-rendered prompt (snapshot taken at connect). A server prompt steers the model like a slash command."
          >
            <Switch
              id="mcp-prompts"
              checked={options.mcp.prompts}
              disabled={busy}
              onCheckedChange={(prompts) => update({ mcp: { prompts } })}
            />
          </SettingsRow>
        </div>
      )}
    </DaemonOptionsCard>
  );
}
