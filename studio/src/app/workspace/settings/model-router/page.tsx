"use client";

import { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";
import { ModelRouterSection } from "../_components/model-router-section";
import { RuntimeStatusLine } from "../_components/runtime-status-line";

export default function ModelRouterSettingsPage() {
  const runtime = useHarnessRuntime();
  return (
    <>
      <RuntimeStatusLine
        description="Semantic routing across model tiers. Saving restarts the daemon and invalidates in-flight sessions."
        runtime={runtime}
      />
      <ModelRouterSection runtime={runtime} />
    </>
  );
}
