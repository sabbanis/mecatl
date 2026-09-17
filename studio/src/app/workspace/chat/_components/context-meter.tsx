"use client";

/**
 * The slim context strip near the composer: the session's effective model, a
 * three-band (ok / warn / danger) context-pressure meter, and the session's
 * token facets (↑input ↓output ⊕cache-write · N% cached).
 *
 * Occupancy is the LATEST turn's input tokens — the daemon's `turn.end`
 * figure, i.e. what the model was actually sent, so the system prompt and
 * tool schemas are counted server-side — against the resolved model's
 * `context_window`. Before any turn.end has been seen this visit the meter
 * falls back to the session's cumulative input+output so an older daemon
 * still shows something; with an unknown window it degrades to the bare
 * current size ("ctx 42.1k") rather than disappearing.
 */

import { type ContextBand, contextBand } from "@/features/agent/turn-stats";
import { formatTokens } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/** The session-cumulative token figures the facets render. */
export interface ContextMeterUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
}

/**
 * Fraction of the context window the occupancy occupies, clamped to [0, 1].
 * Null when the window is unknown (<= 0) — the bar must not render against a
 * made-up denominator (the strip then shows the bare size instead).
 */
export function contextUtilisation(
  occupancyTokens: number,
  contextWindow: number,
): number | null {
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return null;
  return Math.min(1, Math.max(0, occupancyTokens) / contextWindow);
}

/**
 * The meter's numerator: the latest turn's input tokens when a turn.end has
 * been seen, else the cumulative input+output (the older-daemon fallback).
 */
export function meterOccupancy(
  occupancyTokens: number,
  usage?: ContextMeterUsage | null,
): number {
  if (Number.isFinite(occupancyTokens) && occupancyTokens > 0) {
    return occupancyTokens;
  }
  if (!usage) return 0;
  return Math.max(0, usage.inputTokens) + Math.max(0, usage.outputTokens);
}

const BAND_FILL: Record<ContextBand, string> = {
  ok: "bg-brand/60",
  warn: "bg-warning",
  danger: "bg-destructive",
};

/**
 * The composer bar's context pill: a short bar and the percentage of the
 * model's context window in use — nothing else (no model name, no token
 * counts). The exact figures ride the tooltip. Hidden while nothing is
 * counted or the window is unknown.
 */
export function ContextPill({
  used,
  contextWindow,
  className,
}: {
  used: number;
  contextWindow: number;
  className?: string;
}) {
  if (!Number.isFinite(used) || used <= 0) return null;
  const fraction = contextUtilisation(used, contextWindow);
  if (fraction === null) return null;
  const band = contextBand(fraction);
  const percent = Math.round(fraction * 100);
  return (
    <span
      data-testid="context-pill"
      title={`Context used: ${formatTokens(used)} of ${formatTokens(contextWindow)} tokens (${percent}%)`}
      className={cn("cursor-default gap-2", className)}
    >
      <span
        className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-border"
        aria-hidden="true"
      >
        <span
          className={cn("block h-full rounded-full", BAND_FILL[band])}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </span>
      <span
        className={cn(
          "tabular-nums text-muted-foreground",
          band === "warn" && "text-warning",
          band === "danger" && "font-medium text-destructive",
        )}
      >
        {percent}%
      </span>
    </span>
  );
}
