/**
 * Storage health (ADR 0226): `GET /v1/storage/health`, gated by
 * `capabilities.storage_health` on GET /v1/compatibility.
 *
 * Studio reads this for ONE purpose — the degraded-store banner that explains
 * why sessions may be missing from the sidebar. Migration/cleanup job control
 * stays CLI/TUI. The response is stdlib JSON over the proto struct
 * (snake_case keys, absent = zero value); only the banner-relevant subset is
 * decoded here.
 */

import { apiError, HARNESS_API } from "./client";
import { asBool, asNumber, asRecord, asString } from "./wire";

export interface StorageHealth {
  /** False when the session store itself cannot be read. */
  available: boolean;
  unavailableReason: string;
  sessionCount: number;
  /** Session families the store holds but cannot load — "missing" sessions. */
  corruptCount: number;
  /** Legacy-layout families awaiting migration (CLI/TUI job). */
  v1Count: number;
  /** The last background sweep/migration failure, "" when none. */
  lastFailure: string;
  activeJob: string;
}

export function decodeStorageHealth(raw: unknown): StorageHealth {
  const record = asRecord(raw);
  return {
    available: asBool(record.available),
    unavailableReason: asString(record.unavailable_reason),
    sessionCount: asNumber(record.session_count),
    corruptCount: asNumber(record.corrupt_count),
    v1Count: asNumber(record.v1_count),
    lastFailure: asString(record.last_failure),
    activeJob: asString(record.active_job),
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
  const response = await fetch(`${HARNESS_API}/storage/health`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw await apiError(response);
  return decodeStorageHealth(await response.json());
}
