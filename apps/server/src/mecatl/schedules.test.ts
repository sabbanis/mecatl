// SPDX-License-Identifier: Apache-2.0

import { createScheduleRequestSchema, maximumInt32 } from "@mecatl-studio/contracts";
import type { Client } from "@stacklok-oss/mecatl-sdk";
import { PermissionMode } from "@stacklok-oss/mecatl-sdk/gen";
import { describe, expect, it, vi } from "vitest";
import { createMecatlScheduleService } from "./schedules";

function baseWriteRequest() {
  return {
    maxFires: 0,
    mode: "plan" as const,
    mutating: false,
    oneShotMaxRetries: 0,
    oneShotRetry: false,
    profile: "all" as const,
    prompt: "Summarize the day",
    trigger: { expression: "0 9 * * *", kind: "cron" as const, timezone: "Europe/Rome" },
  };
}

/** A minimal, response-mapping-safe SDK schedule, with the given wire profile. */
function sdkSchedule(profile: string) {
  return {
    schedule: {
      spec: {
        maxFires: 0,
        mode: PermissionMode.PLAN,
        mutating: false,
        name: "daily-summary",
        oneShotMaxRetries: 0,
        oneShotRetry: false,
        profile,
        prompt: "Summarize the day",
        trigger: { cron: "0 9 * * *" },
      },
      state: {},
    },
  };
}

describe("Mecatl schedule tool profile", () => {
  it("forwards the no-filesystem profile to the SDK spec on create", async () => {
    const create = vi.fn().mockResolvedValue(sdkSchedule("no-fs"));
    const service = createMecatlScheduleService(
      { schedules: { create } } as unknown as Client,
      true,
    );

    await service.create({ ...baseWriteRequest(), name: "daily-summary", profile: "noFilesystem" });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ spec: expect.objectContaining({ profile: "no-fs" }) }),
    );
  });

  it("defaults to the all-tools profile on create", async () => {
    const create = vi.fn().mockResolvedValue(sdkSchedule(""));
    const service = createMecatlScheduleService(
      { schedules: { create } } as unknown as Client,
      true,
    );

    await service.create({ ...baseWriteRequest(), name: "daily-summary", profile: "all" });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ spec: expect.objectContaining({ profile: "" }) }),
    );
  });

  it("decodes the SDK's profile back into the response enum", async () => {
    const create = vi.fn().mockResolvedValue(sdkSchedule("no-fs"));
    const service = createMecatlScheduleService(
      { schedules: { create } } as unknown as Client,
      true,
    );

    const response = await service.create({
      ...baseWriteRequest(),
      name: "daily-summary",
      profile: "noFilesystem",
    });

    expect(response.profile).toBe("noFilesystem");
  });

  it("re-sends the request's profile on update rather than the schedule's prior value", async () => {
    const get = vi.fn().mockResolvedValue(sdkSchedule("no-fs"));
    const update = vi.fn().mockResolvedValue(sdkSchedule(""));
    const service = createMecatlScheduleService(
      { schedules: { get, update } } as unknown as Client,
      true,
    );

    await service.update("daily-summary", { ...baseWriteRequest(), profile: "all" });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ spec: expect.objectContaining({ profile: "" }) }),
    );
  });
});

describe("Mecatl schedule spec mapping", () => {
  const ts = (seconds: number) => ({ nanos: 0, seconds: BigInt(seconds) });
  const spec = (over: Record<string, unknown>) => ({
    schedule: {
      spec: {
        maxFires: 0,
        mode: PermissionMode.PLAN,
        mutating: false,
        name: "s",
        oneShotMaxRetries: 0,
        oneShotRetry: false,
        profile: "",
        prompt: "p",
        timezone: "",
        trigger: { cron: "0 9 * * *" },
        ...over,
      },
      state: {},
    },
  });

  it("maps cron and one-shot triggers to the SDK spec and back", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(spec({ maxFires: 3, timezone: "Europe/Rome" }))
      .mockResolvedValueOnce(
        spec({
          oneShotMaxRetries: 2,
          oneShotRetry: true,
          trigger: { cron: "", oneShot: ts(1_800_000_000) },
        }),
      );
    const service = createMecatlScheduleService(
      { schedules: { create } } as unknown as Client,
      true,
    );

    const cron = await service.create({
      ...baseWriteRequest(),
      maxFires: 3,
      name: "s",
      oneShotMaxRetries: 5,
      oneShotRetry: true,
    });
    expect(create.mock.calls[0]?.[0].spec).toMatchObject({
      maxFires: 3,
      oneShotMaxRetries: 0,
      oneShotRetry: false,
      timezone: "Europe/Rome",
      trigger: { cron: "0 9 * * *", oneShot: undefined },
    });
    expect(cron.trigger).toEqual({
      expression: "0 9 * * *",
      kind: "cron",
      timezone: "Europe/Rome",
    });

    const once = await service.create({
      ...baseWriteRequest(),
      maxFires: 3,
      name: "s",
      oneShotMaxRetries: 2,
      oneShotRetry: true,
      trigger: { at: "2027-01-15T08:00:00.000Z", kind: "once" },
    });
    expect(create.mock.calls[1]?.[0].spec).toMatchObject({
      maxFires: 0,
      oneShotMaxRetries: 2,
      oneShotRetry: true,
      timezone: "",
      trigger: { cron: "", oneShot: { seconds: 1_800_000_000n } },
    });
    expect(once.trigger).toEqual({ at: "2027-01-15T08:00:00.000Z", kind: "once" });
  });

  it("preserves the schedule's existing limits, selector, and parts on update", async () => {
    const current = spec({
      carryContext: true,
      fireTimeout: ts(600),
      limits: { maxConsecutiveFailures: 4, maxToolCalls: 40, maxTurns: 9 },
      misfire: 2,
      parts: [{ kind: "text" }],
      selector: { modelId: "claude", providerId: "anthropic" },
      singleton: true,
    });
    const get = vi.fn().mockResolvedValue(current);
    const update = vi.fn().mockResolvedValue(current);
    const service = createMecatlScheduleService(
      { schedules: { get, update } } as unknown as Client,
      true,
    );

    const result = await service.update("s", { ...baseWriteRequest(), prompt: "new prompt" });

    expect(get).toHaveBeenCalledWith(expect.objectContaining({ name: "s" }));
    expect(update.mock.calls[0]?.[0].spec).toMatchObject({
      carryContext: true,
      fireTimeout: { seconds: 600n },
      limits: { maxConsecutiveFailures: 4, maxToolCalls: 40, maxTurns: 9 },
      misfire: 2,
      name: "s",
      parts: [{ kind: "text" }],
      prompt: "new prompt",
      selector: { modelId: "claude", providerId: "anthropic" },
      singleton: true,
    });
    expect(result).toMatchObject({ modelId: "claude", providerId: "anthropic" });
  });

  it("round-trips the permission mode with plan as the default", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(spec({ mode: PermissionMode.DEFAULT }))
      .mockResolvedValueOnce(spec({ mode: PermissionMode.ACCEPT_EDITS }))
      .mockResolvedValueOnce(spec({ mode: PermissionMode.PLAN }));
    const service = createMecatlScheduleService(
      { schedules: { create } } as unknown as Client,
      true,
    );

    const a = await service.create({ ...baseWriteRequest(), mode: "default", name: "s" });
    const b = await service.create({ ...baseWriteRequest(), mode: "acceptEdits", name: "s" });
    const c = await service.create({ ...baseWriteRequest(), name: "s" });
    expect(create.mock.calls.map((call) => call[0].spec.mode)).toEqual([
      PermissionMode.DEFAULT,
      PermissionMode.ACCEPT_EDITS,
      PermissionMode.PLAN,
    ]);
    expect([a.mode, b.mode, c.mode]).toEqual(["default", "acceptEdits", "plan"]);
  });

  it("derives schedule status from enabled, in-flight, and pending claims", async () => {
    const rows = [
      { name: "paused", state: { enabled: false } },
      { name: "running", state: { enabled: true, lastFireStartedAt: ts(1_700_000_000) } },
      { name: "claimed", state: { enabled: true, lastFireSessionId: "pending" } },
      {
        name: "scheduled",
        state: { enabled: true, lastFireSessionId: "sess-9", nextFireAt: ts(1_800_000_000) },
      },
    ].map(({ name, state }) => ({ ...spec({ name }).schedule, state }));
    const list = vi.fn().mockResolvedValue({ schedules: rows.reverse() });
    const service = createMecatlScheduleService({ schedules: { list } } as unknown as Client, true);

    const response = await service.list();

    expect(response.supported).toBe(true);
    expect(response.items.map((item) => [item.name, item.status])).toEqual([
      ["claimed", "claimed"],
      ["paused", "paused"],
      ["running", "running"],
      ["scheduled", "scheduled"],
    ]);
    expect(response.items.find((item) => item.name === "claimed")?.lastFireSessionId).toBe("");
    expect(response.items.find((item) => item.name === "scheduled")).toMatchObject({
      lastFireSessionId: "sess-9",
      nextFireAt: "2027-01-15T08:00:00.000Z",
    });

    const off = createMecatlScheduleService(
      { schedules: { list } } as unknown as Client,
      () => false,
    );
    await expect(off.list()).resolves.toEqual({
      items: [],
      reason: "Scheduling is not enabled on this Mecatl deployment.",
      supported: false,
    });
  });

  it("lists fires newest first with in-flight derived from a missing stop", async () => {
    const listFires = vi.fn().mockResolvedValue({
      fires: [
        {
          err: "",
          firedAt: ts(100),
          id: "old",
          scheduleName: "s",
          sessionId: "a",
          stop: "end_turn",
        },
        { err: "", firedAt: ts(300), id: "", scheduleName: "s", sessionId: "ghost", stop: "" },
        { err: "boom", firedAt: ts(200), id: "live", scheduleName: "s", sessionId: "b", stop: "" },
      ],
    });
    const service = createMecatlScheduleService(
      { schedules: { listFires } } as unknown as Client,
      true,
    );

    const response = await service.listFires("s");

    expect(response.items.map((fire) => fire.id)).toEqual(["live", "old"]);
    expect(response.items[0]).toMatchObject({ error: "boom", inFlight: true, stop: "" });
    expect(response.items[1]).toMatchObject({ inFlight: false, stop: "end_turn" });
    expect(response.items[1]?.firedAt).toBe("1970-01-01T00:01:40.000Z");
  });
});

describe("Mecatl schedule terminal state and numeric bounds", () => {
  const ts = (seconds: number) => ({ nanos: 0, seconds: BigInt(seconds) });
  const row = (name: string, state: Record<string, unknown>) => ({
    spec: {
      maxFires: 0,
      mode: PermissionMode.PLAN,
      mutating: false,
      name,
      oneShotMaxRetries: 0,
      oneShotRetry: false,
      profile: "",
      prompt: "p",
      timezone: "",
      trigger: { cron: "0 9 * * *" },
    },
    state,
  });

  it("reports a fired one-shot and an exhausted cron as completed", async () => {
    const list = vi.fn().mockResolvedValue({
      schedules: [
        // A one-shot that has run: enabled, one fire, no next fire.
        row("one-shot-done", { enabled: true, fireCount: 1, lastFireAt: ts(1_700_000_000) }),
        // A cron that reached maxFires: same shape, several fires.
        row("cron-exhausted", { enabled: true, fireCount: 5, lastFireAt: ts(1_700_000_000) }),
        // Never fired and no next fire yet: still scheduled, not completed.
        row("fresh", { enabled: true, fireCount: 0 }),
        // A future fire pending.
        row("upcoming", { enabled: true, fireCount: 2, nextFireAt: ts(1_900_000_000) }),
        // Disabled outranks everything.
        row("paused", { enabled: false, fireCount: 3 }),
      ],
    });
    const service = createMecatlScheduleService({ schedules: { list } } as unknown as Client, true);

    const response = await service.list();

    expect(response.items.map((item) => [item.name, item.status])).toEqual([
      ["cron-exhausted", "completed"],
      ["fresh", "scheduled"],
      ["one-shot-done", "completed"],
      ["paused", "paused"],
      ["upcoming", "scheduled"],
    ]);
    // A completed schedule is still enabled and keeps its fire count.
    const done = response.items.find((item) => item.name === "one-shot-done");
    expect(done).toMatchObject({ enabled: true, fireCount: 1, nextFireAt: null });
  });

  it("refuses counts a signed 32-bit daemon field cannot represent", () => {
    const base = {
      mode: "plan" as const,
      mutating: false,
      name: "s",
      oneShotRetry: false,
      profile: "all" as const,
      prompt: "p",
      trigger: { expression: "0 9 * * *", kind: "cron" as const, timezone: "UTC" },
    };
    // The ceiling itself is representable.
    expect(
      createScheduleRequestSchema.safeParse({
        ...base,
        maxFires: maximumInt32,
        oneShotMaxRetries: maximumInt32,
      }).success,
    ).toBe(true);
    for (const bad of [
      { maxFires: maximumInt32 + 1, oneShotMaxRetries: 0 },
      { maxFires: 0, oneShotMaxRetries: maximumInt32 + 1 },
      { maxFires: Number.MAX_SAFE_INTEGER + 2, oneShotMaxRetries: 0 },
      { maxFires: 1.5, oneShotMaxRetries: 0 },
      { maxFires: -1, oneShotMaxRetries: 0 },
      { maxFires: Number.NaN, oneShotMaxRetries: 0 },
      { maxFires: Number.POSITIVE_INFINITY, oneShotMaxRetries: 0 },
    ]) {
      expect(
        createScheduleRequestSchema.safeParse({ ...base, ...bad }).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });
});
