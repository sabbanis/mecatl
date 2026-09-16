"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { MigrationController } from "@/features/agent/hooks/use-storage-maintenance";
import { formatBytes } from "@/lib/formatters";
import {
  DEFAULT_MIGRATION_BATCH_SIZE,
  isMigrationResumable,
  type StorageMigrationJob,
} from "@/lib/harness/storage";
import { Note, OfflineNote, SettingsCard } from "./settings-card";
import {
  describeUnavailableReason,
  JobErrorsTable,
  JobStateBadge,
  MaintenanceErrorLine,
  ManagementUnauthorizedNote,
  Stat,
} from "./storage-maintenance-shared";

/**
 * "Optimize storage": the layout migration as a two-step flow — a read-only
 * estimate (families by generation, bytes, the temporary space the job
 * needs), then the durable job with its progress, per-item failures, Cancel
 * while running and Resume from a cancelled or failed checkpoint. Gated on
 * `capabilities.storage_migration`; a daemon without it renders nothing.
 */

export interface StorageMigrationCardProps {
  live: boolean;
  /** `capabilities.storage_migration === true`. */
  supported: boolean;
  /** `StorageHealth.activeJob` — the kinds running now, "" when idle. */
  activeJob: string;
  onRefreshHealth: () => void;
  migration: MigrationController;
}

/** A health `activeJob` naming a migration started from another client. */
export function migrationRunningElsewhere(activeJob: string): boolean {
  return activeJob
    .split(",")
    .some((part) => part.trim().startsWith("migration"));
}

/** Progress as a 0–100 percentage of the families the job set out to move. */
export function migrationProgressPercent(job: StorageMigrationJob): number {
  if (job.v1Families <= 0) return job.processed > 0 ? 100 : 0;
  return Math.min(100, Math.round((job.processed / job.v1Families) * 100));
}

/** Parses the batch-size field: a positive whole number, else the default. */
export function parseBatchSize(raw: string): number {
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_MIGRATION_BATCH_SIZE;
}

function BatchSizeField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        Batch size
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-24 font-mono"
      />
    </div>
  );
}

function PlanSummary({ migration }: { migration: MigrationController }) {
  const plan = migration.plan;
  if (!plan) return null;
  return (
    <dl
      className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm"
      data-testid="storage-migration-plan"
    >
      <Stat
        label="Legacy (v1) families"
        value={plan.v1Families.toLocaleString()}
      />
      <Stat
        label="Current (v2) families"
        value={plan.v2Families.toLocaleString()}
      />
      <Stat
        label="Unreadable families"
        value={`${plan.invalidFamilies.toLocaleString()} (left untouched)`}
      />
      <Stat
        label="Skipped families"
        value={plan.skippedFamilies.toLocaleString()}
      />
      <Stat label="Store size" value={formatBytes(plan.currentBytes)} />
      <Stat label="Reclaimable" value={formatBytes(plan.reclaimableBytes)} />
      <Stat
        label="Temporary space needed"
        value={formatBytes(plan.temporaryBytes)}
      />
    </dl>
  );
}

function JobPanel({
  job,
  migration,
  batchSize,
  onBatchSize,
}: {
  job: StorageMigrationJob;
  migration: MigrationController;
  batchSize: string;
  onBatchSize: (next: string) => void;
}) {
  const running = migration.phase === "running";
  const busy = migration.phase === "applying";
  const resumable = !running && !busy && isMigrationResumable(job.state);
  const percent = migrationProgressPercent(job);
  return (
    <div className="flex flex-col gap-3" data-testid="storage-migration-job">
      <div className="flex flex-wrap items-center gap-2">
        <JobStateBadge state={job.state} testId="storage-migration-job-state" />
        <span className="font-mono text-xs text-muted-foreground">
          {job.jobId}
        </span>
      </div>
      <Progress
        value={percent}
        aria-label="Migration progress"
        aria-valuetext={`${job.processed} of ${job.v1Families} families processed`}
      />
      <p
        className="text-sm tabular-nums"
        data-testid="storage-migration-progress"
      >
        {job.processed.toLocaleString()} of {job.v1Families.toLocaleString()}{" "}
        families processed · {job.migrated.toLocaleString()} migrated ·{" "}
        {job.failed.toLocaleString()} failed
      </p>
      <JobErrorsTable errors={job.errors} label="Migration item failures" />
      {migration.error && <MaintenanceErrorLine error={migration.error} />}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {running && (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => void migration.cancel()}
          >
            Cancel
          </Button>
        )}
        {resumable && (
          <>
            <BatchSizeField
              id="storage-migration-resume-batch"
              value={batchSize}
              onChange={onBatchSize}
              disabled={busy}
            />
            <Button
              variant="action"
              className="rounded-full"
              onClick={() => void migration.resume(parseBatchSize(batchSize))}
            >
              Resume
            </Button>
          </>
        )}
        {!running && !busy && (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={migration.reset}
          >
            Start over
          </Button>
        )}
      </div>
    </div>
  );
}

export function StorageMigrationCard({
  live,
  supported,
  activeJob,
  onRefreshHealth,
  migration,
}: StorageMigrationCardProps) {
  const [batchSize, setBatchSize] = useState(
    String(DEFAULT_MIGRATION_BATCH_SIZE),
  );
  if (!supported) return null;

  const title = "Optimize storage";
  const description =
    "Moves sessions still in the legacy on-disk layout to the current one. Estimate first — it reads only — then run the job; it checkpoints, so a cancelled or failed run resumes where it stopped.";

  if (!live) {
    return (
      <SettingsCard title={title}>
        <OfflineNote />
      </SettingsCard>
    );
  }

  const { phase, plan, job, error } = migration;

  if (error?.code === "management_unauthorized") {
    return (
      <SettingsCard title={title} description={description}>
        <ManagementUnauthorizedNote />
      </SettingsCard>
    );
  }

  let body: React.ReactNode;
  if (
    job &&
    (phase === "running" ||
      phase === "done" ||
      phase === "failed" ||
      phase === "applying")
  ) {
    body = (
      <JobPanel
        job={job}
        migration={migration}
        batchSize={batchSize}
        onBatchSize={setBatchSize}
      />
    );
  } else if (phase === "failed") {
    body = (
      <div className="flex flex-col gap-3">
        {error && <MaintenanceErrorLine error={error} />}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {error?.code === "migration_conflict" && (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onRefreshHealth}
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Refresh health
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-full"
            onClick={migration.reset}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  } else if ((phase === "planned" || phase === "applying") && plan) {
    const busy = phase === "applying";
    body = (
      <div className="flex flex-col gap-4">
        <PlanSummary migration={migration} />
        {!plan.available ? (
          <Note>
            Migration is not available right now:{" "}
            {describeUnavailableReason(plan.unavailableReason)}.
          </Note>
        ) : plan.v1Families === 0 ? (
          <Note>
            Nothing to optimize — every family is already in the current layout.
          </Note>
        ) : (
          <Note>
            The job moves {plan.v1Families.toLocaleString()} famil
            {plan.v1Families === 1 ? "y" : "ies"} in batches and needs about{" "}
            {formatBytes(plan.temporaryBytes)} of free disk while it runs. Chats
            stay readable throughout.
          </Note>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={migration.reset}
            disabled={busy}
          >
            Discard estimate
          </Button>
          {plan.available && plan.v1Families > 0 && (
            <>
              <BatchSizeField
                id="storage-migration-batch"
                value={batchSize}
                onChange={setBatchSize}
                disabled={busy}
              />
              <Button
                variant="action"
                className="rounded-full"
                disabled={busy}
                onClick={() => void migration.apply(parseBatchSize(batchSize))}
              >
                {busy ? "Starting…" : "Optimize now"}
              </Button>
            </>
          )}
          {(!plan.available || plan.v1Families === 0) && (
            <Button
              variant="action"
              className="rounded-full"
              disabled={busy}
              onClick={() => void migration.estimate()}
            >
              Estimate again
            </Button>
          )}
        </div>
      </div>
    );
  } else {
    // idle or planning
    const planning = phase === "planning";
    const elsewhere = migrationRunningElsewhere(activeJob);
    body = (
      <div className="flex flex-col gap-3">
        {elsewhere && (
          <Note>
            A migration job is already running — started from another client.
            Refresh storage health to follow its progress; a second job cannot
            start until it finishes.
          </Note>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {elsewhere ? (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={onRefreshHealth}
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Refresh health
            </Button>
          ) : (
            <Button
              variant="action"
              className="rounded-full"
              disabled={planning}
              onClick={() => void migration.estimate()}
            >
              {planning ? "Estimating…" : "Estimate"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <SettingsCard title={title} description={description}>
      {body}
    </SettingsCard>
  );
}
