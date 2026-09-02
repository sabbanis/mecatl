import { afterEach, describe, expect, it } from "vitest";
import { HarnessApiError } from "./client";
import {
  decideLearningProposal,
  decodeLearningProposal,
  isProposalConflict,
  listLearningProposals,
  reflectHarnessSession,
} from "./learning";

/**
 * Pins the learning-review wire contract (ADR 0109): stdlib-JSON proto shapes
 * (snake_case keys, `{seconds}` timestamps, absent = zero value), the
 * expected_version concurrency token on decisions, and the 409
 * proposal_conflict classification.
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

describe("decodeLearningProposal", () => {
  it("decodes the daemon's snake_case digest, tolerating absent fields", () => {
    const proposal = decodeLearningProposal({
      id: "p1",
      version: "v3",
      status: "staged",
      kind: "fact",
      key: "deploy/steps",
      title: "Deploy steps",
      description: "How this repo deploys",
      evidence: [{ session_id: "s1" }, { session_id: "s2" }],
      triggers: ["deploy", 7],
      decisions: [
        { kind: "approve", actor: "operator", at: { seconds: 1788000000 } },
      ],
      created_at: { seconds: 1787000000, nanos: 5 },
      promotion_available: true,
      learned_skill_id: "sk1",
    });
    expect(proposal).toMatchObject({
      id: "p1",
      version: "v3",
      status: "staged",
      key: "deploy/steps",
      evidenceCount: 2,
      triggers: ["deploy"],
      createdAtUnix: 1787000000,
      updatedAtUnix: 0,
      promotionAvailable: true,
      promotionUnavailableReason: "",
      learnedSkillId: "sk1",
    });
    expect(proposal.decisions).toEqual([
      { kind: "approve", actor: "operator", reason: "", atUnix: 1788000000 },
    ]);
  });

  it("degrades a completely foreign shape to zero values, never throws", () => {
    expect(decodeLearningProposal(null).id).toBe("");
    expect(decodeLearningProposal("nope").triggers).toEqual([]);
    expect(decodeLearningProposal({ decisions: "x" }).decisions).toEqual([]);
  });
});

describe("listLearningProposals", () => {
  it("builds the status/cursor/limit query and decodes the page", async () => {
    const capture: { url?: string } = {};
    respond(200, { proposals: [{ id: "p1" }], next_cursor: "c2" }, capture);
    const page = await listLearningProposals({
      status: "staged",
      cursor: "c1",
      limit: 25,
    });
    expect(capture.url).toContain("/learning/proposals?");
    expect(capture.url).toContain("status=staged");
    expect(capture.url).toContain("cursor=c1");
    expect(capture.url).toContain("limit=25");
    expect(page.proposals.map((p) => p.id)).toEqual(["p1"]);
    expect(page.nextCursor).toBe("c2");
  });

  it("treats the daemon's empty `{}` answer as an empty queue", async () => {
    respond(200, {});
    const page = await listLearningProposals();
    expect(page).toEqual({ proposals: [], nextCursor: "" });
  });

  it("throws the typed error on a problem response", async () => {
    respond(501, {
      code: "learning_unavailable",
      error: "learning proposals are not configured",
    });
    await expect(listLearningProposals()).rejects.toMatchObject({
      name: "HarnessApiError",
      code: "learning_unavailable",
      status: 501,
    });
  });
});

describe("decideLearningProposal", () => {
  it("posts the decision with expected_version", async () => {
    const capture: { url?: string; init?: RequestInit } = {};
    respond(200, { proposal: { id: "p1", status: "promoted" } }, capture);
    const updated = await decideLearningProposal("p1", "approve", "v3");
    expect(capture.url).toContain("/learning/proposals/p1/decision");
    expect(JSON.parse(String(capture.init?.body))).toEqual({
      decision: "approve",
      expected_version: "v3",
    });
    expect(updated.status).toBe("promoted");
  });

  it("surfaces a stale-version 409 as a proposal conflict", async () => {
    respond(409, {
      code: "proposal_conflict",
      error: "proposal changed",
    });
    const error = await decideLearningProposal("p1", "reject", "v1").catch(
      (caught) => caught,
    );
    expect(error).toBeInstanceOf(HarnessApiError);
    expect(isProposalConflict(error)).toBe(true);
    // A different code is NOT a conflict — flow control keys on the code.
    expect(
      isProposalConflict(new HarnessApiError(409, "dream_in_progress", "x")),
    ).toBe(false);
    // A code-less legacy daemon still classifies on the bare 409.
    expect(isProposalConflict(new HarnessApiError(409, "", "x"))).toBe(true);
  });
});

describe("reflectHarnessSession", () => {
  it("decodes the receipt counts", async () => {
    const capture: { url?: string } = {};
    respond(
      200,
      {
        receipt: {
          reflection_id: "r1",
          disposition: "completed",
          staged: 2,
          promoted: 1,
          conflicted: 0,
          abstained: false,
        },
      },
      capture,
    );
    const receipt = await reflectHarnessSession("sess-1");
    expect(capture.url).toContain("/sessions/sess-1/reflect");
    expect(receipt).toEqual({
      reflectionId: "r1",
      disposition: "completed",
      queued: 0,
      abstained: false,
      staged: 2,
      promoted: 1,
      conflicted: 0,
    });
  });

  it("propagates a reflection failure as the typed error", async () => {
    respond(500, { code: "internal", error: "explicit reflection failed" });
    await expect(reflectHarnessSession("sess-1")).rejects.toMatchObject({
      name: "HarnessApiError",
      code: "internal",
      status: 500,
    });
  });
});
