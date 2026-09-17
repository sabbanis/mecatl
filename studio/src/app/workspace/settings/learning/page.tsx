"use client";

import { GraduationCap, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { fetchAllSessions } from "@/lib/harness/client";
import {
  decideLearningProposal,
  isProposalConflict,
  type LearningProposal,
  listLearningProposals,
  PROPOSAL_STATUS_DEFERRED,
  PROPOSAL_STATUS_PROMOTED,
  PROPOSAL_STATUS_REJECTED,
  PROPOSAL_STATUS_STAGED,
  type ReflectionReceipt,
  reflectHarnessSession,
  undoLearningPromotion,
} from "@/lib/harness/learning";
import { cn } from "@/lib/utils";
import { LearningModeSection } from "../_components/learning-mode-section";
import { Note, SettingsCard } from "../_components/settings-card";
import { ProposalRow } from "./_components/proposal-row";

/**
 * Settings → Learning: the human half of the daemon's reflection loop
 * (ADR 0109). Pending proposals are reviewed here — approve promotes the
 * daemon-curated digest into memory, reject retires it, undo reverts a
 * promotion. Studio never composes memory content; it only decides on what
 * the daemon staged (the same posture as the read-only Memory panel).
 */

/**
 * Status pills over the daemon's proposal vocabulary ("staged" = pending;
 * "deferred_unsupported" = a procedure the daemon could not promote when it
 * was staged, approvable now as a learned-skill draft). The value is the
 * exact token the list filter sends.
 */
const PROPOSAL_FILTERS = [
  {
    value: PROPOSAL_STATUS_STAGED,
    label: "Pending",
    empty: "waiting for review",
  },
  { value: PROPOSAL_STATUS_DEFERRED, label: "Deferred", empty: "deferred" },
  { value: PROPOSAL_STATUS_PROMOTED, label: "Promoted", empty: "promoted" },
  { value: PROPOSAL_STATUS_REJECTED, label: "Rejected", empty: "rejected" },
] as const;
type ProposalFilterValue = (typeof PROPOSAL_FILTERS)[number]["value"];

/** One page of the queue per request; Load more appends the next. */
const PROPOSAL_PAGE_SIZE = 50;

export default function LearningSettingsPage() {
  const runtime = useRuntimeStatus();
  const proposalsSupported =
    runtime.serverCapabilities.learning_proposals === true;
  const reflectionSupported = runtime.serverCapabilities.reflection === true;

  const learningSupported = proposalsSupported || reflectionSupported;

  // The mode control renders FIRST whatever the capabilities say: with
  // learning off the daemon advertises neither proposals nor reflection, and
  // this card is how a managed-mode operator turns it on.
  return (
    <>
      <LearningModeSection />
      {!learningSupported ? (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <GraduationCap className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-sm font-semibold">
                Learning is not enabled on this daemon
              </h2>
              <p className="text-sm text-muted-foreground">
                This daemon reports neither learning proposals nor reflection.
                Turn learning on above (managed mode) or set learning.mode in
                the daemon&rsquo;s settings, then review what the agent wants to
                remember here.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {proposalsSupported ? (
            <ProposalQueueCard connected={runtime.connected} />
          ) : (
            <SettingsCard title="Review queue">
              <Note>Learning proposals are not enabled on this daemon.</Note>
            </SettingsCard>
          )}
          {reflectionSupported && (
            <ReflectionCard connected={runtime.connected} />
          )}
        </>
      )}
    </>
  );
}

function ProposalQueueCard({ connected }: { connected: boolean }) {
  const [filter, setFilter] = useState<ProposalFilterValue>(
    PROPOSAL_STATUS_STAGED,
  );
  const [proposals, setProposals] = useState<LearningProposal[]>([]);
  /** The daemon's cursor for the page after the last one shown; "" = end. */
  const [nextCursor, setNextCursor] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** (Re)loads the FIRST page of the current filter, dropping any pages
   *  appended after it — a refresh restarts the walk from the daemon's head. */
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const page = await listLearningProposals(
          { status: filter, limit: PROPOSAL_PAGE_SIZE },
          signal,
        );
        if (signal?.aborted) return;
        setProposals(page.proposals);
        setNextCursor(page.nextCursor);
        setError(null);
      } catch (caught) {
        if (signal?.aborted) return;
        setProposals([]);
        setNextCursor("");
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [connected, load]);

  const refresh = () => {
    setNotice(null);
    setIsLoading(true);
    void load();
  };

  /** Appends the next page (the daemon's cursor); ids already shown are
   *  skipped so a queue that moved between pages never lists one twice. */
  const loadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await listLearningProposals({
        status: filter,
        cursor: nextCursor,
        limit: PROPOSAL_PAGE_SIZE,
      });
      setProposals((current) => {
        const seen = new Set(current.map((proposal) => proposal.id));
        return [
          ...current,
          ...page.proposals.filter((proposal) => !seen.has(proposal.id)),
        ];
      });
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsLoadingMore(false);
    }
  };

  /** Details re-read a proposal; the list shows that current version. */
  const replaceProposal = (updated: LearningProposal) => {
    setProposals((current) =>
      current.map((proposal) =>
        proposal.id === updated.id ? updated : proposal,
      ),
    );
  };

  /**
   * Runs one decision/undo. A 409 proposal_conflict means the proposal
   * changed underneath the review — the honest move is refresh-and-re-review,
   * never a blind retry with the new version.
   */
  const act = async (
    proposal: LearningProposal,
    run: () => Promise<LearningProposal>,
    done: string,
  ) => {
    setBusyId(proposal.id);
    setNotice(null);
    try {
      await run();
      toast.success(done);
      await load();
    } catch (caught) {
      if (isProposalConflict(caught)) {
        setNotice(
          "That proposal changed since it was loaded — the queue was refreshed. Review it again before deciding.",
        );
        await load();
      } else {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SettingsCard
      title="Review queue"
      description="What the agent wants to remember. Approving promotes the daemon-curated digest into memory; nothing here is free-text."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-0.5 rounded-full bg-muted p-1">
            {PROPOSAL_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => {
                  setFilter(f.value);
                  setNotice(null);
                }}
                className={cn(
                  "h-7 rounded-full px-3.5 text-sm transition-colors",
                  filter === f.value
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refresh proposals"
            title="Refresh proposals"
            disabled={!connected || isLoading}
            onClick={refresh}
          >
            <RotateCw className={cn(isLoading && "animate-spin")} />
          </Button>
        </div>

        {notice && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            {notice}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {isLoading && connected ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Loading proposals…
          </p>
        ) : proposals.length === 0 ? (
          <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            {filter === PROPOSAL_STATUS_STAGED
              ? "Nothing waiting for review."
              : `No ${PROPOSAL_FILTERS.find((f) => f.value === filter)?.empty ?? filter} proposals.`}
          </p>
        ) : (
          <ul className="space-y-3">
            {proposals.map((proposal) => (
              <ProposalRow
                key={proposal.id}
                proposal={proposal}
                busy={busyId === proposal.id}
                onReplace={replaceProposal}
                onApprove={() =>
                  act(
                    proposal,
                    () =>
                      decideLearningProposal(
                        proposal.id,
                        "approve",
                        proposal.version,
                      ),
                    "Proposal approved",
                  )
                }
                onReject={() =>
                  act(
                    proposal,
                    () =>
                      decideLearningProposal(
                        proposal.id,
                        "reject",
                        proposal.version,
                      ),
                    "Proposal rejected",
                  )
                }
                onUndo={() =>
                  act(
                    proposal,
                    () => undoLearningPromotion(proposal.id, proposal.version),
                    "Promotion undone",
                  )
                }
              />
            ))}
          </ul>
        )}
        {!isLoading && nextCursor !== "" && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoadingMore || !connected}
              onClick={() => void loadMore()}
            >
              {isLoadingMore ? "Loading more…" : "Load more"}
            </Button>
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

/**
 * Explicit reflection over one completed chat: the daemon re-reads the
 * session and stages proposals from it (which then land in the queue above).
 * Synchronous and model-driven — it can take a minute.
 */
function ReflectionCard({ connected }: { connected: boolean }) {
  const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [isReflecting, setIsReflecting] = useState(false);
  const [receipt, setReceipt] = useState<ReflectionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    // One inventory page is plenty for a picker; rows arrive newest-first.
    fetchAllSessions(controller.signal, 1)
      .then(({ sessions: rows }) => {
        if (controller.signal.aborted) return;
        setSessions(
          rows
            .filter((row) => row.isChat && row.state === "completed")
            .slice(0, 20)
            .map((row) => ({
              id: row.sessionId,
              title: row.title || row.sessionId,
            })),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setSessions([]);
      });
    return () => controller.abort();
  }, [connected]);

  const reflect = async () => {
    if (!selected) return;
    setIsReflecting(true);
    setError(null);
    setReceipt(null);
    try {
      setReceipt(await reflectHarnessSession(selected));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsReflecting(false);
    }
  };

  const summary = useMemo(() => {
    if (!receipt) return null;
    if (receipt.abstained) {
      return "The daemon abstained — nothing in that session was worth remembering.";
    }
    const parts = [
      `${receipt.staged} staged`,
      `${receipt.promoted} promoted`,
      `${receipt.conflicted} conflicted`,
    ];
    if (receipt.queued > 0) parts.push(`${receipt.queued} queued`);
    return parts.join(" · ");
  }, [receipt]);

  return (
    <SettingsCard
      title="Reflect on a session"
      description="Asks the daemon to re-read a completed chat and stage anything worth remembering into the review queue."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full min-w-0 sm:w-96">
              <SelectValue placeholder="Pick a completed chat…" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  {session.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!selected || isReflecting || !connected}
            onClick={() => void reflect()}
          >
            {isReflecting ? "Reflecting…" : "Reflect"}
          </Button>
        </div>
        {sessions.length === 0 && (
          <Note>No completed chats to reflect on yet.</Note>
        )}
        {isReflecting && (
          <p className="text-xs text-muted-foreground">
            Reflection is model-driven and can take a minute — leave this page
            open.
          </p>
        )}
        {summary && (
          <p className="text-sm text-muted-foreground">
            Reflection {receipt?.disposition || "finished"}: {summary}
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </SettingsCard>
  );
}
