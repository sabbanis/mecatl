"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CleanupController } from "@/features/agent/hooks/use-storage-maintenance";
import { useTypedConfirm } from "@/hooks/use-typed-confirm";
import { formatBytes, formatRelativeTime } from "@/lib/formatters";
import {
  CLEANUP_KINDS,
  type CleanupCounts,
  type CleanupKind,
  type SessionCleanupJob,
  type SessionCleanupPlan,
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
 * Bulk "Clean up sessions": applies the daemon's effective retention policy
 * NOW to the chosen session kinds, in a durable job. The plan partitions the
 * store into eligible candidates (each with the limit that selected it) and
 * protected rows (running, live, leased, foreign-owned, unknown kind); apply
 * needs the plan's one-shot confirmation token AND the phrase `CLEAN UP`
 * typed exactly. Main chats are unticked by default — and eligible only when
 * the Retention card has a main limit switched on. Gated on
 * `capabilities.storage_cleanup`; a daemon without it renders nothing.
 */

/** The typed phrase; case-sensitive, matched exactly. */
const CLEANUP_PHRASE = "CLEAN UP";

/** How many candidates the table lists; the plan's counts cover the rest. */
const CANDIDATE_TABLE_LIMIT = 200;

const CLEANUP_KIND_LABEL: Record<CleanupKind, string> = {
  main: "Main chats",
  subagent: "Subagent runs",
  parallel_branch: "Parallel branches",
  team_member: "Team member runs",
  scheduled: "Scheduled fires",
};

const CLEANUP_KIND_HINT: Record<CleanupKind, string> = {
  main: "Your own chats. Eligible only while a Main limit is on in Retention.",
  subagent:
    "Runs delegated to a Subagent (their InspectSubagent and resume handles).",
  parallel_branch: "Branches of a Parallel fan-out.",
  team_member: "Team member runs.",
  scheduled: "Sessions a scheduled task's fires produced.",
};

/** Kinds ticked when the card mounts: everything but main chats. */
const DEFAULT_CLEANUP_KINDS: readonly CleanupKind[] = CLEANUP_KINDS.filter(
  (kind) => kind !== "main",
);

/** Plain words for the daemon's reason codes; unknown codes show as-is. */
const REASON_LABEL: Record<string, string> = {
  age: "over the age limit",
  cap: "beyond the count cap",
  unknown_taxonomy: "unknown kind",
  active_state: "running or awaiting",
  live: "live in this daemon",
  leased: "leased by another client",
  foreign_owner: "owned by someone else",
};

const describeReason = (reason: string) => REASON_LABEL[reason] ?? reason;

const describeKind = (kind: string) =>
  (CLEANUP_KIND_LABEL as Record<string, string>)[kind] ?? kind;

/** "3 subagent runs · 1 scheduled fire" style breakdown of a counts map. */
export function describeCounts(
  counts: Record<string, number>,
  describe: (key: string) => string = (key) => key,
): string {
  const parts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${count.toLocaleString()} ${describe(key)}`);
  return parts.join(" · ");
}

/** The typed-confirm dialog's body; exported for its vitest. */
export function cleanupConfirmDescription(plan: SessionCleanupPlan): string {
  const total = plan.eligible.length;
  const bytes =
    plan.estimatedBytes > 0
      ? ` (about ${formatBytes(plan.estimatedBytes)})`
      : "";
  const byKind = describeCounts(plan.eligibleCounts.byKind, describeKind);
  return `${total.toLocaleString()} stored session${
    total === 1 ? "" : "s"
  }${bytes} will be deleted permanently, with their transcripts and event logs${
    byKind ? `: ${byKind}` : ""
  }. The ${plan.protected.total.toLocaleString()} protected session${
    plan.protected.total === 1 ? "" : "s"
  } stay. This cannot be undone.`;
}

function CountsLine({
  label,
  counts,
  testId,
}: {
  label: string;
  counts: CleanupCounts;
  testId: string;
}) {
  const kinds = describeCounts(counts.byKind, describeKind);
  const reasons = describeCounts(counts.byReason, describeReason);
  const states = describeCounts(counts.byState);
  return (
    <Stat
      label={label}
      testId={testId}
      value={
        <>
          {counts.total.toLocaleString()}
          {(kinds || reasons || states) && (
            <span className="ml-2 text-muted-foreground">
              {[kinds, reasons, states].filter(Boolean).join(" — ")}
            </span>
          )}
        </>
      }
    />
  );
}

function CandidatesTable({ plan }: { plan: SessionCleanupPlan }) {
  const rows = plan.eligible.slice(0, CANDIDATE_TABLE_LIMIT);
  if (rows.length === 0) return null;
  const summary =
    plan.eligible.length > CANDIDATE_TABLE_LIMIT
      ? `Show candidates (first ${CANDIDATE_TABLE_LIMIT} of ${plan.eligible.length.toLocaleString()})`
      : `Show candidates (${rows.length.toLocaleString()})`;
  return (
    <details className="rounded-lg border px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none text-muted-foreground">
        {summary}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <Table aria-label="Clean-up candidates">
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Modified</TableHead>
              <TableHead className="text-right">Size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.sessionId}>
                <TableCell className="font-mono text-xs">
                  {row.sessionId}
                </TableCell>
                <TableCell>{describeKind(row.kind)}</TableCell>
                <TableCell>{row.state}</TableCell>
                <TableCell>{describeReason(row.reason)}</TableCell>
                <TableCell>
                  {row.modifiedAt === null
                    ? "unknown"
                    : `${formatRelativeTime(row.modifiedAt) || "<1m"} ago`}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBytes(row.estimatedBytes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}

function KindPicker({
  selected,
  onToggle,
  disabled,
}: {
  selected: ReadonlySet<CleanupKind>;
  onToggle: (kind: CleanupKind, checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Session kinds to clean up</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {CLEANUP_KINDS.map((kind) => {
          const id = `storage-cleanup-kind-${kind}`;
          return (
            <div key={kind} className="flex items-start gap-3">
              <Checkbox
                id={id}
                checked={selected.has(kind)}
                onCheckedChange={(checked) => onToggle(kind, checked === true)}
                disabled={disabled}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor={id} className="text-sm font-medium">
                  {CLEANUP_KIND_LABEL[kind]}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {CLEANUP_KIND_HINT[kind]}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

function JobPanel({
  job,
  cleanup,
}: {
  job: SessionCleanupJob;
  cleanup: CleanupController;
}) {
  const running = cleanup.phase === "running";
  return (
    <div className="flex flex-col gap-3" data-testid="storage-cleanup-job">
      <div className="flex flex-wrap items-center gap-2">
        <JobStateBadge state={job.state} testId="storage-cleanup-job-state" />
        <span className="font-mono text-xs text-muted-foreground">
          {job.jobId}
        </span>
      </div>
      <p
        className="text-sm tabular-nums"
        data-testid="storage-cleanup-progress"
      >
        {job.processed.toLocaleString()} processed ·{" "}
        {job.deleted.toLocaleString()} deleted · {job.skipped.toLocaleString()}{" "}
        skipped · {job.stale.toLocaleString()} stale ·{" "}
        {job.failed.toLocaleString()} failed
      </p>
      <JobErrorsTable errors={job.errors} label="Clean-up item failures" />
      {cleanup.error && <MaintenanceErrorLine error={cleanup.error} />}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {running ? (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => void cleanup.cancel()}
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={cleanup.reset}
          >
            Plan again
          </Button>
        )}
      </div>
    </div>
  );
}

export interface StorageCleanupCardProps {
  live: boolean;
  /** `capabilities.storage_cleanup === true`. */
  supported: boolean;
  cleanup: CleanupController;
}

export function StorageCleanupCard({
  live,
  supported,
  cleanup,
}: StorageCleanupCardProps) {
  const { confirmTyped, TypedConfirmDialog } = useTypedConfirm();
  const [selected, setSelected] = useState<ReadonlySet<CleanupKind>>(
    () => new Set(DEFAULT_CLEANUP_KINDS),
  );
  if (!supported) return null;

  const title = "Clean up sessions";
  const description =
    "Applies the retention policy above right now, in bulk, to the kinds you pick — instead of waiting for the next sweep. Plan first to see exactly which sessions are eligible and which are protected; nothing is deleted until you confirm.";

  if (!live) {
    return (
      <SettingsCard title={title}>
        <OfflineNote />
      </SettingsCard>
    );
  }

  const { phase, plan, job, error } = cleanup;

  if (error?.code === "management_unauthorized") {
    return (
      <SettingsCard title={title} description={description}>
        <ManagementUnauthorizedNote />
      </SettingsCard>
    );
  }

  const toggle = (kind: CleanupKind, checked: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(kind);
      else next.delete(kind);
      return next;
    });

  const runCleanup = async () => {
    if (!plan) return;
    cleanup.beginConfirm();
    const confirmed = await confirmTyped({
      title: `Delete ${plan.eligible.length.toLocaleString()} stored session${
        plan.eligible.length === 1 ? "" : "s"
      } permanently?`,
      description: cleanupConfirmDescription(plan),
      phrase: CLEANUP_PHRASE,
      confirmText: "Clean up",
      destructive: true,
    });
    if (!confirmed) {
      cleanup.abortConfirm();
      return;
    }
    await cleanup.apply();
  };

  let body: React.ReactNode;
  if (job && (phase === "running" || phase === "done" || phase === "failed")) {
    body = <JobPanel job={job} cleanup={cleanup} />;
  } else if (phase === "stale") {
    body = (
      <div className="flex flex-col gap-3">
        <Note>
          The store changed since this plan was made — sessions were added,
          deleted or the policy moved — so its token no longer applies. Plan
          again to get a fresh partition.
        </Note>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={cleanup.reset}
          >
            Start over
          </Button>
          <Button
            variant="action"
            className="rounded-full"
            onClick={() => void cleanup.replan()}
          >
            Re-plan
          </Button>
        </div>
      </div>
    );
  } else if (
    plan &&
    (phase === "planned" || phase === "confirming" || phase === "applying")
  ) {
    const busy = phase !== "planned";
    const nothing = plan.available && plan.eligible.length === 0;
    body = (
      <div className="flex flex-col gap-4">
        {!plan.available ? (
          <Note>
            Clean-up is not available right now:{" "}
            {describeUnavailableReason(plan.unavailableReason)}.
          </Note>
        ) : (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <CountsLine
                label="Eligible"
                counts={plan.eligibleCounts}
                testId="storage-cleanup-eligible"
              />
              <Stat
                label="Estimated size"
                testId="storage-cleanup-estimated-bytes"
                value={formatBytes(plan.estimatedBytes)}
              />
              <CountsLine
                label="Protected"
                counts={plan.protected}
                testId="storage-cleanup-protected"
              />
            </dl>
            <CandidatesTable plan={plan} />
            {nothing && (
              <Note>
                Nothing to clean up for the selected kinds. A kind with no limit
                in the retention policy has no eligible sessions.
              </Note>
            )}
          </>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={cleanup.reset}
            disabled={busy}
          >
            {plan.available && !nothing ? "Discard plan" : "Plan again"}
          </Button>
          {plan.available && !nothing && (
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={busy}
              onClick={() => void runCleanup()}
            >
              {phase === "applying" ? "Cleaning up…" : "Clean up…"}
            </Button>
          )}
        </div>
      </div>
    );
  } else {
    // idle, planning, or a plan failure with nothing to show
    const planning = phase === "planning";
    body = (
      <div className="flex flex-col gap-4">
        <KindPicker selected={selected} onToggle={toggle} disabled={planning} />
        {phase === "failed" && error && <MaintenanceErrorLine error={error} />}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="action"
            className="rounded-full"
            disabled={planning || selected.size === 0}
            onClick={() => void cleanup.planCleanup([...selected])}
          >
            {planning ? "Planning…" : "Plan clean-up"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SettingsCard title={title} description={description}>
      {body}
      {TypedConfirmDialog}
    </SettingsCard>
  );
}
