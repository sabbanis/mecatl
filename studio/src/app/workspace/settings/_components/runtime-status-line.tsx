"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { useHarnessRuntime } from "@/features/agent/hooks/use-harness-runtime";

/**
 * The shared header for the runtime subpages: load/busy state, a manual
 * re-read, and the one error/notice channel config writes report through.
 * Every write here restarts the daemon, which the descriptions say per form.
 */
export function RuntimeStatusLine({
  description,
  runtime,
}: {
  description: string;
  runtime: ReturnType<typeof useHarnessRuntime>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="flex items-center gap-2">
          {(runtime.isLoading || runtime.busy) && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void runtime.refresh()}
            disabled={!runtime.live || runtime.isLoading}
          >
            Refresh
          </Button>
        </div>
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
