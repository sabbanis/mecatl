/**
 * Manual memory consolidation ("dream") review — ADR 0227.
 *
 * Wire: `POST /v1/dream/plans {target}` generates a bounded, daemon-curated
 * consolidation plan; `POST /v1/dream/plans/{plan_id}/decision {decision}`
 * applies or dismisses the WHOLE plan. Studio never composes memory content —
 * the user only approves what the daemon curated (memory rule 8).
 *
 * Plan ids are process-local: a daemon restart (or the retention window
 * expiring) answers `dream_not_found` (404) — regenerate, never retry. Gated
 * by `capabilities.manual_dream.{project_memory,user_model}.{generate,decide}`
 * on GET /v1/compatibility.
 */

import { apiError, HARNESS_API, HarnessApiError } from "./client";
import {
  asArray,
  asBool,
  asNumber,
  asRecord,
  asString,
  timestampUnix,
} from "./wire";

export type DreamTarget = "project_memory" | "user_model";
export type DreamDecision = "apply" | "dismiss";

interface DreamParticipant {
  key: string;
  value: string;
  description: string;
}

interface DreamOperation {
  kind: string;
  survivor: DreamParticipant;
  sources: DreamParticipant[];
  replacement: { value: string; description: string };
  reason: string;
  exactDuplicateEligible: boolean;
}

export interface DreamPlan {
  id: string;
  target: string;
  expiresAtUnix: number;
  plannedOperationCount: number;
  plannedSourceCount: number;
  operations: DreamOperation[];
}

export interface DreamReceipt {
  id: string;
  target: string;
  disposition: string;
  planned: number;
  applied: number;
  conflicted: number;
  skipped: number;
  failed: number;
}

function decodeParticipant(raw: unknown): DreamParticipant {
  const record = asRecord(raw);
  return {
    key: asString(record.key),
    value: asString(record.value),
    description: asString(record.description),
  };
}

export function decodeDreamPlan(raw: unknown): DreamPlan {
  const record = asRecord(raw);
  return {
    id: asString(record.id),
    target: asString(record.target),
    expiresAtUnix: timestampUnix(record.expires_at),
    plannedOperationCount: asNumber(record.planned_operation_count),
    plannedSourceCount: asNumber(record.planned_source_count),
    operations: asArray(record.operations).map((operation) => {
      const entry = asRecord(operation);
      const replacement = asRecord(entry.replacement);
      return {
        kind: asString(entry.kind),
        survivor: decodeParticipant(entry.survivor),
        sources: asArray(entry.sources).map(decodeParticipant),
        replacement: {
          value: asString(replacement.value),
          description: asString(replacement.description),
        },
        reason: asString(entry.reason),
        exactDuplicateEligible: asBool(entry.exact_duplicate_eligible),
      };
    }),
  };
}

function decodeDreamReceipt(raw: unknown): DreamReceipt {
  const record = asRecord(raw);
  return {
    id: asString(record.id),
    target: asString(record.target),
    disposition: asString(record.disposition),
    planned: asNumber(record.planned_source_count),
    applied: asNumber(record.applied_source_count),
    conflicted: asNumber(record.conflicted_source_count),
    skipped: asNumber(record.skipped_source_count),
    failed: asNumber(record.failed_source_count),
  };
}

/** Generates a consolidation plan. Synchronous and potentially slow. */
export async function generateDreamPlan(
  target: DreamTarget,
  signal?: AbortSignal,
): Promise<DreamPlan> {
  const response = await fetch(`${HARNESS_API}/dream/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target }),
    signal,
  });
  if (!response.ok) throw await apiError(response);
  return decodeDreamPlan(asRecord(await response.json()).plan);
}

/** Applies or dismisses the whole retained plan. */
export async function decideDreamPlan(
  planId: string,
  decision: DreamDecision,
): Promise<DreamReceipt> {
  const response = await fetch(
    `${HARNESS_API}/dream/plans/${encodeURIComponent(planId)}/decision`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    },
  );
  if (!response.ok) throw await apiError(response);
  return decodeDreamReceipt(asRecord(await response.json()).receipt);
}

/**
 * True when the plan id no longer resolves — unknown, expired, or minted by a
 * daemon process that has since restarted. The fix is regenerate, not retry.
 */
export function isStaleDreamPlan(error: unknown): boolean {
  return (
    error instanceof HarnessApiError &&
    (error.code === "dream_not_found" ||
      error.code === "dream_terminal_conflict" ||
      (error.code === "" && (error.status === 404 || error.status === 410)))
  );
}

/** The per-target capability object off `capabilities.manual_dream`. */
export interface DreamTargetCapability {
  generate: boolean;
  decide: boolean;
  unavailableReason: string;
}

/**
 * Reads one target's capability out of the compatibility document's
 * `manual_dream` object (absent daemon/target → all-false).
 */
export function dreamTargetCapability(
  manualDream: unknown,
  target: DreamTarget,
): DreamTargetCapability {
  const entry = asRecord(asRecord(manualDream)[target]);
  return {
    generate: asBool(entry.generate),
    decide: asBool(entry.decide),
    unavailableReason: asString(entry.unavailable_reason),
  };
}
