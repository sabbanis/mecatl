"use client";

import { Loader2, Play } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import { useAgentCron } from "@/features/agent";
import { TranscriptDialog } from "@/features/agent/components/transcript-dialog";
import { describeCron, formatRelativeTime } from "@/lib/formatters";
import { listScheduleFires } from "@/lib/harness/client";
import type { ScheduleFireRow, ScheduleRow } from "@/lib/protocol";
import { pageTitleClass } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { EditScheduleDialog } from "../_components/edit-schedule-dialog";
import {
  ScheduleMetaBadges,
  ScheduleStatusBadge,
} from "../_components/schedule-badges";

/**
 * The route segment is the schedule name. `useParams` hands back the encoded
 * segment, so matching tolerates both forms rather than assuming one.
 */
function segmentMatches(raw: string): (row: ScheduleRow) => boolean {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Malformed escape: the raw form is the only candidate.
  }
  return (row) => row.name === decoded || row.name === raw;
}

function formatInstant(ms: number | null): string {
  if (ms === null) return "—";
  return new Date(ms).toLocaleString();
}

function formatDurationMs(ms: number): string {
  if (ms < 0) return "—";
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds - minutes * 60)}s`;
}

/**
 * A terminal fire record carries no end timestamp, so the best available end
 * is the last progress heartbeat, then the deadline; an in-flight fire is
 * still accruing and reads against now.
 */
function fireDuration(fire: ScheduleFireRow): string {
  if (fire.startedAt === null) return "—";
  const end = fire.inFlight
    ? Date.now()
    : (fire.progressAt ?? fire.deadline ?? fire.startedAt);
  return formatDurationMs(end - fire.startedAt);
}

export default function ScheduleDetailPage() {
  const params = useParams<{ scheduleId: string }>();
  const router = useRouter();
  const cron = useAgentCron();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [firing, setFiring] = useState(false);
  const [fires, setFires] = useState<ScheduleFireRow[] | null>(null);
  const [firesError, setFiresError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<{
    sessionId: string;
    label: string;
  } | null>(null);

  const row = cron.rows.find(segmentMatches(params.scheduleId));
  const name = row?.name;

  const loadFires = useCallback(
    async (signal?: AbortSignal) => {
      if (!name) return;
      try {
        const next = await listScheduleFires(name, signal);
        if (signal?.aborted) return;
        setFires(next);
        setFiresError(null);
      } catch (caught) {
        if (signal?.aborted) return;
        setFires([]);
        setFiresError(
          caught instanceof Error ? caught.message : String(caught),
        );
      }
    },
    [name],
  );

  useEffect(() => {
    if (!cron.harnessLive || !name) return;
    const controller = new AbortController();
    void loadFires(controller.signal);
    return () => controller.abort();
  }, [cron.harnessLive, name, loadFires]);

  // A live fire changes shape without user input (claimed → running →
  // terminal), so the page re-reads while one is in flight.
  const anyLive =
    row?.fireStage !== undefined && row.fireStage !== "idle"
      ? true
      : (fires?.some((fire) => fire.inFlight) ?? false);
  useEffect(() => {
    if (!cron.harnessLive || !anyLive) return;
    const timer = setInterval(() => {
      void loadFires();
      void cron.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [cron.harnessLive, anyLive, loadFires, cron.refresh]);

  const back = () => router.push("/workspace/schedules");

  if (!row) {
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
            {cron.notWired ??
              "This scheduled task no longer exists — it may have been deleted."}
          </p>
          <Button className="mt-6" onClick={back}>
            Back to Scheduled
          </Button>
        </div>
      </div>
    );
  }

  const fireNow = async () => {
    setFiring(true);
    try {
      // FireNow is synchronous on the daemon: this await lasts the whole run.
      await cron.runJob(row.name);
    } catch {
      // The refusal already landed in cron.error, rendered verbatim below.
    } finally {
      setFiring(false);
      await loadFires();
    }
  };

  const act = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch {
      // Refusal surfaces via cron.error.
    }
    await loadFires();
  };

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
            {row.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <ScheduleStatusBadge row={row} />
            <ScheduleMetaBadges row={row} />
            <MetaPill suppressHydrationWarning>
              {row.cron
                ? describeCron(row.cron)
                : row.oneShotAt !== null
                  ? `once at ${formatInstant(row.oneShotAt)}`
                  : "no trigger"}
            </MetaPill>
            <MetaPill suppressHydrationWarning>
              {row.lastFireAt
                ? `last fired ${formatRelativeTime(row.lastFireAt)} ago`
                : "never fired"}
            </MetaPill>
            {row.nextFireAt !== null && row.enabled && (
              <MetaPill suppressHydrationWarning>
                next {formatInstant(row.nextFireAt)}
              </MetaPill>
            )}
          </div>
        </div>

        {cron.error && (
          <p className="max-w-4xl whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {cron.error}
          </p>
        )}

        {/* Single-column stack — content spans the full width in reading order. */}
        <div className="max-w-4xl space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Prompt</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {row.prompt}
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-sm font-semibold">Trigger</h2>
            {row.cron ? (
              <div className="space-y-1 text-sm">
                <p>
                  {describeCron(row.cron)}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    ({row.cron})
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.timezone
                    ? `Timezone ${row.timezone}`
                    : "Daemon-local time"}
                  {row.maxFires > 0 && ` · at most ${row.maxFires} fires`}
                  {` · fired ${row.fireCount} time${row.fireCount === 1 ? "" : "s"}`}
                </p>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <p suppressHydrationWarning>
                  Once at {formatInstant(row.oneShotAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.oneShotRetry
                    ? `Retries on failure, up to ${row.oneShotMaxRetries || "unlimited"} times`
                    : "No retry on failure"}
                </p>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Actions</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={firing}
                onClick={() => void fireNow()}
              >
                {firing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" />
                    Fire now
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  void act(() =>
                    row.enabled
                      ? cron.pauseJob(row.name)
                      : cron.resumeJob(row.name),
                  )
                }
              >
                {row.enabled ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setEditing(true)}
              >
                Edit
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
            <h2 className="text-sm font-semibold">Fire log</h2>
            {firesError ? (
              <p className="whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {firesError}
              </p>
            ) : fires === null ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Reading the fire log…
              </div>
            ) : fires.length === 0 ? (
              <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                This schedule has not fired yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Fired</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead className="text-right">Session</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fires.map((fire) => (
                      <TableRow key={fire.id}>
                        <TableCell
                          suppressHydrationWarning
                          className="whitespace-nowrap text-sm tabular-nums"
                        >
                          {formatInstant(fire.firedAt)}
                        </TableCell>
                        <TableCell
                          suppressHydrationWarning
                          className="whitespace-nowrap text-sm text-muted-foreground tabular-nums"
                        >
                          {fireDuration(fire)}
                        </TableCell>
                        <TableCell>
                          {fire.inFlight ? (
                            <Badge variant="success">
                              <span
                                aria-hidden="true"
                                className="size-1.5 animate-pulse rounded-full bg-current"
                              />
                              {fire.startedAt === null
                                ? "claimed"
                                : "in flight"}
                            </Badge>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant={fire.err ? "destructive" : "secondary"}
                              >
                                {fire.stop}
                              </Badge>
                              {fire.err && (
                                <span className="max-w-[24rem] whitespace-pre-wrap text-xs text-destructive">
                                  {fire.err}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {fire.sessionId ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-full text-xs"
                              onClick={() =>
                                setTranscript({
                                  sessionId: fire.sessionId,
                                  label: `${row.name} — ${formatInstant(fire.firedAt)}`,
                                })
                              }
                            >
                              View transcript
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </div>

        {editing && (
          <EditScheduleDialog
            row={row}
            updateFromDraft={cron.updateFromDraft}
            onClose={() => setEditing(false)}
          />
        )}

        {transcript && (
          <TranscriptDialog
            sessionId={transcript.sessionId}
            label={transcript.label}
            onClose={() => setTranscript(null)}
          />
        )}

        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {row.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                The schedule stops firing. Past run transcripts stay in the
                session store.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  void cron.deleteJob(row.name).catch(() => {
                    // Refusal surfaces via cron.error on the list page.
                  });
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
