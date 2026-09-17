"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/formatters";
import {
  approvalBlockedReason,
  getLearningProposal,
  isProposalApprovable,
  type LearningEvidence,
  type LearningProposal,
  PROPOSAL_STATUS_DEFERRED,
  PROPOSAL_STATUS_PROMOTED,
  PROPOSAL_STATUS_STAGED,
} from "@/lib/harness/learning";
import { cn } from "@/lib/utils";

/**
 * One proposal in the review queue: the bounded digest, the status-appropriate
 * actions, and a Details disclosure with what mecatui's `/reflections`
 * detail view shows — every evidence handle's provenance (source session,
 * locator:ordinal, event seq, tool call, digest, whether it still resolves)
 * and redacted preview, the decision history, the promotion receipt, and the
 * learned skill a materialized procedure became.
 *
 * Approve is offered for staged AND deferred proposals (approving a deferred
 * procedure materializes its learned-skill draft), enabled only when every
 * evidence handle still resolves (`isProposalApprovable`); Reject is
 * staged-only, as the daemon's store refuses it elsewhere. Opening Details
 * re-reads the proposal so what it shows is current, and says so when the
 * version moved underneath the list.
 */
export function ProposalRow({
  proposal,
  busy,
  onApprove,
  onReject,
  onUndo,
  onReplace,
}: {
  proposal: LearningProposal;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onUndo: () => void;
  /** The list swaps in the re-read proposal when Details finds a newer one. */
  onReplace: (updated: LearningProposal) => void;
}) {
  const detailsId = useId();
  const [open, setOpen] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [detailNotice, setDetailNotice] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const updated = formatRelativeTime(proposal.updatedAtUnix * 1000);
  const digest = proposal.value || proposal.body;
  const title = proposal.title || proposal.key || proposal.id;
  const decidable =
    proposal.status === PROPOSAL_STATUS_STAGED ||
    proposal.status === PROPOSAL_STATUS_DEFERRED;
  const approvable = isProposalApprovable(proposal);
  const blockedReason = approvalBlockedReason(proposal);
  const undoTitle = proposal.promotionAvailable
    ? undefined
    : proposal.promotionUnavailableReason ||
      "This partition has no trusted memory target.";

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (!next || refreshed) return;
    setRefreshed(true);
    // First open: re-read so the availability flags and version are live.
    getLearningProposal(proposal.id)
      .then((current) => {
        setDetailError(null);
        if (current.version !== proposal.version) {
          setDetailNotice(
            `This proposal changed since the queue was loaded (version ${proposal.version} → ${current.version}) — showing the current version. Review it again before deciding.`,
          );
          onReplace(current);
        }
      })
      .catch((caught) => {
        setDetailError(
          `Could not refresh this proposal: ${
            caught instanceof Error ? caught.message : String(caught)
          }`,
        );
      });
  };

  return (
    <li
      className="space-y-2 rounded-lg border p-3"
      data-proposal-id={proposal.id}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {title}
        </span>
        {proposal.kind && <Badge variant="muted">{proposal.kind}</Badge>}
        {proposal.projectScoped && <Badge variant="outline">project</Badge>}
        {updated && (
          <span className="text-xs text-muted-foreground">{updated} ago</span>
        )}
      </div>
      {proposal.key && proposal.key !== title && (
        <p className="truncate font-mono text-xs text-muted-foreground">
          {proposal.key}
        </p>
      )}
      {proposal.description && (
        <p className="text-xs text-muted-foreground">{proposal.description}</p>
      )}
      {digest && (
        <pre className="max-h-48 overflow-y-auto rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
          {digest}
        </pre>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {proposal.evidenceCount > 0 && (
          <span>
            {proposal.evidenceCount} evidence ref
            {proposal.evidenceCount === 1 ? "" : "s"}
          </span>
        )}
        {proposal.triggers.slice(0, 4).map((trigger) => (
          <Badge key={trigger} variant="outline">
            {trigger}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {decidable && (
          <Button
            size="sm"
            disabled={busy || !approvable}
            title={blockedReason}
            onClick={onApprove}
          >
            Approve
          </Button>
        )}
        {proposal.status === PROPOSAL_STATUS_STAGED && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onReject}
          >
            Reject
          </Button>
        )}
        {proposal.status === PROPOSAL_STATUS_PROMOTED && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !proposal.promotionAvailable}
            title={undoTitle}
            onClick={onUndo}
          >
            Undo promotion
          </Button>
        )}
        {proposal.status !== PROPOSAL_STATUS_STAGED &&
          proposal.status !== PROPOSAL_STATUS_PROMOTED && (
            <Badge variant="muted">
              {proposal.status.replaceAll("_", " ")}
            </Badge>
          )}
        {decidable && !approvable && blockedReason && (
          <span className="text-xs text-muted-foreground">{blockedReason}</span>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={toggle}
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
            aria-hidden
          />
          Details
        </button>
      </div>
      {open && (
        <div
          id={detailsId}
          className="space-y-3 border-t pt-3 text-xs"
          data-testid="proposal-details"
        >
          {detailNotice && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
              {detailNotice}
            </p>
          )}
          {detailError && <p className="text-destructive">{detailError}</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
            <dt>Status</dt>
            <dd>{proposal.status.replaceAll("_", " ")}</dd>
            <dt>Version</dt>
            <dd className="font-mono">{proposal.version}</dd>
            <dt>Scope</dt>
            <dd>{proposal.projectScoped ? "trusted project" : "operator"}</dd>
          </dl>
          <section className="space-y-1.5">
            <h4 className="font-medium text-foreground">
              Evidence ({proposal.evidence.length})
            </h4>
            {proposal.evidence.length === 0 ? (
              <p className="text-muted-foreground">
                No evidence recorded — this proposal cannot be approved.
              </p>
            ) : (
              <ul className="space-y-2">
                {proposal.evidence.map((ref) => (
                  <EvidenceRow
                    key={`${ref.sessionId}:${ref.locator}:${ref.ordinal}:${ref.eventSeq}:${ref.digest}`}
                    evidence={ref}
                  />
                ))}
              </ul>
            )}
          </section>
          {proposal.decisions.length > 0 && (
            <section className="space-y-1.5">
              <h4 className="font-medium text-foreground">Decisions</h4>
              <ul className="space-y-1 text-muted-foreground">
                {proposal.decisions.map((decision) => {
                  const when = formatRelativeTime(decision.atUnix * 1000);
                  return (
                    <li
                      key={`${decision.kind}:${decision.actor}:${decision.atUnix}:${decision.reason}`}
                      className="flex flex-wrap items-center gap-x-2"
                    >
                      <span className="font-medium text-foreground">
                        {decision.kind}
                      </span>
                      {decision.actor && <span>· {decision.actor}</span>}
                      {decision.reason && <span>· {decision.reason}</span>}
                      {when && <span>· {when} ago</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {proposal.promotion && (
            <section className="space-y-1">
              <h4 className="font-medium text-foreground">Promotion receipt</h4>
              <p className="text-muted-foreground">
                Wrote memory key{" "}
                <span className="font-mono text-foreground">
                  {proposal.promotion.memoryKey}
                </span>{" "}
                at version{" "}
                <span className="font-mono">
                  {proposal.promotion.resultVersion}
                </span>
                {proposal.promotion.previousExists
                  ? ` (replaced version ${proposal.promotion.previousVersion})`
                  : " (new key)"}
                .
              </p>
            </section>
          )}
          {proposal.learnedSkillId && (
            <section className="space-y-1">
              <h4 className="font-medium text-foreground">Learned skill</h4>
              <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
                <span className="font-mono">{proposal.learnedSkillId}</span>
                <Link
                  href="/workspace/skills?view=learned"
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  View learned skill
                </Link>
              </p>
            </section>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * One evidence handle: `locator:ordinal · seq N · call <id> · digest <10>`
 * with an Available/Unavailable badge (the daemon's reason when it gives
 * one), a link to the source chat, and the redacted preview.
 */
function EvidenceRow({ evidence }: { evidence: LearningEvidence }) {
  const shortDigest = evidence.digest.slice(0, 10);
  return (
    <li className="space-y-1 rounded-md border px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-muted-foreground">
        <span className="text-foreground">
          {evidence.locator || "evidence"}:{evidence.ordinal}
        </span>
        {evidence.eventSeq !== 0 && <span>· seq {evidence.eventSeq}</span>}
        {evidence.toolCallId && <span>· call {evidence.toolCallId}</span>}
        {evidence.digest && (
          <span title={evidence.digest}>· digest {shortDigest}</span>
        )}
        <Badge
          variant={evidence.available ? "success" : "warning"}
          className="font-sans"
        >
          {evidence.available ? "Available" : "Unavailable"}
          {!evidence.available && evidence.availability
            ? ` (${evidence.availability})`
            : ""}
        </Badge>
      </div>
      {evidence.sessionId && (
        <p className="text-muted-foreground">
          Source session{" "}
          <Link
            href={`/workspace/chat/${encodeURIComponent(evidence.sessionId)}`}
            className="font-mono text-foreground underline-offset-4 hover:underline"
          >
            {evidence.sessionId}
          </Link>
        </p>
      )}
      {evidence.preview && (
        <pre className="max-h-40 overflow-y-auto rounded-md bg-muted px-2.5 py-1.5 font-mono whitespace-pre-wrap text-muted-foreground">
          {evidence.preview}
        </pre>
      )}
    </li>
  );
}
