import { describe, expect, it } from "vitest";
import { fetchHarnessCompatibility, HarnessApiError } from "./client";

/**
 * Pins the ADR-0248 client contract: errors are typed on the stable machine
 * `code` (problem-details body), with the legacy `error` prose as the
 * message; named codes get plainer framing; compatibility decoding tolerates
 * older daemons (404 → null).
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

describe("HarnessApiError via fetchHarnessCompatibility", () => {
  it("carries the stable code and the server's message", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      jsonResponse(409, {
        type: "urn:mecatl:error:stale_run_control",
        code: "stale_run_control",
        error: "the named run already ended",
        status: 409,
      });
    try {
      await expect(fetchHarnessCompatibility()).rejects.toMatchObject({
        name: "HarnessApiError",
        status: 409,
        code: "stale_run_control",
        message: "the named run already ended",
      });
    } finally {
      globalThis.fetch = original;
    }
  });

  it("frames the named codes in plain language", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      jsonResponse(503, { code: "draining", error: "server draining" });
    try {
      const error = await fetchHarnessCompatibility().catch((e) => e);
      expect(error).toBeInstanceOf(HarnessApiError);
      expect((error as HarnessApiError).code).toBe("draining");
      expect((error as HarnessApiError).message).toMatch(/restarting/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("degrades to status text against a non-JSON error body", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response("nope", { status: 500, statusText: "Internal Error" });
    try {
      const error = await fetchHarnessCompatibility().catch((e) => e);
      expect((error as HarnessApiError).code).toBe("");
      expect((error as HarnessApiError).message).toBe("500 Internal Error");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("decodes the compatibility document and tolerates a 404 daemon", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      jsonResponse(200, {
        api_major: 1,
        features: ["watch_session_events", 7, "server_info"],
        capabilities: { steer: true },
        deployment: "lab-1",
      });
    try {
      const doc = await fetchHarnessCompatibility();
      expect(doc).toEqual({
        apiMajor: 1,
        features: ["watch_session_events", "server_info"],
        capabilities: { steer: true },
        deployment: "lab-1",
      });
    } finally {
      globalThis.fetch = original;
    }
    globalThis.fetch = async () => new Response("", { status: 404 });
    try {
      expect(await fetchHarnessCompatibility()).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });
});
