import { afterEach, describe, expect, it, vi } from "vitest";
import { resetHarnessClient } from "./sdk";
import { jsonResponse, stubHarnessFetch } from "./sdk-test-stub";
import {
  decodeStorageHealth,
  fetchStorageHealth,
  isStorageDegraded,
  type StorageHealthWire,
} from "./storage";

/**
 * Pins the storage-health contract (ADR 0226) over the SDK: the route, the
 * projection off the daemon's proto-JSON body (banner subset + the effective
 * retention policy, sweep timestamps, family counts and sizes), and the
 * degraded classification.
 */

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetHarnessClient();
});

const healthy: StorageHealthWire = {
  available: true,
  unavailableReason: "",
  sessionCount: BigInt(4),
  corruptCount: BigInt(0),
  v1Count: BigInt(0),
  v2Count: BigInt(4),
  mainCount: BigInt(2),
  childCount: BigInt(1),
  scheduledCount: BigInt(1),
  unknownCount: BigInt(0),
  fileCount: BigInt(9),
  currentBytes: BigInt(20_480),
  currentBytesAvailable: true,
  reclaimableBytes: BigInt(0),
  reclaimableBytesAvailable: false,
  policy: {
    $typeName: "mecatl.v1.RetentionPolicy",
    mainMaxAgeSeconds: BigInt(0),
    mainMaxCount: 0,
    childMaxAgeSeconds: BigInt(604_800),
    childMaxCount: 500,
    scheduledMaxAgeSeconds: BigInt(604_800),
    scheduledMaxCount: 0,
    sweepCadenceSeconds: BigInt(3600),
  },
  lastSweepUnix: BigInt(1_755_003_000),
  lastSweepAvailable: true,
  nextSweepUnix: BigInt(0),
  nextSweepAvailable: false,
  lastFailure: "",
  activeJob: "",
};

describe("decodeStorageHealth", () => {
  it("projects the banner subset, converting int64 counts to numbers", () => {
    expect(
      decodeStorageHealth({
        ...healthy,
        sessionCount: BigInt(12),
        corruptCount: BigInt(2),
        lastFailure: "sweep: disk full",
      }),
    ).toMatchObject({
      available: true,
      unavailableReason: "",
      sessionCount: 12,
      corruptCount: 2,
      lastFailure: "sweep: disk full",
      activeJob: "",
    });
  });

  it("projects the effective policy, family counts and sizes; unix seconds become epoch millis", () => {
    const health = decodeStorageHealth(healthy);
    expect(health.policy).toEqual({
      mainMaxAgeSeconds: 0,
      mainMaxCount: 0,
      childMaxAgeSeconds: 604_800,
      childMaxCount: 500,
      scheduledMaxAgeSeconds: 604_800,
      scheduledMaxCount: 0,
      sweepCadenceSeconds: 3600,
    });
    expect(health).toMatchObject({
      v1Count: 0,
      v2Count: 4,
      mainCount: 2,
      childCount: 1,
      scheduledCount: 1,
      unknownCount: 0,
      fileCount: 9,
      currentBytes: 20_480,
      lastSweepAt: 1_755_003_000_000,
    });
  });

  it("reports unavailable sizes and sweeps as null rather than 0", () => {
    const health = decodeStorageHealth(healthy);
    expect(health.reclaimableBytes).toBeNull();
    expect(health.nextSweepAt).toBeNull();
    expect(
      decodeStorageHealth({
        ...healthy,
        currentBytesAvailable: false,
        lastSweepAvailable: false,
        nextSweepUnix: BigInt(1_755_006_600),
        nextSweepAvailable: true,
      }),
    ).toMatchObject({
      currentBytes: null,
      lastSweepAt: null,
      nextSweepAt: 1_755_006_600_000,
    });
  });

  it("reports a daemon that sends no policy as null, never a zeroed table", () => {
    expect(decodeStorageHealth({ ...healthy, policy: undefined }).policy).toBe(
      null,
    );
  });
});

describe("isStorageDegraded", () => {
  const health = decodeStorageHealth(healthy);
  it("healthy store → not degraded", () => {
    expect(isStorageDegraded(health)).toBe(false);
  });
  it("unavailable, corrupt families, or a recorded failure → degraded", () => {
    expect(isStorageDegraded({ ...health, available: false })).toBe(true);
    expect(isStorageDegraded({ ...health, corruptCount: 1 })).toBe(true);
    expect(isStorageDegraded({ ...health, lastFailure: "boom" })).toBe(true);
  });
  it("plain unmigrated v1 sessions still list, so they are not degraded", () => {
    expect(isStorageDegraded({ ...health, v1Count: 9 })).toBe(false);
    expect(
      isStorageDegraded(
        decodeStorageHealth({ ...healthy, v1Count: BigInt(9) }),
      ),
    ).toBe(false);
  });
});

describe("fetchStorageHealth", () => {
  it("GETs /v1/storage/health and decodes the daemon's snake_case answer", async () => {
    const stub = stubHarnessFetch(() => ({
      available: true,
      session_count: 2,
      corrupt_count: 1,
      main_count: 2,
      last_failure: "",
      active_job: "migrate",
      policy: { child_max_age_seconds: 86400, sweep_cadence_seconds: 600 },
      last_sweep_unix: 1_755_003_000,
      last_sweep_available: true,
    }));
    const health = await fetchStorageHealth();
    expect(stub.last()).toMatchObject({
      method: "GET",
      url: "/api/mecatl/v1/storage/health",
    });
    expect(health).toMatchObject({
      available: true,
      sessionCount: 2,
      corruptCount: 1,
      mainCount: 2,
      activeJob: "migrate",
      policy: { childMaxAgeSeconds: 86400, sweepCadenceSeconds: 600 },
      lastSweepAt: 1_755_003_000_000,
      nextSweepAt: null,
      currentBytes: null,
    });
    expect(isStorageDegraded(health)).toBe(true);
  });

  it("throws the typed error when the daemon refuses (management auth)", async () => {
    stubHarnessFetch(() =>
      jsonResponse(403, {
        code: "management_unauthorized",
        error: "management authorization required",
      }),
    );
    await expect(fetchStorageHealth()).rejects.toMatchObject({
      name: "HarnessApiError",
      code: "management_unauthorized",
      status: 403,
    });
  });
});
