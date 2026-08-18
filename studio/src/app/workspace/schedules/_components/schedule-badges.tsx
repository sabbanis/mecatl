"use client";

import { Badge } from "@/components/ui/badge";
import type { ScheduleRow } from "@/lib/protocol";
import { permissionModeLabel } from "./schedule-form";

export interface ScheduleStatusMeta {
  label: string;
  variant: "default" | "secondary" | "success" | "warning" | "destructive";
  /** A fire is live right now (claimed or running) — rendered with a pulse. */
  live: boolean;
}

/**
 * fireStage outranks enabled: a paused schedule can still be mid-fire (pause
 * stops future fires, not the one already claimed), and the live fire is the
 * more urgent fact.
 */
export function scheduleStatusOf(row: ScheduleRow): ScheduleStatusMeta {
  if (row.fireStage === "running")
    return { label: "Running", variant: "success", live: true };
  if (row.fireStage === "claimed")
    return { label: "Claimed", variant: "warning", live: true };
  return row.enabled
    ? { label: "Scheduled", variant: "success", live: false }
    : { label: "Paused", variant: "secondary", live: false };
}

export function ScheduleStatusBadge({ row }: { row: ScheduleRow }) {
  const status = scheduleStatusOf(row);
  return (
    <Badge variant={status.variant}>
      {status.live && (
        <span
          aria-hidden="true"
          className="size-1.5 animate-pulse rounded-full bg-current"
        />
      )}
      {status.label}
    </Badge>
  );
}

/**
 * The spec facts that change what a fire is allowed to do: permission mode,
 * the write opt-in, the workspace it runs in, and the owner it is attributed
 * to. Empty facts render nothing — absence is information here.
 */
export function ScheduleMetaBadges({ row }: { row: ScheduleRow }) {
  return (
    <>
      <Badge variant="outline">{permissionModeLabel(row.mode)}</Badge>
      {row.mutating && <Badge variant="warning">mutating</Badge>}
      {row.workspace && (
        <Badge variant="muted" className="max-w-[16rem]">
          <span className="truncate">{row.workspace}</span>
        </Badge>
      )}
      {row.owner && <Badge variant="muted">{row.owner}</Badge>}
    </>
  );
}
