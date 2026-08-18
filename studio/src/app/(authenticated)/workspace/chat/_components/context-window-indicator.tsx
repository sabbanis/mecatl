"use client";

import { useState } from "react";
import type { AgentSession } from "@/features/agent";
import { formatTokens } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function ContextWindowIndicator({ session }: { session: AgentSession }) {
  const [open, setOpen] = useState(false);
  const total = session.contextLength;
  const used = session.lastPromptTokens;
  const threshold = session.thresholdTokens;

  if (!total || !used) return null;

  const pctUsed = Math.round((used / total) * 100);
  const pctLeft = 100 - pctUsed;
  const circumference = 2 * Math.PI * 10;
  const strokeDashoffset = circumference * (1 - pctUsed / 100);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center size-8 rounded-full hover:bg-muted transition-colors"
        aria-label="Context window"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          className="-rotate-90"
          role="img"
          aria-hidden="true"
        >
          <circle
            cx="14"
            cy="14"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-muted-foreground/20"
          />
          <circle
            cx="14"
            cy="14"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn(
              pctUsed > 80
                ? "text-destructive"
                : pctUsed > 50
                  ? "text-warning"
                  : "text-brand",
            )}
          />
        </svg>
        <span className="absolute text-[8px] font-bold tabular-nums">
          {pctUsed}
        </span>
      </button>
      {open && (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay to close popover */}
          <div
            role="presentation"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-10 z-50 w-64 rounded-lg border bg-popover p-3 shadow-lg">
            <p className="text-sm font-semibold mb-2">Context window</p>
            <p className="text-xs text-muted-foreground">
              {pctUsed}% used ({pctLeft}% left)
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTokens(used)} / {formatTokens(total)} tokens used
            </p>
            {threshold && (
              <p className="text-xs text-muted-foreground">
                Auto-compress at {formatTokens(threshold)} (
                {Math.round((threshold / total) * 100)}%)
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
