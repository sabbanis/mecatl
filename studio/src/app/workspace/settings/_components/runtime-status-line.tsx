"use client";

import { Loader2 } from "lucide-react";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";

/**
 * The shared status strip for the runtime subpages: load/busy state and the
 * one error/notice channel config writes report through. There is no manual
 * Refresh control — every surface re-reads after each action (and the
 * runtime provider re-probes on its own), so the strip renders nothing when
 * there is nothing to report.
 */
export function RuntimeStatusLine({
  runtime,
}: {
  runtime: ReturnType<typeof useHarnessRuntime>;
}) {
  const working = runtime.isLoading || Boolean(runtime.busy);
  if (!working && !runtime.error && !runtime.notice) return null;
  return (
    <div className="space-y-2">
      {working && (
        <div className="flex justify-end">
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        </div>
      )}
      {runtime.error && (
        <p className="text-sm text-destructive">{runtime.error}</p>
      )}
      {runtime.notice && (
        <p className="text-sm text-muted-foreground">{runtime.notice}</p>
      )}
    </div>
  );
}
