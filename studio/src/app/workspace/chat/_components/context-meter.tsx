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

import {
  type ContextBand,
  cacheHitRate,
  contextBand,
  formatPercent,
  TURN_STAT_CACHE_FLOOR,
} from "@/features/agent/turn-stats";
import { formatTokens } from "@/lib/formatters";
import { effortLabel } from "@/lib/reasoning-effort";
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

/** The bar-less label shown when the context window is unknown. */
export function contextFallbackLabel(used: number): string {
  return `ctx ${formatTokens(Math.max(0, used))}`;
}

/**
 * The cumulative token facets beside the meter: input/output always, the
 * cache-write count when any, and the cache-hit rate once material.
 */
export function usageFacets(usage?: ContextMeterUsage | null): string[] {
  if (!usage || usage.inputTokens + usage.outputTokens <= 0) return [];
  const facets = [
    `↑${formatTokens(Math.max(0, usage.inputTokens))} ↓${formatTokens(
      Math.max(0, usage.outputTokens),
    )}`,
  ];
  if ((usage.cacheWriteTokens ?? 0) > 0) {
    facets.push(`⊕${formatTokens(usage.cacheWriteTokens ?? 0)}`);
  }
  const rate = cacheHitRate(usage);
  if (rate >= TURN_STAT_CACHE_FLOOR)
    facets.push(`${formatPercent(rate)} cached`);
  return facets;
}

const BAND_FILL: Record<ContextBand, string> = {
  ok: "bg-brand/60",
  warn: "bg-warning",
  danger: "bg-destructive",
};

const OCCUPANCY_TITLE =
  "Context in use: the tokens the model was sent on its latest turn (system prompt and tool schemas are counted by the daemon) against the model's context window.";
const FALLBACK_TITLE =
  "Approximate: the session's cumulative input and output tokens, until a turn reports how much context it used.";

export function ContextMeter({
  modelLabel,
  effort,
  contextWindow,
  occupancyTokens,
  usage,
}: {
  /** The effective model (resolved_model.model_id); "" when unknown. */
  modelLabel: string;
  /** The effective reasoning-effort tier (resolved_model.reasoning_effort);
   *  "" / absent when the daemon echoes none — then only the model shows. */
  effort?: string;
  /** The resolved model's context window; <= 0 when unknown. */
  contextWindow: number;
  /** The latest turn's input tokens (turn.end); 0 before any turn this visit. */
  occupancyTokens: number;
  /** The session's cumulative usage (daemon figure, or this visit's sum). */
  usage?: ContextMeterUsage | null;
}) {
  const used = meterOccupancy(occupancyTokens, usage);
  // Nothing counted yet: "0%" on a chat whose history the daemon still
  // carries would be a lie, so stay quiet.
  if (used <= 0) return null;
  const fraction = contextUtilisation(used, contextWindow);
  const band = fraction === null ? "ok" : contextBand(fraction);
  const percent = fraction === null ? 0 : Math.round(fraction * 100);
  const facets = usageFacets(usage);
  return (
    <div
      className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground/80"
      title={occupancyTokens > 0 ? OCCUPANCY_TITLE : FALLBACK_TITLE}
    >
      {modelLabel && (
        <span className="truncate font-medium">
          {effort ? `${modelLabel} · ${effortLabel(effort)}` : modelLabel}
        </span>
      )}
      {fraction === null ? (
        <span className="whitespace-nowrap tabular-nums">
          {contextFallbackLabel(used)}
        </span>
      ) : (
        <>
          <span
            className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-border"
            aria-hidden="true"
          >
            <span
              className={cn("block h-full rounded-full", BAND_FILL[band])}
              style={{ width: `${Math.max(2, percent)}%` }}
            />
          </span>
          <span
            className={cn(
              "whitespace-nowrap tabular-nums",
              band === "warn" && "text-warning",
              band === "danger" && "font-medium text-destructive",
            )}
          >
            {formatTokens(used)} / {formatTokens(contextWindow)} · {percent}%
            {band === "danger" && (
              <>
                {" "}
                <span role="img" aria-label="context nearly full">
                  ⚠
                </span>
              </>
            )}
          </span>
        </>
      )}
      {facets.length > 0 && (
        <span className="hidden whitespace-nowrap tabular-nums text-muted-foreground/60 sm:inline">
          {facets.join(" · ")}
        </span>
      )}
    </div>
  );
}
