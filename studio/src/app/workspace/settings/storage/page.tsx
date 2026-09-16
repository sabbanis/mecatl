"use client";

import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { RetentionSection } from "../_components/retention-section";
import { RuntimeStatusLine } from "../_components/runtime-status-line";
import { SessionStorageSection } from "../_components/session-storage-section";

/**
 * Storage: where the managed daemon keeps its sessions (or that it keeps
 * none). Later storage cards — retention, maintenance — mount on this page
 * beneath the store section.
 */
export default function StorageSettingsPage() {
  const runtime = useHarnessRuntime();
  return (
    <>
      <RuntimeStatusLine runtime={runtime} />
      <SessionStorageSection runtime={runtime} />
      <RetentionSection runtime={runtime} />
    </>
  );
}
