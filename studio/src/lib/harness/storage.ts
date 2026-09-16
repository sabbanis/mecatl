/**
 * Storage health (ADR 0226): `GET /v1/storage/health` over the SDK
 * (`client.storage.getHealth`), gated by `capabilities.storage_health` on
 * GET /v1/compatibility.
 *
 * Studio reads this for two surfaces: the degraded-store banner that
 * explains why sessions may be missing from the sidebar, and the Storage
 * page's effective retention policy — the limits and sweep schedule AS THE
 * DAEMON APPLIES THEM (whatever flags or settings file produced them),
 * with the per-family counts they act on.
 */

import type { GetStorageHealthResponse } from "@stacklok-oss/mecatl-sdk/gen";

import { getHarnessClient, harness } from "./sdk";

/**
 * The effective retention policy, in seconds and counts; 0 means that pass
 * is off (mecated's own "0 disables" convention, preserved rather than
 * translated so the form's "0" and the table's "Off" agree).
 */
export interface StorageRetentionPolicy {
  mainMaxAgeSeconds: number;
  mainMaxCount: number;
  childMaxAgeSeconds: number;
  childMaxCount: number;
  scheduledMaxAgeSeconds: number;
  scheduledMaxCount: number;
  /** How often the GC re-sweeps after the startup sweep; 0 = startup only. */
  sweepCadenceSeconds: number;
}

export interface StorageHealth {
  /** False when the session store itself cannot be read. */
  available: boolean;
  unavailableReason: string;
  sessionCount: number;
  /** Session families the store holds but cannot load — "missing" sessions. */
  corruptCount: number;
  /**
   * Legacy-layout families awaiting migration. Plain unmigrated v1
   * sessions still list, so this never contributes to `isStorageDegraded`.
   */
  v1Count: number;
  v2Count: number;
  /** Per-family counts the retention passes act on. */
  mainCount: number;
  childCount: number;
  scheduledCount: number;
  /** Families of no known kind — protected from every retention pass. */
  unknownCount: number;
  fileCount: number;
  /** Bytes on disk; null when the store cannot size itself. */
  currentBytes: number | null;
  /** Bytes a cleanup could reclaim; null when unknown. */
  reclaimableBytes: number | null;
  /** The effective retention policy; null when the daemon reports none. */
  policy: StorageRetentionPolicy | null;
  /** Epoch millis of the last completed sweep; null = never. */
  lastSweepAt: number | null;
  /** Epoch millis of the next scheduled sweep; null = not scheduled. */
  nextSweepAt: number | null;
  /** The last background sweep/migration failure, "" when none. */
  lastFailure: string;
  activeJob: string;
}

/** The wire fields Studio projects — the ownerless-record preflight and
 *  anything added later stay out until a surface needs them. */
export type StorageHealthWire = Pick<
  GetStorageHealthResponse,
  | "available"
  | "unavailableReason"
  | "sessionCount"
  | "corruptCount"
  | "v1Count"
  | "v2Count"
  | "mainCount"
  | "childCount"
  | "scheduledCount"
  | "unknownCount"
  | "fileCount"
  | "currentBytes"
  | "currentBytesAvailable"
  | "reclaimableBytes"
  | "reclaimableBytesAvailable"
  | "policy"
  | "lastSweepUnix"
  | "lastSweepAvailable"
  | "nextSweepUnix"
  | "nextSweepAvailable"
  | "lastFailure"
  | "activeJob"
>;

const unixToMillis = (unix: bigint | number, available: boolean) =>
  available ? Number(unix) * 1000 : null;

/** Projects the SDK response: int64 → number, unavailable → null, unix
 *  seconds → epoch millis. */
export function decodeStorageHealth(
  response: StorageHealthWire,
): StorageHealth {
  const policy = response.policy;
  return {
    available: response.available,
    unavailableReason: response.unavailableReason,
    sessionCount: Number(response.sessionCount),
    corruptCount: Number(response.corruptCount),
    v1Count: Number(response.v1Count),
    v2Count: Number(response.v2Count),
    mainCount: Number(response.mainCount),
    childCount: Number(response.childCount),
    scheduledCount: Number(response.scheduledCount),
    unknownCount: Number(response.unknownCount),
    fileCount: Number(response.fileCount),
    currentBytes: response.currentBytesAvailable
      ? Number(response.currentBytes)
      : null,
    reclaimableBytes: response.reclaimableBytesAvailable
      ? Number(response.reclaimableBytes)
      : null,
    policy: policy
      ? {
          mainMaxAgeSeconds: Number(policy.mainMaxAgeSeconds),
          mainMaxCount: Number(policy.mainMaxCount),
          childMaxAgeSeconds: Number(policy.childMaxAgeSeconds),
          childMaxCount: Number(policy.childMaxCount),
          scheduledMaxAgeSeconds: Number(policy.scheduledMaxAgeSeconds),
          scheduledMaxCount: Number(policy.scheduledMaxCount),
          sweepCadenceSeconds: Number(policy.sweepCadenceSeconds),
        }
      : null,
    lastSweepAt: unixToMillis(
      response.lastSweepUnix,
      response.lastSweepAvailable,
    ),
    nextSweepAt: unixToMillis(
      response.nextSweepUnix,
      response.nextSweepAvailable,
    ),
    lastFailure: response.lastFailure,
    activeJob: response.activeJob,
  };
}

/**
 * True when the store's state can explain sessions missing from the sidebar:
 * the store is unreadable, some families no longer load, or a background job
 * failed. Plain unmigrated v1 sessions still list, so they are NOT degraded.
 */
export function isStorageDegraded(health: StorageHealth): boolean {
  return (
    !health.available || health.corruptCount > 0 || health.lastFailure !== ""
  );
}

export async function fetchStorageHealth(
  signal?: AbortSignal,
): Promise<StorageHealth> {
  const response = await harness(() =>
    getHarnessClient().storage.getHealth(
      { $typeName: "mecatl.v1.GetStorageHealthRequest" },
      { signal },
    ),
  );
  return decodeStorageHealth(response);
}
