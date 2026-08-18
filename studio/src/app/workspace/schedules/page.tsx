"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { type CronJob, useAgentCron } from "@/features/agent";
import { describeCron, formatRelativeTime } from "@/lib/formatters";
import { pageTitleClass } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { CreateScheduleDialog } from "./_components/create-schedule-dialog";

type SortKey = "name" | "schedule" | "status" | "lastRun";
type SortDir = "asc" | "desc";

interface StatusMeta {
  label: string;
  variant: "default" | "secondary" | "success" | "destructive";
}

function statusOf(job: CronJob): StatusMeta {
  if (job.status === "running") return { label: "Running", variant: "success" };
  if (job.status === "error") return { label: "Error", variant: "destructive" };
  return job.enabled
    ? { label: "Scheduled", variant: "success" }
    : { label: "Paused", variant: "secondary" };
}

/**
 * Sort rank for a status sort. Error is highest priority (sorts to the top
 * ascending) so failing jobs surface first; the rest follow most- to
 * least-active.
 */
const STATUS_RANK: Record<string, number> = {
  Error: 0,
  Running: 1,
  Scheduled: 2,
  Paused: 3,
};

/** Status filter options (lowercased values match `statusOf().label`). */
const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "running", label: "Running" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paused", label: "Paused" },
  { value: "error", label: "Error" },
] as const;

export default function WorkspaceSchedulesPage() {
  const cron = useAgentCron();
  const router = useRouter();
  // Default to status so failing jobs (Error ranks first) surface at the top.
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState("all");

  const rows = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const filtered =
      statusFilter === "all"
        ? cron.jobs
        : cron.jobs.filter(
            (j) => statusOf(j).label.toLowerCase() === statusFilter,
          );
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "schedule":
          cmp = describeCron(a.schedule).localeCompare(
            describeCron(b.schedule),
          );
          break;
        case "status":
          cmp =
            (STATUS_RANK[statusOf(a).label] ?? 9) -
            (STATUS_RANK[statusOf(b).label] ?? 9);
          break;
        case "lastRun":
          cmp = (a.lastRunAt ?? 0) - (b.lastRunAt ?? 0);
          break;
      }
      return cmp * dir;
    });
  }, [cron.jobs, sortKey, sortDir, statusFilter]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Last run defaults to most-recent-first; every other column ascending
      // (name/schedule A→Z, status with Error first).
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
          <CreateScheduleDialog createJob={cron.createJob} />
        </div>

        {/* Table card: the status filter lives in a header toolbar, with the
            table below — matching the admin tables (e.g. organization groups). */}
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
                ? "Nothing scheduled yet."
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
                {rows.map((job) => {
                  const status = statusOf(job);
                  const href = `/workspace/schedules/${job.id}`;
                  return (
                    <TableRow
                      key={job.id}
                      className={cn(
                        "cursor-pointer",
                        // Error rows carry a subtle destructive tint.
                        status.variant === "destructive" &&
                          "bg-destructive/5 hover:bg-destructive/10",
                      )}
                      onClick={() => router.push(href)}
                    >
                      <TableCell className="max-w-0">
                        <Link
                          href={href}
                          className="font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {job.name}
                        </Link>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {job.instruction}
                        </p>
                      </TableCell>
                      <TableCell
                        title={job.schedule}
                        className="whitespace-nowrap text-sm text-muted-foreground"
                      >
                        {describeCron(job.schedule)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell
                        suppressHydrationWarning
                        className="whitespace-nowrap text-right text-sm text-muted-foreground tabular-nums"
                      >
                        {job.lastRunAt
                          ? `${formatRelativeTime(job.lastRunAt)} ago`
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
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
