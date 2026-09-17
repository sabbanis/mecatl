"use client";

import { useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import { formatUntilTime } from "@/lib/formatters";
import {
  type DreamDecision,
  type DreamParticipant,
  type DreamPlan,
  type DreamReceipt,
  type DreamTarget,
  decideDreamPlan,
  describeDreamDecisionPending,
  describeDreamUnavailable,
  describeStaleDreamPlan,
  dreamTargetCapability,
  generateDreamPlan,
  isDreamInProgress,
  isStaleDreamPlan,
  listDreamTargets,
} from "@/lib/harness/dream";
import { SettingsCard } from "../../_components/settings-card";

/**
 * Manual memory consolidation (ADR 0227): the daemon curates a bounded merge
 * plan over its own memory store; the human applies or dismisses the WHOLE
 * plan. This stays inside memory rule 8 — Studio never composes memory
 * content, it only decides on what the daemon proposed.
 *
 * Parity with mecatui's /dream overlay:
 * - Generating (and regenerating) is confirmed first — it sends the memory to
 *   the model and spends tokens.
 * - A decision whose outcome is still open (`dream_in_progress`, or a dropped
 *   connection) locks the card to retrying the SAME decision: the daemon's
 *   decide is idempotent and answers the authoritative receipt. The opposite
 *   decision and a fresh plan stay unavailable until it settles.
 * - A plan that is no longer actionable (vanished, expired, a conflicting or
 *   terminal decision) clears with a "generate a new one" notice.
 * - Targets the daemon reports but cannot serve render disabled with the
 *   daemon's reason instead of being hidden.
 */

const TARGET_LABELS: Record<DreamTarget, string> = {
  user_model: "User model (facts about you)",
  project_memory: "Project memory",
};

const DECISION_RUNNING = "A decision on this plan is still running.";

/** The receipt's one-line count summary — every bucket, planned first. */
export function describeDreamReceipt(receipt: DreamReceipt): string {
  return `${receipt.planned} planned · ${receipt.applied} applied · ${receipt.conflicted} conflicted · ${receipt.skipped} skipped · ${receipt.failed} failed`;
}

const errorMessage = (caught: unknown) =>
  caught instanceof Error ? caught.message : String(caught);

/** The daemon's disposition is the decision it took (`apply`/`dismiss`);
 *  a dismissal mutates nothing, so it carries no per-entry outcome notes. */
const isDismissed = (receipt: DreamReceipt) =>
  receipt.disposition === "dismiss" || receipt.disposition === "dismissed";

export function ConsolidateMemoryCard() {
  const { connected, serverCapabilities } = useRuntimeStatus();
  const manualDream = serverCapabilities.manual_dream;

  const targets = useMemo(() => listDreamTargets(manualDream), [manualDream]);

  // null = "not chosen": the first target that can generate, else the first.
  const [chosenTarget, setChosenTarget] = useState<DreamTarget | null>(null);
  const [plan, setPlan] = useState<DreamPlan | null>(null);
  const [receipt, setReceipt] = useState<DreamReceipt | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);
  // The decision whose outcome is still open; only that decision may be
  // retried while it is set (never automatically).
  const [pendingDecision, setPendingDecision] = useState<DreamDecision | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);

  // Absent capability → the surface hides entirely (older/leaner daemon).
  if (targets.length === 0) return null;

  const effectiveTarget: DreamTarget =
    chosenTarget && targets.includes(chosenTarget)
      ? chosenTarget
      : (targets.find(
          (candidate) => dreamTargetCapability(manualDream, candidate).generate,
        ) ?? targets[0]);
  const capability = dreamTargetCapability(manualDream, effectiveTarget);
  const unavailable = describeDreamUnavailable(capability.unavailableReason);

  const generate = async () => {
    setConfirmGenerate(false);
    setIsGenerating(true);
    setError(null);
    setNotice(null);
    setReceipt(null);
    setPlan(null);
    setPendingDecision(null);
    try {
      setPlan(await generateDreamPlan(effectiveTarget));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsGenerating(false);
    }
  };

  const decide = async (decision: DreamDecision) => {
    if (!plan) return;
    setIsDeciding(true);
    setError(null);
    setNotice(null);
    try {
      setReceipt(await decideDreamPlan(plan.id, decision));
      setPlan(null);
      setPendingDecision(null);
    } catch (caught) {
      if (isDreamInProgress(caught)) {
        // Outcome still open: keep the plan, lock to this same decision.
        setPendingDecision(decision);
        setNotice(describeDreamDecisionPending(caught, decision));
      } else if (isStaleDreamPlan(caught)) {
        // Vanished, expired, or a conflicting/terminal decision won.
        setPlan(null);
        setPendingDecision(null);
        setNotice(describeStaleDreamPlan(caught));
      } else {
        // Unknown failure: the plan stays reviewable; an already-open
        // decision stays locked until a terminal answer arrives.
        setError(errorMessage(caught));
      }
    } finally {
      setIsDeciding(false);
    }
  };

  const generateBlocked = pendingDecision
    ? "A decision on the current plan is still running — retry it first."
    : capability.generate
      ? undefined
      : unavailable || "This daemon cannot generate plans for this memory.";
  const generateLabel = isGenerating
    ? "Generating…"
    : plan
      ? "Regenerate plan"
      : "Generate plan";

  const applyBlocked =
    pendingDecision === "dismiss"
      ? DECISION_RUNNING
      : capability.decide
        ? undefined
        : unavailable
          ? `This daemon does not permit applying plans: ${unavailable}`
          : "This daemon does not permit applying plans.";
  const dismissBlocked =
    pendingDecision === "apply" ? DECISION_RUNNING : undefined;

  const expiresIn =
    plan && plan.expiresAtUnix > 0
      ? formatUntilTime(plan.expiresAtUnix * 1000)
      : "";

  return (
    <SettingsCard
      title="Consolidate memory"
      description="The daemon proposes merging duplicate or overlapping memories; nothing changes until you apply its plan."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {targets.length > 1 ? (
            <Select
              value={effectiveTarget}
              onValueChange={(value) => setChosenTarget(value as DreamTarget)}
            >
              <SelectTrigger
                className="w-64"
                aria-label="Memory to consolidate"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targets.map((value) => {
                  const targetCapability = dreamTargetCapability(
                    manualDream,
                    value,
                  );
                  const reason = describeDreamUnavailable(
                    targetCapability.unavailableReason,
                  );
                  return (
                    <SelectItem
                      key={value}
                      value={value}
                      disabled={!targetCapability.generate}
                      title={
                        targetCapability.generate
                          ? undefined
                          : reason || undefined
                      }
                    >
                      {TARGET_LABELS[value]}
                      {!targetCapability.generate && " (unavailable)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">
              {TARGET_LABELS[effectiveTarget]}
            </span>
          )}
          <Button
            size="sm"
            disabled={
              !connected ||
              isGenerating ||
              isDeciding ||
              Boolean(generateBlocked)
            }
            title={generateBlocked}
            onClick={() => setConfirmGenerate(true)}
          >
            {generateLabel}
          </Button>
        </div>
        {(!capability.generate || !capability.decide) && (
          <p
            className="text-xs text-muted-foreground"
            data-testid="dream-unavailable"
          >
            {capability.generate
              ? "Plans can be generated but not applied here"
              : "Plans cannot be generated for this memory"}
            {unavailable ? `: ${unavailable}` : "."}
          </p>
        )}
        {isGenerating && (
          <p className="text-xs text-muted-foreground">
            The daemon is reviewing its memories — this can take a minute.
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
          >
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {plan && plan.operations.length === 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Nothing to consolidate — this memory is already tidy.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={isDeciding}
              onClick={() => void decide("dismiss")}
            >
              {pendingDecision === "dismiss" ? "Retry — fetch receipt" : "Done"}
            </Button>
          </div>
        )}

        {plan && plan.operations.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm" data-testid="dream-plan-summary">
              {plan.plannedOperationCount} operation
              {plan.plannedOperationCount === 1 ? "" : "s"} over{" "}
              {plan.plannedSourceCount} memor
              {plan.plannedSourceCount === 1 ? "y" : "ies"}. Review, then apply
              or dismiss the whole plan.
              {expiresIn && (
                <span className="text-muted-foreground">
                  {" "}
                  Expires in {expiresIn}.
                </span>
              )}
            </p>
            <ul className="space-y-2">
              {plan.operations.map((operation) => (
                <li
                  // A plan is immutable once generated; kind + survivor +
                  // sources identify an operation within it.
                  key={`${operation.kind}:${operation.survivor.key}:${operation.sources
                    .map((source) => source.key)
                    .join(",")}`}
                  className="space-y-2 rounded-lg border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="muted">
                      {operation.kind.replaceAll("_", " ") || "merge"}
                    </Badge>
                    {operation.exactDuplicateEligible && (
                      <Badge variant="outline">exact duplicate</Badge>
                    )}
                    {operation.reason && (
                      <span className="text-xs text-muted-foreground">
                        {operation.reason}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-medium">
                      Keeps{" "}
                      <span className="font-mono">
                        {operation.survivor.key}
                      </span>
                      {operation.sources.length > 0 && (
                        <>
                          {" "}
                          — absorbs{" "}
                          {operation.sources.map((source, i) => (
                            <span key={source.key} className="font-mono">
                              {i > 0 && ", "}
                              {source.key}
                            </span>
                          ))}
                        </>
                      )}
                    </p>
                    {operation.replacement.value && (
                      <pre className="max-h-32 overflow-y-auto rounded-md bg-muted px-3 py-2 font-mono whitespace-pre-wrap text-muted-foreground">
                        {operation.replacement.value}
                      </pre>
                    )}
                    {operation.replacement.description && (
                      <p className="text-muted-foreground">
                        {operation.replacement.description}
                      </p>
                    )}
                    <details className="rounded-md border px-2 py-1">
                      <summary className="cursor-pointer select-none text-muted-foreground">
                        Show current values
                      </summary>
                      <dl className="mt-2 space-y-2">
                        <DreamParticipantDetail
                          label="Keeps"
                          participant={operation.survivor}
                        />
                        {operation.sources.map((source) => (
                          <DreamParticipantDetail
                            key={source.key}
                            label="Absorbs"
                            participant={source}
                          />
                        ))}
                      </dl>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={isDeciding || Boolean(applyBlocked)}
                title={applyBlocked}
                onClick={() =>
                  pendingDecision === "apply"
                    ? void decide("apply")
                    : setConfirmApply(true)
                }
              >
                {pendingDecision === "apply"
                  ? "Retry apply — fetch receipt"
                  : "Apply plan"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isDeciding || Boolean(dismissBlocked)}
                title={dismissBlocked}
                onClick={() => void decide("dismiss")}
              >
                {pendingDecision === "dismiss"
                  ? "Retry dismiss — fetch receipt"
                  : "Dismiss"}
              </Button>
            </div>
          </div>
        )}

        {receipt && (
          <div
            className="space-y-1 text-sm text-muted-foreground"
            data-testid="dream-receipt"
          >
            <p>
              {isDismissed(receipt)
                ? "Plan dismissed — nothing changed."
                : `Applied: ${describeDreamReceipt(receipt)}.`}
            </p>
            {!isDismissed(receipt) && receipt.conflicted > 0 && (
              <p>
                Memory changed after the plan was generated; the conflicted
                entries were left as they are — generate a new plan to review
                them again.
              </p>
            )}
            {!isDismissed(receipt) && receipt.failed > 0 && (
              <p>
                Partial result: some entries failed to merge. The counts above
                are the authoritative outcome.
              </p>
            )}
          </div>
        )}
      </div>

      <AlertDialog open={confirmGenerate} onOpenChange={setConfirmGenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {plan
                ? "Regenerate the consolidation plan?"
                : "Generate a consolidation plan?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              The daemon asks the model to review this memory — it sends the
              memory&apos;s full values and descriptions to the configured model
              and spends tokens.
              {plan && " The plan shown now is discarded."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void generate()}>
              {plan ? "Regenerate" : "Generate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply the consolidation plan?</AlertDialogTitle>
            <AlertDialogDescription>
              The daemon merges the listed memories exactly as shown. Absorbed
              entries are replaced by their survivor; a memory that changed
              since planning is skipped as conflicted, never overwritten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmApply(false);
                void decide("apply");
              }}
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsCard>
  );
}

/** One participant's current stored value + description, as the daemon
 *  holds it now — what the operation keeps or absorbs. */
function DreamParticipantDetail({
  label,
  participant,
}: {
  label: string;
  participant: DreamParticipant;
}) {
  return (
    <div className="space-y-1">
      <dt className="font-medium">
        <span className="text-muted-foreground">{label} </span>
        <span className="font-mono">{participant.key || "(unnamed)"}</span>
      </dt>
      <dd className="space-y-1">
        <pre className="max-h-32 overflow-y-auto rounded-md bg-muted px-3 py-2 font-mono whitespace-pre-wrap text-muted-foreground">
          {participant.value || "(empty)"}
        </pre>
        {participant.description && (
          <p className="text-muted-foreground">{participant.description}</p>
        )}
      </dd>
    </div>
  );
}
