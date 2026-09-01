import { afterEach, describe, expect, it } from "vitest";
import { HarnessApiError } from "./client";
import {
  decideDreamPlan,
  decodeDreamPlan,
  dreamTargetCapability,
  generateDreamPlan,
  isStaleDreamPlan,
} from "./dream";

/**
 * Pins the manual-dream wire contract (ADR 0227): the stdlib-JSON plan and
 * receipt shapes, the process-local plan-id staleness classification
 * (regenerate, never retry), and the capability-object reader.
 */

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function respond(
  status: number,
  body: unknown,
  capture?: { url?: string; init?: RequestInit },
) {
  globalThis.fetch = async (input, init) => {
    if (capture) {
      capture.url = String(input);
      capture.init = init;
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

describe("decodeDreamPlan", () => {
  it("decodes operations with survivor/sources/replacement", () => {
    const plan = decodeDreamPlan({
      id: "plan1",
      target: "user_model",
      expires_at: { seconds: 1788287318, nanos: 927881000 },
      planned_operation_count: 1,
      planned_source_count: 2,
      operations: [
        {
          kind: "merge",
          survivor: { key: "k1", value: "v1", description: "d1" },
          sources: [{ key: "k2", value: "v2" }],
          replacement: { value: "merged", description: "both" },
          reason: "near-duplicates",
          exact_duplicate_eligible: true,
        },
      ],
    });
    expect(plan.id).toBe("plan1");
    expect(plan.expiresAtUnix).toBe(1788287318);
    expect(plan.plannedOperationCount).toBe(1);
    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0]).toMatchObject({
      kind: "merge",
      survivor: { key: "k1", value: "v1", description: "d1" },
      replacement: { value: "merged", description: "both" },
      exactDuplicateEligible: true,
    });
    expect(plan.operations[0].sources).toEqual([
      { key: "k2", value: "v2", description: "" },
    ]);
  });

  it("decodes the daemon's empty plan (nothing to consolidate)", () => {
    const plan = decodeDreamPlan({ id: "p", target: "project_memory" });
    expect(plan.operations).toEqual([]);
    expect(plan.plannedOperationCount).toBe(0);
  });
});

describe("generate / decide", () => {
  it("posts the target and unwraps the plan", async () => {
    const capture: { url?: string; init?: RequestInit } = {};
    respond(200, { plan: { id: "p1", target: "project_memory" } }, capture);
    const plan = await generateDreamPlan("project_memory");
    expect(capture.url).toContain("/dream/plans");
    expect(JSON.parse(String(capture.init?.body))).toEqual({
      target: "project_memory",
    });
    expect(plan.id).toBe("p1");
  });

  it("posts the decision and decodes the receipt counts", async () => {
    const capture: { url?: string; init?: RequestInit } = {};
    respond(
      200,
      {
        receipt: {
          id: "p1",
          target: "project_memory",
          disposition: "apply",
          planned_source_count: 3,
          applied_source_count: 2,
          conflicted_source_count: 1,
        },
      },
      capture,
    );
    const receipt = await decideDreamPlan("p1", "apply");
    expect(capture.url).toContain("/dream/plans/p1/decision");
    expect(JSON.parse(String(capture.init?.body))).toEqual({
      decision: "apply",
    });
    expect(receipt).toMatchObject({
      disposition: "apply",
      planned: 3,
      applied: 2,
      conflicted: 1,
      skipped: 0,
      failed: 0,
    });
  });

  it("classifies a dead plan id as stale (regenerate, never retry)", async () => {
    respond(404, {
      code: "dream_not_found",
      error: "dream plan not found; generate a new plan",
    });
    const error = await decideDreamPlan("stale", "apply").catch((e) => e);
    expect(error).toBeInstanceOf(HarnessApiError);
    expect(isStaleDreamPlan(error)).toBe(true);
    expect(
      isStaleDreamPlan(new HarnessApiError(410, "dream_terminal_conflict", "")),
    ).toBe(true);
    // In-progress/conflict are NOT stale: the plan still exists.
    expect(
      isStaleDreamPlan(new HarnessApiError(409, "dream_in_progress", "")),
    ).toBe(false);
    expect(isStaleDreamPlan(new Error("network"))).toBe(false);
  });
});

describe("dreamTargetCapability", () => {
  it("reads the per-target object and defaults absent to all-false", () => {
    const manualDream = {
      project_memory: { generate: true, decide: true },
      user_model: { generate: false, decide: false, unavailable_reason: "off" },
    };
    expect(dreamTargetCapability(manualDream, "project_memory")).toEqual({
      generate: true,
      decide: true,
      unavailableReason: "",
    });
    expect(dreamTargetCapability(manualDream, "user_model")).toEqual({
      generate: false,
      decide: false,
      unavailableReason: "off",
    });
    expect(dreamTargetCapability(undefined, "user_model").generate).toBe(false);
    expect(dreamTargetCapability(true, "project_memory").decide).toBe(false);
  });
});
