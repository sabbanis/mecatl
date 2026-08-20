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
      <RuntimeStatusLine runtime={runtime} />
      <ProviderSection runtime={runtime} management={management} />
    </>
  );
}
