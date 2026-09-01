/**
 * Learning review queue + explicit reflection (ADR 0109).
 *
 * Wire: `GET /v1/learning/proposals` (status/cursor/limit filters),
 * `GET /v1/learning/proposals/{id}`, `POST .../decision` (approve/reject with
 * `expected_version` — a stale version answers 409 `proposal_conflict`),
 * `POST .../undo`, and `POST /v1/sessions/{id}/reflect`.
 *
 * Responses are stdlib JSON over the proto structs (snake_case keys, absent =
 * zero value); gated by `capabilities.learning_proposals` /
 * `capabilities.reflection` on GET /v1/compatibility. The `project` query is
 * deliberately never sent: Studio reads the operator-scope partition — the
 * browser never knows the workspace path (rule 2).
 */

import { apiError, HARNESS_API, HarnessApiError } from "./client";
import {
  asArray,
  asBool,
  asNumber,
  asRecord,
  asString,
  asStringArray,
  timestampUnix,
} from "./wire";

/** One human decision recorded on a proposal. */
export interface LearningDecision {
  kind: string;
  actor: string;
  reason: string;
  atUnix: number;
}

/**
 * One learning proposal, decoded from the daemon's bounded digest projection.
 * `status` is the daemon's vocabulary: staged (pending review), promoting,
 * promoted, rejected, deferred_unsupported, conflicted, undone,
 * skill_materialized.
 */
export interface LearningProposal {
  id: string;
  /** Optimistic-concurrency token — every decision/undo must carry it. */
  version: string;
  status: string;
  kind: string;
  key: string;
  value: string;
  description: string;
  title: string;
  body: string;
  triggers: string[];
  evidenceCount: number;
  decisions: LearningDecision[];
  createdAtUnix: number;
  updatedAtUnix: number;
  projectScoped: boolean;
  /** False when this partition has no trusted memory target — approve/undo disabled. */
  promotionAvailable: boolean;
  promotionUnavailableReason: string;
  /** Links a materialized procedure to its agent-owned learned skill. */
  learnedSkillId: string;
}

export function decodeLearningProposal(raw: unknown): LearningProposal {
  const record = asRecord(raw);
  return {
    id: asString(record.id),
    version: asString(record.version),
    status: asString(record.status),
    kind: asString(record.kind),
    key: asString(record.key),
    value: asString(record.value),
    description: asString(record.description),
    title: asString(record.title),
    body: asString(record.body),
    triggers: asStringArray(record.triggers),
    evidenceCount: asArray(record.evidence).length,
    decisions: asArray(record.decisions).map((decision) => {
      const entry = asRecord(decision);
      return {
        kind: asString(entry.kind),
        actor: asString(entry.actor),
        reason: asString(entry.reason),
        atUnix: timestampUnix(entry.at),
      };
    }),
    createdAtUnix: timestampUnix(record.created_at),
    updatedAtUnix: timestampUnix(record.updated_at),
    projectScoped: asBool(record.project_scoped),
    promotionAvailable: asBool(record.promotion_available),
    promotionUnavailableReason: asString(record.promotion_unavailable_reason),
    learnedSkillId: asString(record.learned_skill_id),
  };
}

export interface LearningProposalPage {
  proposals: LearningProposal[];
  nextCursor: string;
}

export async function listLearningProposals(
  options: { status?: string; cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<LearningProposalPage> {
  const query = new URLSearchParams();
  if (options.status) query.set("status", options.status);
  if (options.cursor) query.set("cursor", options.cursor);
  if (options.limit) query.set("limit", String(options.limit));
  const suffix = query.size > 0 ? `?${query}` : "";
  const response = await fetch(`${HARNESS_API}/learning/proposals${suffix}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw await apiError(response);
  const body = asRecord(await response.json());
  return {
    proposals: asArray(body.proposals).map(decodeLearningProposal),
    nextCursor: asString(body.next_cursor),
  };
}

export async function getLearningProposal(
  id: string,
  signal?: AbortSignal,
): Promise<LearningProposal> {
  const response = await fetch(
    `${HARNESS_API}/learning/proposals/${encodeURIComponent(id)}`,
    { signal, cache: "no-store" },
  );
  if (!response.ok) throw await apiError(response);
  return decodeLearningProposal(asRecord(await response.json()).proposal);
}

/**
 * Approves or rejects a proposal. `expectedVersion` is the version the review
 * UI showed: a proposal that changed underneath answers 409
 * `proposal_conflict` (see isProposalConflict) — refresh and re-review, never
 * blind-retry.
 */
export async function decideLearningProposal(
  id: string,
  decision: "approve" | "reject",
  expectedVersion: string,
  reason?: string,
): Promise<LearningProposal> {
  const response = await fetch(
    `${HARNESS_API}/learning/proposals/${encodeURIComponent(id)}/decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        expected_version: expectedVersion,
        ...(reason ? { reason } : {}),
      }),
    },
  );
  if (!response.ok) throw await apiError(response);
  return decodeLearningProposal(asRecord(await response.json()).proposal);
}

/** Reverts a promoted proposal's memory write (same conflict contract). */
export async function undoLearningPromotion(
  id: string,
  expectedVersion: string,
): Promise<LearningProposal> {
  const response = await fetch(
    `${HARNESS_API}/learning/proposals/${encodeURIComponent(id)}/undo`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expected_version: expectedVersion }),
    },
  );
  if (!response.ok) throw await apiError(response);
  return decodeLearningProposal(asRecord(await response.json()).proposal);
}

/** True when a decision/undo lost the optimistic-concurrency race. */
export function isProposalConflict(error: unknown): boolean {
  return (
    error instanceof HarnessApiError &&
    (error.code === "proposal_conflict" ||
      (error.code === "" && error.status === 409))
  );
}

/** The counts an explicit reflection pass returns. */
export interface ReflectionReceipt {
  reflectionId: string;
  disposition: string;
  queued: number;
  abstained: boolean;
  staged: number;
  promoted: number;
  conflicted: number;
}

/**
 * Runs an explicit reflection pass over one completed session
 * (`POST /v1/sessions/{id}/reflect`). Synchronous: the request lasts the
 * whole reflection run. Gated by `capabilities.reflection`.
 */
export async function reflectHarnessSession(
  sessionId: string,
  signal?: AbortSignal,
): Promise<ReflectionReceipt> {
  const response = await fetch(
    `${HARNESS_API}/sessions/${encodeURIComponent(sessionId)}/reflect`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal,
    },
  );
  if (!response.ok) throw await apiError(response);
  const receipt = asRecord(asRecord(await response.json()).receipt);
  return {
    reflectionId: asString(receipt.reflection_id),
    disposition: asString(receipt.disposition),
    queued: asNumber(receipt.queued),
    abstained: asBool(receipt.abstained),
    staged: asNumber(receipt.staged),
    promoted: asNumber(receipt.promoted),
    conflicted: asNumber(receipt.conflicted),
  };
}
