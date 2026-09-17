"use client";

import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { RuntimeStatusLine } from "../_components/runtime-status-line";
import { ToolsOptionsCard } from "../_components/tools-options-card";

/**
 * Settings → Tools: which optional tools the managed daemon registers (the
 * Skill tool and its skills directory, slash-command templates) and the
 * Shell tool's daemon-reported status. The shell-less switch itself lives
 * on Settings → Permissions, MCP discovery on Settings → MCP tools, and
 * the memory stores on Settings → Memory — each flag has exactly one page.
 */
export default function ToolsSettingsPage() {
  const runtime = useHarnessRuntime();
  return (
    <>
      <RuntimeStatusLine runtime={runtime} />
      <ToolsOptionsCard />
    </>
  );
}
