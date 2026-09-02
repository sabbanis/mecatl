/**
 * Learned-skill lifecycle (ADR 0110) — the human half of the daemon's
 * self-improvement loop.
 *
 * Wire: `GET /v1/skills/learned` (+ `/changes`, `/{id}`, `/{id}/diff`) and
 * `POST /v1/skills/learned/{id}/{activate|reject|archive|rollback}`. Gated by
 * `capabilities.learned_skills` on GET /v1/compatibility.
 *
 * Responses are stdlib JSON over the proto structs (snake_case keys, absent =
 * zero value). Every mutation carries the version being acted on plus
 * `expected_revision` — the optimistic-concurrency token off the listed row.
 * The `project` query is deliberately never sent: Studio reads the
 * operator-scope partition (the browser never knows the workspace path).
 */

import { apiError, HARNESS_API } from "./client";
import {
  asArray,
  asBool,
  asNumber,
  asRecord,
  asString,
  timestampUnix,
} from "./wire";

/**
 * One immutable agent-owned skill version. `state` is the daemon's closed
 * vocabulary: draft, evaluated, staged, active, archived, rejected.
 */
export interface LearnedSkillVersion {
  id: string;
  name: string;
  version: string;
  /** Optimistic-concurrency token — every mutation must carry it. */
  revision: string;
  state: string;
  ownerAgent: string;
  description: string;
  /** Bounded, server-repaired body preview. */
  body: string;
  /** The prior version this one replaced ("" for a first version). */
  supersedes: string;
  evidenceCount: number;
  createdAtUnix: number;
  updatedAtUnix: number;
  inspectAvailable: boolean;
  undoAvailable: boolean;
}

export function decodeLearnedSkillVersion(raw: unknown): LearnedSkillVersion {
  const record = asRecord(raw);
  return {
    id: asString(record.id),
    name: asString(record.name),
    version: asString(record.version),
    revision: asString(record.revision),
    state: asString(record.state),
    ownerAgent: asString(record.owner_agent),
    description: asString(record.description),
    body: asString(record.body),
    supersedes: asString(record.supersedes),
    evidenceCount: asNumber(record.evidence_count),
    createdAtUnix: timestampUnix(record.created_at),
    updatedAtUnix: timestampUnix(record.updated_at),
    inspectAvailable: asBool(record.inspect_available),
    undoAvailable: asBool(record.undo_available),
  };
}

/** One append-only lifecycle receipt from `GET /v1/skills/learned/changes`. */
export interface LearnedSkillChange {
  id: string;
  skillId: string;
  name: string;
  version: string;
  operation: string;
  fromState: string;
  toState: string;
  evidenceCount: number;
  verdict: string;
  atUnix: number;
}

export function decodeLearnedSkillChange(raw: unknown): LearnedSkillChange {
  const record = asRecord(raw);
  return {
    id: asString(record.id),
    skillId: asString(record.skill_id),
    name: asString(record.name),
    version: asString(record.version),
    operation: asString(record.operation),
    fromState: asString(record.from_state),
    toState: asString(record.to_state),
    evidenceCount: asNumber(record.evidence_count),
    verdict: asString(record.verdict),
    atUnix: timestampUnix(record.at),
  };
}

export interface LearnedSkillPage {
  skills: LearnedSkillVersion[];
  nextCursor: string;
}

export async function listLearnedSkills(
  options: { state?: string; cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<LearnedSkillPage> {
  const query = new URLSearchParams();
  if (options.state) query.set("state", options.state);
  if (options.cursor) query.set("cursor", options.cursor);
  if (options.limit) query.set("limit", String(options.limit));
  const suffix = query.size > 0 ? `?${query}` : "";
  const response = await fetch(`${HARNESS_API}/skills/learned${suffix}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw await apiError(response);
  const body = asRecord(await response.json());
  return {
    skills: asArray(body.skills).map(decodeLearnedSkillVersion),
    nextCursor: asString(body.next_cursor),
  };
}

export async function listLearnedSkillChanges(
  options: { cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<{ changes: LearnedSkillChange[]; nextCursor: string }> {
  const query = new URLSearchParams();
  if (options.cursor) query.set("cursor", options.cursor);
  if (options.limit) query.set("limit", String(options.limit));
  const suffix = query.size > 0 ? `?${query}` : "";
  const response = await fetch(
    `${HARNESS_API}/skills/learned/changes${suffix}`,
    { signal, cache: "no-store" },
  );
  if (!response.ok) throw await apiError(response);
  const body = asRecord(await response.json());
  return {
    changes: asArray(body.changes).map(decodeLearnedSkillChange),
    nextCursor: asString(body.next_cursor),
  };
}

/** Reads one version in full (the list body is a bounded preview). */
export async function fetchLearnedSkill(
  id: string,
  ownerAgent: string,
  version?: string,
  signal?: AbortSignal,
): Promise<LearnedSkillVersion> {
  const query = new URLSearchParams({ owner_agent: ownerAgent });
  if (version) query.set("version", version);
  const response = await fetch(
    `${HARNESS_API}/skills/learned/${encodeURIComponent(id)}?${query}`,
    { signal, cache: "no-store" },
  );
  if (!response.ok) throw await apiError(response);
  return decodeLearnedSkillVersion(asRecord(await response.json()).skill);
}

/** Unified diff between two versions of one learned skill. */
export async function diffLearnedSkillVersions(
  id: string,
  ownerAgent: string,
  fromVersion: string,
  toVersion: string,
  signal?: AbortSignal,
): Promise<string> {
  const query = new URLSearchParams({
    owner_agent: ownerAgent,
    from: fromVersion,
    to: toVersion,
  });
  const response = await fetch(
    `${HARNESS_API}/skills/learned/${encodeURIComponent(id)}/diff?${query}`,
    { signal, cache: "no-store" },
  );
  if (!response.ok) throw await apiError(response);
  return asString(asRecord(await response.json()).diff);
}

export type LearnedSkillAction = "activate" | "reject" | "archive";

export interface LearnedSkillMutationResult {
  skill: LearnedSkillVersion;
  /** How republishing to the live skill snapshot went, when it applies. */
  publicationStatus: string;
  publicationError: string;
}

async function learnedSkillMutation(
  id: string,
  action: string,
  body: Record<string, string>,
): Promise<LearnedSkillMutationResult> {
  const response = await fetch(
    `${HARNESS_API}/skills/learned/${encodeURIComponent(id)}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw await apiError(response);
  const decoded = asRecord(await response.json());
  return {
    skill: decodeLearnedSkillVersion(decoded.skill),
    publicationStatus: asString(decoded.publication_status),
    publicationError: asString(decoded.publication_error),
  };
}

/** Activate / reject / archive one version, guarded by its revision. */
export async function mutateLearnedSkill(
  action: LearnedSkillAction,
  target: {
    id: string;
    ownerAgent: string;
    version: string;
    expectedRevision: string;
  },
): Promise<LearnedSkillMutationResult> {
  return learnedSkillMutation(target.id, action, {
    owner_agent: target.ownerAgent,
    version: target.version,
    expected_revision: target.expectedRevision,
  });
}

/** Rolls the skill back to a prior version (usually `supersedes`). */
export async function rollbackLearnedSkill(target: {
  id: string;
  ownerAgent: string;
  targetVersion: string;
  expectedRevision: string;
}): Promise<LearnedSkillMutationResult> {
  return learnedSkillMutation(target.id, "rollback", {
    owner_agent: target.ownerAgent,
    target_version: target.targetVersion,
    expected_revision: target.expectedRevision,
  });
}
