"use client";

import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { RuntimeStatusLine } from "../_components/runtime-status-line";
import { WorkspaceSection } from "../_components/workspace-section";

/**
 * Settings → Workspace: the directory the managed daemon is spawned
 * against — the TUI's `--workspace` deployment choice. Shown in both
 * modes; changeable (a restart) in managed mode only.
 */
export default function WorkspaceSettingsPage() {
  const runtime = useHarnessRuntime();
  return (
    <>
      <RuntimeStatusLine runtime={runtime} />
      <WorkspaceSection runtime={runtime} />
    </>
  );
}
