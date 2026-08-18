"use client";

import { useState } from "react";
import { formatTokens } from "@/lib/formatters";

/**
 * Token usage for the open chat, exactly as the daemon's usage frames
 * reported it. The daemon does not expose the model's context length, so
 * this shows counts rather than a fill percentage. Hidden until any usage
 * lands.
 */
export function ContextWindowIndicator({
  usage,
}: {
  usage: { inputTokens: number; outputTokens: number };
}) {
  const [open, setOpen] = useState(false);
  const total = usage.inputTokens + usage.outputTokens;

  if (total <= 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-[11px] text-muted-foreground tabular-nums transition-colors hover:bg-muted"
        aria-label="Token usage"
      >
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {formatTokens(usage.inputTokens)} in ·{" "}
        {formatTokens(usage.outputTokens)} out
      </button>
      {open && (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay to close popover */}
          <div
            role="presentation"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-9 z-50 w-64 rounded-lg border bg-popover p-3 shadow-lg">
            <p className="text-sm font-semibold mb-2">Token usage</p>
            <p className="text-xs text-muted-foreground">
              {formatTokens(usage.inputTokens)} input tokens
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTokens(usage.outputTokens)} output tokens
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTokens(total)} total
            </p>
          </div>
        </>
      )}
    </div>
  );
}
