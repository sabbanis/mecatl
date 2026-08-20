"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";

/**
 * The shared header for the runtime subpages: load/busy state, a manual
 * re-read, and the one error/notice channel config writes report through.
 */
export function RuntimeStatusLine({
  runtime,
}: {
  runtime: ReturnType<typeof useHarnessRuntime>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {(runtime.isLoading || runtime.busy) && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        )}
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-muted-foreground hover:text-foreground"
          onClick={() => void runtime.refresh()}
          disabled={!runtime.live || runtime.isLoading}
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>
      {runtime.error && (
        <p className="text-sm text-destructive">{runtime.error}</p>
      )}
      {runtime.notice && (
        <p className="text-sm text-muted-foreground">{runtime.notice}</p>
      )}
    </div>
  );
}
