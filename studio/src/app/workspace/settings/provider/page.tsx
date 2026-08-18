"use client";

import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { ProviderSection } from "../_components/provider-section";
import { RuntimeStatusLine } from "../_components/runtime-status-line";

export default function ProviderSettingsPage() {
  const runtime = useHarnessRuntime();
  return (
    <>
      <RuntimeStatusLine
        description="The model provider serving the agent. Credentials never enter Studio: mecated reads them from its auth file."
        runtime={runtime}
      />
      <ProviderSection runtime={runtime} />
    </>
  );
}
