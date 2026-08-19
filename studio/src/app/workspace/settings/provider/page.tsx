"use client";

import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { ProviderSection } from "../_components/provider-section";
import { RuntimeStatusLine } from "../_components/runtime-status-line";

export default function ProviderSettingsPage() {
  const runtime = useHarnessRuntime();
  return (
    <>
      <RuntimeStatusLine runtime={runtime} />
      <ProviderSection runtime={runtime} />
    </>
  );
}
