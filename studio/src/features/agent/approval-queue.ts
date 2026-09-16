import type { ApprovalRequest } from "./types";

/**
 * The FIFO permission-ask queue (the TUI's concurrent-asks model).
 *
 * The daemon can surface more than one ask at a time — a parent's ask and a
 * child's, or a parallel read batch's — and each `permission.ask` frame is
 * its own ask. The head is the one on screen; later asks wait behind it and
 * take the screen in arrival order as verdicts and retractions settle the
 * ones ahead. Pure functions over an immutable array: the hook keeps the
 * array in state (and a ref) and feeds every frame through here.
 *
 * Every function returns the SAME array when nothing changed, so a redundant
 * frame (a re-surfaced known ask, a retract for an ask already answered)
 * costs no render.
 */

/**
 * Classifies an ask as a child (subagent / team member / parallel branch)
 * ask by its id, the TUI heuristic (cmd/mecatui/ui/approval_surface.go).
 *
 * The daemon's ask-id grammar is `<sessionID>:<n>:<callID>:<discriminator>`
 * where `<sessionID>` is the session that OWNS the ask: the live session for
 * a main-agent ask, the CHILD session for a surfaced child ask. So an id with
 * a colon that is not prefixed by `<sessionId>:` is a child's. Fail-safe both
 * ways: a colon-free fixture id is the main agent (Always allow is offered),
 * and an empty sessionId classifies everything as a child (Always allow is
 * merely withheld, never wrongly granted).
 *
 * `sessionId` MUST be the DAEMON session id, never a Studio-local chat id —
 * with the wrong namespace every main ask reads as a child's.
 */
export function isChildAsk(askId: string, sessionId: string): boolean {
  return askId.includes(":") && !askId.startsWith(`${sessionId}:`);
}

/** Quiet human framing for an approval verdict line. */
export const APPROVAL_VERDICT_LABELS: Record<string, string> = {
  allow_once: "allowed once",
  allow_always: "always allowed",
  deny: "denied",
};

/**
 * The one-line record of a verdict — `Permission: <tool> allowed once`.
 * Shared by the durable watch's `approval_verdict` reducer arm and the
 * hook's LOCAL record at respond time (EvApproval is log-only and never
 * reaches the live prompt stream), so a rebuilt transcript reads exactly
 * like the live one did.
 */
export function formatVerdictNotice(
  toolName: string | undefined,
  verdict: string,
): string {
  const label = APPROVAL_VERDICT_LABELS[verdict] ?? verdict;
  return `Permission: ${toolName || "tool"} ${label || "resolved"}`;
}

/**
 * The notice left on the turn when a CHILD ask is withdrawn (its subagent
 * was cancelled). A queued ask that vanishes silently reads as a glitch, so
 * the TUI writes one line; `wasHead` distinguishes the ask that was on
 * screen from one still waiting behind it.
 */
export function retractedAskNotice(wasHead: boolean): string {
  return wasHead
    ? "Permission request withdrawn — the subagent that asked was cancelled"
    : "Queued permission request withdrawn — the subagent that asked was cancelled";
}

/**
 * Appends an ask in FIFO order. A known approvalId is a re-surface of an ask
 * already queued (the daemon re-delivers on reattach), not a second ask:
 * the queue is returned unchanged.
 */
export function enqueueAsk(
  queue: ApprovalRequest[],
  ask: ApprovalRequest,
): ApprovalRequest[] {
  if (queue.some((entry) => entry.approvalId === ask.approvalId)) {
    return queue;
  }
  return [...queue, ask];
}

/**
 * Withdraws an ask wherever it sits in the queue, reporting what was removed
 * and whether it was the head (the one on screen). An unknown id — already
 * answered, or never seen — removes nothing and returns the same array.
 */
export function retractAsk(
  queue: ApprovalRequest[],
  approvalId: string,
): {
  queue: ApprovalRequest[];
  removed: ApprovalRequest | null;
  wasHead: boolean;
} {
  const index = queue.findIndex((entry) => entry.approvalId === approvalId);
  if (index < 0) return { queue, removed: null, wasHead: false };
  return {
    queue: [...queue.slice(0, index), ...queue.slice(index + 1)],
    removed: queue[index],
    wasHead: index === 0,
  };
}

/**
 * Settles an ask (a verdict was given, here or by another client): the
 * queue without it, so the next ask advances to the head. Same array when
 * the id is not queued.
 */
export function resolveAsk(
  queue: ApprovalRequest[],
  approvalId: string,
): ApprovalRequest[] {
  return retractAsk(queue, approvalId).queue;
}

/**
 * The head's place in the queue for the panel's "1 of N" badge: undefined
 * when nothing is queued, `{index: 1, total}` otherwise (the head is always
 * position 1 — later asks are not rendered until they reach it).
 */
export function approvalQueuePosition(
  length: number,
): { index: number; total: number } | undefined {
  return length > 0 ? { index: 1, total: length } : undefined;
}
