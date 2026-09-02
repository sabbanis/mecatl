import { afterEach, describe, expect, it } from "vitest";
import {
  decodeLearnedSkillChange,
  decodeLearnedSkillVersion,
  diffLearnedSkillVersions,
  listLearnedSkillChanges,
  listLearnedSkills,
  mutateLearnedSkill,
  rollbackLearnedSkill,
} from "./learned-skills";

/**
 * Pins the learned-skill wire contract (ADR 0110): the stdlib-JSON proto
 * shapes, the owner_agent/version/expected_revision mutation body, and the
 * rollback target_version body.
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

describe("decodeLearnedSkillVersion", () => {
  it("decodes the snake_case projection", () => {
    const skill = decodeLearnedSkillVersion({
      id: "sk1",
      name: "triage-flakes",
      version: "v2",
      revision: "r7",
      state: "staged",
      owner_agent: "explorer",
      description: "Triage flaky tests",
      body: "# Steps",
      supersedes: "v1",
      evidence_count: 3,
      updated_at: { seconds: 1788000001 },
      inspect_available: true,
    });
    expect(skill).toMatchObject({
      id: "sk1",
      name: "triage-flakes",
      version: "v2",
      revision: "r7",
      state: "staged",
      ownerAgent: "explorer",
      supersedes: "v1",
      evidenceCount: 3,
      updatedAtUnix: 1788000001,
      createdAtUnix: 0,
      inspectAvailable: true,
      undoAvailable: false,
    });
  });

  it("never throws on a foreign shape", () => {
    expect(decodeLearnedSkillVersion(undefined).state).toBe("");
    expect(decodeLearnedSkillChange(42).operation).toBe("");
  });
});

describe("list endpoints", () => {
  it("treats the daemon's generation-only answer as empty inventories", async () => {
    respond(200, { generation: 1 });
    expect(await listLearnedSkills()).toEqual({ skills: [], nextCursor: "" });
    respond(200, { generation: 1 });
    expect(await listLearnedSkillChanges()).toEqual({
      changes: [],
      nextCursor: "",
    });
  });

  it("passes the state filter and cursor through", async () => {
    const capture: { url?: string } = {};
    respond(200, { skills: [{ id: "sk1" }], next_cursor: "n" }, capture);
    const page = await listLearnedSkills({ state: "staged", cursor: "c" });
    expect(capture.url).toContain("/skills/learned?");
    expect(capture.url).toContain("state=staged");
    expect(capture.url).toContain("cursor=c");
    expect(page.skills).toHaveLength(1);
    expect(page.nextCursor).toBe("n");
  });

  it("throws the typed error on a problem response", async () => {
    respond(400, { code: "invalid_argument", error: "invalid limit" });
    await expect(listLearnedSkills({ limit: -1 })).rejects.toMatchObject({
      name: "HarnessApiError",
      code: "invalid_argument",
    });
  });
});

describe("diffLearnedSkillVersions", () => {
  it("queries owner_agent/from/to and returns the diff text", async () => {
    const capture: { url?: string } = {};
    respond(
      200,
      { diff: "-a\n+b", from_version: "v1", to_version: "v2" },
      capture,
    );
    const diff = await diffLearnedSkillVersions("sk1", "explorer", "v1", "v2");
    expect(capture.url).toContain("/skills/learned/sk1/diff?");
    expect(capture.url).toContain("owner_agent=explorer");
    expect(capture.url).toContain("from=v1");
    expect(capture.url).toContain("to=v2");
    expect(diff).toBe("-a\n+b");
  });
});

describe("mutations", () => {
  it("posts owner_agent + version + expected_revision to the action route", async () => {
    const capture: { url?: string; init?: RequestInit } = {};
    respond(
      200,
      {
        skill: { id: "sk1", state: "active" },
        publication_status: "published",
      },
      capture,
    );
    const result = await mutateLearnedSkill("activate", {
      id: "sk1",
      ownerAgent: "explorer",
      version: "v2",
      expectedRevision: "r7",
    });
    expect(capture.url).toContain("/skills/learned/sk1/activate");
    expect(JSON.parse(String(capture.init?.body))).toEqual({
      owner_agent: "explorer",
      version: "v2",
      expected_revision: "r7",
    });
    expect(result.skill.state).toBe("active");
    expect(result.publicationStatus).toBe("published");
  });

  it("rollback posts target_version instead of version", async () => {
    const capture: { url?: string; init?: RequestInit } = {};
    respond(
      200,
      { skill: { id: "sk1", state: "active", version: "v1" } },
      capture,
    );
    await rollbackLearnedSkill({
      id: "sk1",
      ownerAgent: "explorer",
      targetVersion: "v1",
      expectedRevision: "r7",
    });
    expect(capture.url).toContain("/skills/learned/sk1/rollback");
    expect(JSON.parse(String(capture.init?.body))).toEqual({
      owner_agent: "explorer",
      target_version: "v1",
      expected_revision: "r7",
    });
  });

  it("surfaces a not-found mutation as the typed error", async () => {
    respond(404, { code: "session_not_found", error: "learned skill" });
    await expect(
      mutateLearnedSkill("reject", {
        id: "gone",
        ownerAgent: "explorer",
        version: "v1",
        expectedRevision: "r1",
      }),
    ).rejects.toMatchObject({ name: "HarnessApiError", status: 404 });
  });
});
