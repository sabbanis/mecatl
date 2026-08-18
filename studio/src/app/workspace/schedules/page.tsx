"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAgentCron } from "@/features/agent";
import { describeCron, formatRelativeTime } from "@/lib/formatters";
import type { ScheduleRow } from "@/lib/protocol";
import { pageTitleClass } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { CreateScheduleDialog } from "./_components/create-schedule-dialog";
import {
  ScheduleMetaBadges,
  ScheduleStatusBadge,
  scheduleStatusOf,
} from "./_components/schedule-badges";

type SortKey = "name" | "schedule" | "status" | "lastRun";
type SortDir = "asc" | "desc";

/**
 * Sort rank for a status sort: live fires first (they need eyes), then
 * schedules that will fire again, then paused.
 */
const STATUS_RANK: Record<string, number> = {
  Running: 0,
  Claimed: 1,
  Scheduled: 2,
  Paused: 3,
};

/** Status filter options (lowercased values match `scheduleStatusOf().label`). */
const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "running", label: "Running" },
  { value: "claimed", label: "Claimed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paused", label: "Paused" },
] as const;

/** One line for the trigger: cron in plain English, or the one-shot instant. */
function describeTrigger(row: ScheduleRow): string {
  if (row.cron) return describeCron(row.cron);
  if (row.oneShotAt !== null)
    return `Once at ${new Date(row.oneShotAt).toLocaleString()}`;
  return "—";
}

export default function WorkspaceSchedulesPage() {
  const cron = useAgentCron();
  const router = useRouter();
  // Default to status so live fires surface at the top.
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState("all");

  const rows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const filtered =
      statusFilter === "all"
        ? cron.rows
        : cron.rows.filter(
            (row) => scheduleStatusOf(row).label.toLowerCase() === statusFilter,
          );
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "schedule":
          cmp = describeTrigger(a).localeCompare(describeTrigger(b));
          break;
        case "status":
          cmp =
            (STATUS_RANK[scheduleStatusOf(a).label] ?? 9) -
            (STATUS_RANK[scheduleStatusOf(b).label] ?? 9);
          break;
        case "lastRun":
          cmp = (a.lastFireAt ?? 0) - (b.lastFireAt ?? 0);
          break;
      }
      return cmp * dir;
    });
  }, [cron.rows, sortKey, sortDir, statusFilter]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Last run defaults to most-recent-first; every other column ascending
      // (name/schedule A→Z, status with live fires first).
      setSortDir(key === "lastRun" ? "desc" : "asc");
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-14 min-[500px]:px-8">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h1
            className={pageTitleClass("truncate pb-0 text-4xl leading-tight")}
          >
            Scheduled
          </h1>
          {/* No create button while the daemon has no scheduler to accept it. */}
          {cron.isSupported && cron.harnessLive && (
            <CreateScheduleDialog createFromDraft={cron.createFromDraft} />
          )}
        </div>

        {/* Action refusals from the daemon, verbatim — its words are the
            explanation (frequency floor, bad cron, 412 conflicts). */}
        {cron.error && (
          <p className="whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {cron.error}
          </p>
        )}

        {!cron.harnessLive ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            Runtime offline — the schedule registry can&rsquo;t be read.
          </div>
        ) : !cron.isSupported ? (
          // Not-wired is a different fact from empty: the daemon answered the
          // list with a refusal because it has no schedule store at all.
          <div className="space-y-2 rounded-lg border border-dashed px-6 py-12 text-center">
            <p className="text-sm font-medium">
              Scheduling is not wired on this deployment.
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {cron.notWired}
            </p>
          </div>
        ) : cron.isLoading ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            Loading schedules…
          </div>
        ) : (
          /* Table card: the status filter lives in a header toolbar, with the
             table below — matching the admin tables (e.g. organization groups). */
          <div className="overflow-hidden rounded-lg border">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger
                  aria-label="Filter by status"
                  className="h-9 w-[160px]"
                >
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {statusFilter === "all"
                  ? "No schedules yet."
                  : "No scheduled tasks match this filter."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortHead
                      label="Name"
                      active={sortKey === "name"}
                      dir={sortDir}
                      onClick={() => toggleSort("name")}
                      className="w-3/5"
                    />
                    <SortHead
                      label="Schedule"
                      active={sortKey === "schedule"}
                      dir={sortDir}
                      onClick={() => toggleSort("schedule")}
                      className="w-px whitespace-nowrap"
                    />
                    <SortHead
                      label="Status"
                      active={sortKey === "status"}
                      dir={sortDir}
                      onClick={() => toggleSort("status")}
                      className="w-px whitespace-nowrap"
                    />
                    <SortHead
                      label="Last run"
                      active={sortKey === "lastRun"}
                      dir={sortDir}
                      onClick={() => toggleSort("lastRun")}
                      className="w-px whitespace-nowrap text-right"
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const href = `/workspace/schedules/${encodeURIComponent(row.name)}`;
                    return (
                      <TableRow
                        key={row.name}
                        className="cursor-pointer"
                        onClick={() => router.push(href)}
                      >
                        <TableCell className="max-w-0">
                          <Link
                            href={href}
                            className="font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.name}
                          </Link>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {row.prompt}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <ScheduleMetaBadges row={row} />
                          </div>
                        </TableCell>
                        <TableCell
                          title={
                            row.cron
                              ? `${row.cron}${row.timezone ? ` (${row.timezone})` : ""}`
                              : undefined
                          }
                          className="whitespace-nowrap text-sm text-muted-foreground"
                        >
                          {describeTrigger(row)}
                        </TableCell>
                        <TableCell>
                          <ScheduleStatusBadge row={row} />
                        </TableCell>
                        <TableCell
                          suppressHydrationWarning
                          className="whitespace-nowrap text-right text-sm text-muted-foreground tabular-nums"
                        >
                          {row.lastFireAt
                            ? `${formatRelativeTime(row.lastFireAt)} ago`
                            : "Never"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SortHead({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
          className?.includes("text-right") && "flex-row-reverse",
        )}
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    </TableHead>
  );
}
