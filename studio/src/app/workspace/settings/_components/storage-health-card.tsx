"use client";

import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/formatters";
import { isStorageDegraded, type StorageHealth } from "@/lib/harness/storage";
import { Note, OfflineNote, SettingsCard } from "./settings-card";
import { Stat } from "./storage-maintenance-shared";

/**
 * The always-visible storage health readout (ADR 0226): the status pill and
 * its one-line reason, then the aggregate the daemon reports — sessions by
 * family, files, size, reclaimable space, layout generations, corrupt
 * families, the active maintenance job and the last failure. Unlike the
 * workspace banner, which appears only on a degraded signal, this card shows
 * a healthy store too, so the numbers the retention and maintenance cards
 * act on are never invisible.
 */

export interface StorageHealthCardProps {
  /** The runtime is reachable. */
  live: boolean;
  /** `capabilities.storage_health === true` on the connected daemon. */
  supported: boolean;
  health: StorageHealth | null;
  onRefresh: () => void;
}

/** The pill and its detail; exported for its vitest. */
export function storageHealthStatus(health: StorageHealth): {
  label: "Healthy" | "Degraded";
  detail: string;
} {
  if (!health.available) {
    return {
      label: "Degraded",
      detail: health.unavailableReason
        ? `The session store cannot be read: ${health.unavailableReason}`
        : "The session store cannot be read.",
    };
  }
  if (health.corruptCount > 0) {
    return {
      label: "Degraded",
      detail: `${health.corruptCount.toLocaleString()} stored session${
        health.corruptCount === 1 ? "" : "s"
      } can no longer be loaded.`,
    };
  }
  if (health.lastFailure) {
    return {
      label: "Degraded",
      detail: `Last background job failed: ${health.lastFailure}`,
    };
  }
  return {
    label: "Healthy",
    detail:
      health.v1Count > 0
        ? `${health.v1Count.toLocaleString()} legacy-layout famil${
            health.v1Count === 1 ? "y" : "ies"
          } can be optimized.`
        : "",
  };
}

/** "n/a" when the store could not size itself, the humanised size otherwise. */
const bytesOrNA = (bytes: number | null) =>
  bytes === null ? "n/a" : formatBytes(bytes);

export function StorageHealthCard({
  live,
  supported,
  health,
  onRefresh,
}: StorageHealthCardProps) {
  const title = "Storage health";
  if (!live) {
    return (
      <SettingsCard title={title}>
        <OfflineNote />
      </SettingsCard>
    );
  }
  if (!supported) {
    return (
      <SettingsCard title={title}>
        <Note>
          This daemon does not report storage health. It needs a durable session
          store (see Session store above) and a daemon build with the{" "}
          <code className="font-mono">storage_health</code> capability.
        </Note>
      </SettingsCard>
    );
  }

  const refreshButton = (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      onClick={onRefresh}
    >
      <RefreshCw aria-hidden="true" className="size-3.5" />
      Refresh
    </Button>
  );

  if (health === null) {
    return (
      <SettingsCard title={title}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Note>
            Storage health is not available right now — the daemon did not
            answer, or refused the read.
          </Note>
          {refreshButton}
        </div>
      </SettingsCard>
    );
  }

  const status = storageHealthStatus(health);
  const degraded = isStorageDegraded(health);

  return (
    <SettingsCard
      title={title}
      description="What the daemon's session store holds right now, as the daemon reports it. Retention above and the maintenance cards below act on these numbers."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              variant={degraded ? "warning" : "success"}
              data-testid="storage-health-status"
            >
              {status.label}
            </Badge>
            {status.detail && (
              <span
                className="text-sm text-muted-foreground"
                data-testid="storage-health-detail"
              >
                {status.detail}
              </span>
            )}
          </div>
          {refreshButton}
        </div>

        {health.available && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <Stat
              label="Sessions"
              testId="storage-health-sessions"
              value={
                <>
                  {health.sessionCount.toLocaleString()}
                  <span className="ml-2 text-muted-foreground">
                    Main {health.mainCount.toLocaleString()} · Child runs{" "}
                    {health.childCount.toLocaleString()} · Scheduled{" "}
                    {health.scheduledCount.toLocaleString()} · Unknown{" "}
                    {health.unknownCount.toLocaleString()}
                  </span>
                </>
              }
            />
            <Stat
              label="Files"
              testId="storage-health-files"
              value={health.fileCount.toLocaleString()}
            />
            <Stat
              label="Size"
              testId="storage-health-size"
              value={bytesOrNA(health.currentBytes)}
            />
            <Stat
              label="Reclaimable"
              testId="storage-health-reclaimable"
              value={bytesOrNA(health.reclaimableBytes)}
            />
            <Stat
              label="Layout"
              testId="storage-health-layout"
              value={`v2 ${health.v2Count.toLocaleString()} · v1 (legacy) ${health.v1Count.toLocaleString()}`}
            />
            <Stat
              label="Corrupt families"
              testId="storage-health-corrupt"
              value={health.corruptCount.toLocaleString()}
            />
            <Stat
              label="Active job"
              testId="storage-health-active-job"
              value={health.activeJob || "none"}
            />
            <Stat
              label="Last failure"
              testId="storage-health-last-failure"
              value={health.lastFailure || "none"}
            />
            {health.ownerless && (
              <Stat
                label="Ownerless"
                testId="storage-health-ownerless"
                value={`${
                  health.ownerless.sessions === null
                    ? "n/a"
                    : health.ownerless.sessions.toLocaleString()
                } sessions · ${
                  health.ownerless.schedules === null
                    ? "n/a"
                    : health.ownerless.schedules.toLocaleString()
                } schedules`}
              />
            )}
          </dl>
        )}
      </div>
    </SettingsCard>
  );
}
