// SPDX-License-Identifier: Apache-2.0

import type { ScheduleResponse } from "@mecatl-studio/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import type { ScheduleService } from "../mecatl/schedules";
import { csrfHeaders } from "../testing/fakes";

const example: ScheduleResponse = {
  enabled: true,
  fireCount: 2,
  lastFireAt: "2026-09-15T09:00:00.000Z",
  lastFireSessionId: "session-1",
  maxFires: 0,
  mode: "plan",
  modelId: "",
  mutating: false,
  name: "daily-summary",
  nextFireAt: "2026-09-16T09:00:00.000Z",
  oneShotMaxRetries: 0,
  oneShotRetry: false,
  owner: "",
  profile: "all",
  prompt: "Summarize the day",
  providerId: "",
  status: "scheduled",
  trigger: { expression: "0 9 * * *", kind: "cron", timezone: "Europe/Rome" },
};

const calls: string[] = [];
const schedules: ScheduleService = {
  supported: true,
  async create() {
    calls.push("create");
    return example;
  },
  async delete() {
    calls.push("delete");
  },
  async fire() {
    calls.push("fire");
  },
  async list() {
    return { items: [example], reason: "", supported: true };
  },
  async listFires() {
    return { items: [] };
  },
  async pause() {
    calls.push("pause");
  },
  async resume() {
    calls.push("resume");
  },
  async update() {
    calls.push("update");
    return example;
  },
};

const app = createApp({ schedules });

const mutating = (body?: unknown, method = "POST") => ({
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  headers: csrfHeaders("t", { "Content-Type": "application/json" }),
  method,
});

describe("schedule routes", () => {
  beforeEach(() => calls.splice(0));

  it("lists normalized schedules", async () => {
    const response = await app.request("/api/v1/schedules");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [{ name: "daily-summary" }] });
  });

  it("routes lifecycle actions", async () => {
    for (const action of ["fire", "pause", "resume"] as const) {
      const response = await app.request(
        "/api/v1/schedules/daily-summary/actions",
        mutating({ action }),
      );
      expect(response.status).toBe(204);
    }
    const removed = await app.request(
      "/api/v1/schedules/daily-summary",
      mutating(undefined, "DELETE"),
    );
    expect(removed.status).toBe(204);
    expect(calls).toEqual(["fire", "pause", "resume", "delete"]);
  });

  it("capability-disables unsupported mutations", async () => {
    const unsupported = createApp({ schedules: { ...schedules, supported: false } });
    const response = await unsupported.request(
      "/api/v1/schedules/daily-summary",
      mutating(undefined, "DELETE"),
    );
    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ code: "schedule_unsupported" });

    const list = await unsupported.request("/api/v1/schedules");
    expect(list.status).toBe(200);
    for (const [path, init] of [
      ["/api/v1/schedules", mutating({ ...example, name: "x" })],
      ["/api/v1/schedules/daily-summary", mutating(example, "PUT")],
      ["/api/v1/schedules/daily-summary/actions", mutating({ action: "fire" })],
      ["/api/v1/schedules/daily-summary/fires", undefined],
    ] as const) {
      const blocked = await unsupported.request(path, init);
      expect(blocked.status).toBe(501);
    }
  });

  it("answers 503 runtime_unavailable on every schedules route without a runtime", async () => {
    const detached = createApp();
    for (const [path, init] of [
      ["/api/v1/schedules", undefined],
      ["/api/v1/schedules", mutating({ ...example, name: "x" })],
      ["/api/v1/schedules/daily-summary", mutating(example, "PUT")],
      ["/api/v1/schedules/daily-summary/actions", mutating({ action: "pause" })],
      ["/api/v1/schedules/daily-summary", mutating(undefined, "DELETE")],
      ["/api/v1/schedules/daily-summary/fires", undefined],
    ] as const) {
      const response = await detached.request(path, init);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ code: "runtime_unavailable" });
    }
  });

  it("schedule mutations require the CSRF pair and a session when interactive login is active", async () => {
    for (const [path, init] of [
      ["/api/v1/schedules", { body: "{}", method: "POST" }],
      ["/api/v1/schedules/daily-summary", { body: "{}", method: "PUT" }],
      ["/api/v1/schedules/daily-summary/actions", { body: "{}", method: "POST" }],
      ["/api/v1/schedules/daily-summary", { method: "DELETE" }],
    ] as const) {
      const response = await app.request(path, {
        ...init,
        headers: { "Content-Type": "application/json" },
      });
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: "cross_site_request" });
    }
    const gated = createApp({
      authentication: {
        clear: () => undefined,
        completeLogin: async () => {
          throw new Error("unused");
        },
        credential: async () => ({ status: "anonymous" }),
        logout: async () => undefined,
        save: async () => undefined,
        startLogin: async () => "https://issuer.example.com/authorize",
      },
      schedules,
    });
    const list = await gated.request("/api/v1/schedules");
    expect(list.status).toBe(401);
    const fire = await gated.request(
      "/api/v1/schedules/daily-summary/actions",
      mutating({ action: "fire" }),
    );
    expect(fire.status).toBe(401);
    expect(calls).toEqual([]);
  });
});
