"use client";

/**
 * The context strip at the right end of the composer toolbar (B1.1): a short
 * bar plus an APPROXIMATE context-utilisation figure — cumulative input+output
 * tokens this visit counted (summed from the runs' terminal usage frames) vs
 * the model's `resolved_model.context_window`. The reading is approximate —
 * the daemon's true compaction trigger also counts the system prompt and tool
 * schemas, which the client never sees, and a page reload loses the visit's
 * running total — which the tooltip explains. Typography matches the toolbar
 * pills' value text (the "On" in "Memory On").
 */

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Fraction of the context window the counted tokens occupy, clamped to
 * [0, 1]. Null when the window is unknown (<= 0) — the meter must not render
 * against a made-up denominator.
 */
export function contextUtilisation(
  inputTokens: number,
  outputTokens: number,
  contextWindow: number,
): number | null {
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return null;
  const used = Math.max(0, inputTokens) + Math.max(0, outputTokens);
  return Math.min(1, used / contextWindow);
}

export function ContextMeter({
  contextWindow,
  inputTokens,
  outputTokens,
}: {
  contextWindow: number;
  inputTokens: number;
  outputTokens: number;
}) {
  const fraction = contextUtilisation(inputTokens, outputTokens, contextWindow);
  // No window, or nothing counted yet this visit: showing "0%" on a chat
  // whose history the daemon still carries would be a lie, so stay quiet.
  if (fraction === null || inputTokens + outputTokens <= 0) return null;
  const percent = Math.round(fraction * 100);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="ml-auto flex shrink-0 items-center gap-2 px-2 text-sm text-muted-foreground">
          <span
            className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-border"
            aria-hidden="true"
          >
            <span
              className={cn(
                "block h-full rounded-full",
                fraction >= 0.85 ? "bg-warning" : "bg-brand/60",
              )}
              style={{ width: `${Math.max(2, percent)}%` }}
            />
          </span>
          <span className="whitespace-nowrap tabular-nums">
            {percent}% used
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="max-w-64">
        Roughly how much of the model&apos;s working memory this chat has used.
        When it fills up, older messages are summarized to make room.
      </TooltipContent>
    </Tooltip>
  );
}
