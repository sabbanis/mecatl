"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const RUN_STATUS_VARIANT: Record<
  string,
  "success" | "destructive" | "secondary"
> = {
  success: "success",
  error: "destructive",
  retrying: "secondary",
};

export default function ScheduleDetailPage() {
  const params = useParams<{ scheduleId: string }>();
  const router = useRouter();
  const cron = useAgentCron();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const job = cron.jobs.find((j) => j.id === params.scheduleId);

  const back = () => router.push("/workspace/schedules");

  if (!job) {
    // The registry may still be loading; only treat as missing once settled.
    if (cron.isLoading) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      );
    }
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center">
          <h1 className="text-lg font-semibold">Scheduled task not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This scheduled task no longer exists — it may have been deleted.
          </p>
          <Button
            className="mt-6"
            onClick={() => router.push("/workspace/chat")}
          >
            Home
          </Button>
        </div>
      </div>
    );
  }

  const status = statusOf(job);
  const history = job.history ?? [];

  return (
    <div className="h-full overflow-y-auto px-4 pt-6 pb-14 min-[500px]:px-8">
      <div className="space-y-6">
        <Button
          variant="outline"
          size="sm"
          className="w-fit self-start rounded-full h-9 px-4 gap-1"
          onClick={back}
        >
          <span aria-hidden="true">‹</span>
          Back
        </Button>

        {/* Header: title + metadata pills, matching the agent detail page. */}
        <div className="space-y-3">
          <h1 className={pageTitleClass("text-[44px] leading-[1.05]")}>
            {job.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <MetaPill suppressHydrationWarning>
              {describeCron(job.schedule)}
            </MetaPill>
            <MetaPill suppressHydrationWarning>
              {job.lastRunAt
                ? `last run ${formatRelativeTime(job.lastRunAt)} ago`
                : "never run"}
            </MetaPill>
          </div>
        </div>

        {/* Single-column stack — content spans the full width in reading order. */}
        <div className="max-w-4xl space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Instruction</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {job.instruction}
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-sm font-semibold">Schedule</h2>
            <p className="text-sm">{describeCron(job.schedule)}</p>
          </section>

          {job.targetChannel && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Delivery</h2>
              <p className="text-sm text-muted-foreground">
                Posts to{" "}
                <span className="font-medium text-foreground">
                  {job.targetChannel}
                </span>
              </p>
            </section>
          )}

          {((job.tools && job.tools.length > 0) ||
            (job.skills && job.skills.length > 0)) && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Tools</h2>
              <div className="flex flex-wrap gap-1.5">
                {job.tools?.map((t) => (
                  <Badge key={t} variant="secondary">
                    {t}
                  </Badge>
                ))}
                {job.skills?.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  job.enabled
                    ? void cron.pauseJob(job.id)
                    : void cron.resumeJob(job.id)
                }
              >
                {job.enabled ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Last output</h2>
            {job.output ? (
              <pre className="whitespace-pre-wrap rounded-lg border bg-card p-4 font-mono text-xs leading-relaxed text-muted-foreground">
                {job.output}
              </pre>
            ) : (
              <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                No runs recorded yet.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Run history</h2>
            {history.length === 0 ? (
              <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                No past runs.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="whitespace-nowrap text-sm tabular-nums">
                          {run.startedAt}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                          {(run.durationMs / 1000).toFixed(1)}s
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              RUN_STATUS_VARIANT[run.status] ?? "secondary"
                            }
                          >
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {run.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {job.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                The schedule stops firing. Past run transcripts stay in the
                session store.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  void cron.deleteJob(job.id);
                  setConfirmDelete(false);
                  back();
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

/** Rounded metadata pill for the header, matching the agent detail page. */
function MetaPill({
  children,
  className,
  suppressHydrationWarning,
}: {
  children: React.ReactNode;
  className?: string;
  suppressHydrationWarning?: boolean;
}) {
  return (
    <span
      suppressHydrationWarning={suppressHydrationWarning}
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
