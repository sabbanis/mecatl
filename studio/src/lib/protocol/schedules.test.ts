import { describe, expect, it } from "vitest";
import {
  decodeScheduleFires,
  decodeScheduleRows,
  encodeScheduleSpec,
  scheduleDraftFromRow,
} from "./schedules";

const stdlibRow = {
  spec: {
    name: "nightly-digest",
    prompt: "summarise the day",
    trigger: { cron: "0 9 * * *" },
    timezone: "Europe/London",
    workspace: "/repo",
    mode: 2,
    mutating: false,
    max_fires: 30,
    limits: { max_turns: 8, max_tool_calls: 40, max_consecutive_failures: 3 },
    selector: { provider_id: "openrouter", model_id: "big-1" },
    misfire: 2,
    singleton: true,
    carry_context: true,
    fire_timeout: { seconds: 900 },
    parts: [{ kind: 2, mime_type: "image/png", data: "aGk=" }],
    owner: { subject: "sub-1", name: "James" },
  },
  state: {
    enabled: true,
    fire_count: 4,
    next_fire_at: { seconds: 1700003600 },
    last_fire_at: { seconds: 1700000000, nanos: 500000000 },
    last_fire_session_id: "sched--nightly-digest-20260817-090000-abcdef",
  },
};

describe("decodeScheduleRows", () => {
  it("decodes stdlib-JSON shapes: {seconds,nanos} timestamps, numeric enums", () => {
    const [row] = decodeScheduleRows({ schedules: [stdlibRow] });
    expect(row).toMatchObject({
      name: "nightly-digest",
      cron: "0 9 * * *",
      timezone: "Europe/London",
      mode: 2,
      mutating: false,
      maxFires: 30,
      enabled: true,
      fireCount: 4,
      owner: "James",
      lastFireSessionId: "sched--nightly-digest-20260817-090000-abcdef",
      fireStage: "idle",
    });
    expect(row.nextFireAt).toBe(1700003600000);
    expect(row.lastFireAt).toBe(1700000000500);
    expect(row.limits).toEqual({
      maxTurns: 8,
      maxToolCalls: 40,
      maxConsecutiveFailures: 3,
    });
  });

  it("also accepts protojson shapes: RFC 3339 timestamps and enum names", () => {
    const [row] = decodeScheduleRows({
      schedules: [
        {
          spec: {
            name: "x",
            mode: "PERMISSION_MODE_PLAN",
            misfire: "MISFIRE_SKIP",
            trigger: { one_shot: "2026-08-20T09:00:00Z" },
            fire_timeout: "900s",
          },
          state: {},
        },
      ],
    });
    expect(row.mode).toBe(2);
    expect(row.carried.misfire).toBe(2);
    expect(row.oneShotAt).toBe(Date.parse("2026-08-20T09:00:00Z"));
    expect(row.carried.fireTimeoutSeconds).toBe(900);
  });

  it("derives the fire stage from the claim sentinel and the started timestamp", () => {
    const claimed = decodeScheduleRows({
      schedules: [
        { spec: { name: "a" }, state: { last_fire_session_id: "pending" } },
      ],
    })[0];
    expect(claimed.fireStage).toBe("claimed");
    // The pending sentinel is a claim, not a session id.
    expect(claimed.lastFireSessionId).toBe("");

    const running = decodeScheduleRows({
      schedules: [
        {
          spec: { name: "a" },
          state: { last_fire_started_at: { seconds: 1700000000 } },
        },
      ],
    })[0];
    expect(running.fireStage).toBe("running");
  });

  it("carries the fields the form cannot edit for the PUT round trip", () => {
    const [row] = decodeScheduleRows({ schedules: [stdlibRow] });
    expect(row.carried).toEqual({
      selectorProvider: "openrouter",
      selectorModel: "big-1",
      misfire: 2,
      singleton: true,
      carryContext: true,
      fireTimeoutSeconds: 900,
      parts: [{ kind: 2, mime_type: "image/png", data: "aGk=" }],
    });
  });
});

describe("encodeScheduleSpec", () => {
  it("re-encodes a decoded row as protojson: carried fields survive, well-known types convert", () => {
    const [row] = decodeScheduleRows({ schedules: [stdlibRow] });
    const spec = encodeScheduleSpec(scheduleDraftFromRow(row), row.carried);
    // Requests are protojson: Duration is a "900s" string, never {seconds:900}.
    expect(spec.fire_timeout).toBe("900s");
    expect(spec.selector).toEqual({
      provider_id: "openrouter",
      model_id: "big-1",
    });
    expect(spec.singleton).toBe(true);
    expect(spec.misfire).toBe(2);
    expect(spec.carry_context).toBe(true);
    expect(spec.parts).toEqual(stdlibRow.spec.parts);
    // Server-owned fields are never sent.
    expect(spec).not.toHaveProperty("owner");
    expect(spec).not.toHaveProperty("created_at");
  });

  it("sends trigger-conditional fields only on the trigger they belong to", () => {
    const cron = encodeScheduleSpec({
      name: "c",
      prompt: "p",
      trigger: { kind: "cron", cron: "* * * * *", timezone: "UTC" },
      profile: "",
      workspace: "",
      mode: 2,
      mutating: false,
      maxFires: 10,
      limits: { maxTurns: 0, maxToolCalls: 0, maxConsecutiveFailures: 0 },
      oneShotRetry: true,
      oneShotMaxRetries: 3,
    });
    expect(cron.trigger).toEqual({ cron: "* * * * *" });
    expect(cron.timezone).toBe("UTC");
    expect(cron.max_fires).toBe(10);
    expect(cron).not.toHaveProperty("one_shot_retry");

    const oneShot = encodeScheduleSpec({
      name: "o",
      prompt: "p",
      trigger: { kind: "one-shot", at: Date.parse("2026-08-20T09:00:00Z") },
      profile: "",
      workspace: "",
      mode: 2,
      mutating: false,
      maxFires: 10,
      limits: { maxTurns: 0, maxToolCalls: 0, maxConsecutiveFailures: 0 },
      oneShotRetry: true,
      oneShotMaxRetries: 3,
    });
    // A one-shot Timestamp is RFC 3339 in a request.
    expect(oneShot.trigger).toEqual({ one_shot: "2026-08-20T09:00:00.000Z" });
    expect(oneShot.one_shot_retry).toBe(true);
    expect(oneShot.one_shot_max_retries).toBe(3);
    expect(oneShot).not.toHaveProperty("max_fires");
    expect(oneShot).not.toHaveProperty("timezone");
  });

  it("omits carried fields on a create, where there is nothing to preserve", () => {
    const spec = encodeScheduleSpec({
      name: "n",
      prompt: "p",
      trigger: { kind: "cron", cron: "* * * * *", timezone: "" },
      profile: "",
      workspace: "",
      mode: 2,
      mutating: false,
      maxFires: 0,
      limits: { maxTurns: 0, maxToolCalls: 0, maxConsecutiveFailures: 0 },
      oneShotRetry: false,
      oneShotMaxRetries: 0,
    });
    expect(spec).not.toHaveProperty("singleton");
    expect(spec).not.toHaveProperty("misfire");
    expect(spec).not.toHaveProperty("selector");
  });
});

describe("decodeScheduleFires", () => {
  it("orders newest first, keys in-flight off the absent stop, and drops idless records", () => {
    const fires = decodeScheduleFires({
      fires: [
        {
          id: "f-old",
          session_id: "s-old",
          fired_at: { seconds: 1700000000 },
          stop: "end_turn",
        },
        {
          id: "f-new",
          session_id: "s-new",
          fired_at: { seconds: 1700007200 },
          started_at: { seconds: 1700007201 },
        },
        { session_id: "corrupt-no-id" },
      ],
    });
    expect(fires.map((fire) => fire.id)).toEqual(["f-new", "f-old"]);
    expect(fires[0].inFlight).toBe(true);
    expect(fires[1].inFlight).toBe(false);
  });
});
