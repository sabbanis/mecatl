import { afterEach, describe, expect, it } from "vitest";
import {
  decodeStorageHealth,
  fetchStorageHealth,
  isStorageDegraded,
} from "./storage";

/**
 * Pins the storage-health wire contract (ADR 0226): the stdlib-JSON subset the
 * degraded-store banner reads, and the degraded classification.
 */

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("decodeStorageHealth", () => {
  it("decodes the banner subset and defaults absent fields", () => {
    const health = decodeStorageHealth({
      available: true,
      session_count: 12,
      corrupt_count: 2,
      v1_count: 3,
      last_failure: "sweep: disk full",
    });
    expect(health).toEqual({
      available: true,
      unavailableReason: "",
      sessionCount: 12,
      corruptCount: 2,
      v1Count: 3,
      lastFailure: "sweep: disk full",
      activeJob: "",
    });
  });

  it("never throws on a foreign shape", () => {
    expect(decodeStorageHealth(null).available).toBe(false);
    expect(decodeStorageHealth("x").corruptCount).toBe(0);
  });
});

describe("isStorageDegraded", () => {
  const healthy = decodeStorageHealth({ available: true, session_count: 4 });
  it("healthy store → not degraded", () => {
    expect(isStorageDegraded(healthy)).toBe(false);
  });
  it("unavailable, corrupt families, or a recorded failure → degraded", () => {
    expect(isStorageDegraded({ ...healthy, available: false })).toBe(true);
    expect(isStorageDegraded({ ...healthy, corruptCount: 1 })).toBe(true);
    expect(isStorageDegraded({ ...healthy, lastFailure: "boom" })).toBe(true);
  });
  it("plain unmigrated v1 sessions still list, so they are not degraded", () => {
    expect(isStorageDegraded({ ...healthy, v1Count: 9 })).toBe(false);
  });
});

describe("fetchStorageHealth", () => {
  it("throws the typed error when the daemon refuses (management auth)", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          code: "management_unauthorized",
          error: "management authorization required",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/problem+json" },
        },
      );
    await expect(fetchStorageHealth()).rejects.toMatchObject({
      name: "HarnessApiError",
      code: "management_unauthorized",
      status: 403,
    });
  });

  it("decodes a healthy answer", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ available: true, session_count: 2 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    const health = await fetchStorageHealth();
    expect(health.available).toBe(true);
    expect(isStorageDegraded(health)).toBe(false);
  });
});
