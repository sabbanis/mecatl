"use client";

import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { useProviderManagement } from "@/features/agent/hooks/use-provider-management";
import { ProviderSection } from "../_components/provider-section";
import { RuntimeStatusLine } from "../_components/runtime-status-line";

export default function ProviderSettingsPage() {
  const runtime = useHarnessRuntime();
  const management = useProviderManagement();
  return (
    <>
      {/* No manual Refresh here: the management surface re-reads after every
          action, and the Add dialog's Re-check covers the by-hand case. The
          line keeps the busy spinner and the error/notice channel. */}
      <RuntimeStatusLine runtime={runtime} hideRefresh />
      <ProviderSection runtime={runtime} management={management} />
    </>
  );
}
