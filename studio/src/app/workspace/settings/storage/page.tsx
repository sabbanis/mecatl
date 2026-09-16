"use client";

import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { RetentionSection } from "../_components/retention-section";
import { RuntimeStatusLine } from "../_components/runtime-status-line";
import { SessionStorageSection } from "../_components/session-storage-section";
import { StorageMaintenanceSection } from "../_components/storage-maintenance-section";

/**
 * Storage: where the managed daemon keeps its sessions (or that it keeps
 * none), the retention policy it applies, and the maintenance block — the
 * always-visible health readout plus the Optimize storage (migration) and
 * Clean up sessions job flows the daemon's capabilities gate.
 */
export default function StorageSettingsPage() {
  const runtime = useHarnessRuntime();
  return (
    <>
      <RuntimeStatusLine runtime={runtime} />
      <SessionStorageSection runtime={runtime} />
      <RetentionSection runtime={runtime} />
      <StorageMaintenanceSection runtime={runtime} />
    </>
  );
}
