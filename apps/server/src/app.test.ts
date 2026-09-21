// SPDX-License-Identifier: Apache-2.0

import { MecatlError } from "@stacklok-oss/mecatl-sdk";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { RuntimeNotReadyError } from "./mecatl/runtime.js";
import { fakeRuntime, sampleSnapshot } from "./testing/fakes.js";

describe("Studio BFF", () => {
  it("GET /api/health returns 200 and GET /api/v1/runtime returns the negotiated snapshot", async () => {
    const app = createApp({ runtime: fakeRuntime() });

    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ service: "mecatl-studio", status: "ok" });

    const runtime = await app.request("/api/v1/runtime");
    expect(runtime.status).toBe(200);
    await expect(runtime.json()).resolves.toEqual(sampleSnapshot());

    // Health needs no runtime at all.
    const bare = await createApp().request("/api/health");
    expect(bare.status).toBe(200);
  });

  it("GET /api/v1/runtime returns 503 problem details before the runtime is ready", async () => {
    let readyCalls = 0;
    const app = createApp({
      runtime: fakeRuntime({
        ready: async () => {
          readyCalls += 1;
        },
        snapshot: () => {
          throw new RuntimeNotReadyError();
        },
      }),
    });
    const response = await app.request("/api/v1/runtime");
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    await expect(response.json()).resolves.toMatchObject({
      code: "runtime_unavailable",
      status: 503,
    });
    expect(readyCalls).toBe(1);

    const detached = await createApp().request("/api/v1/runtime");
    expect(detached.status).toBe(503);
    await expect(detached.json()).resolves.toMatchObject({ code: "runtime_unavailable" });
  });

  it("API errors are RFC 9457 problem details with a stable code", async () => {
    const app = createApp({
      runtime: fakeRuntime({
        snapshot: () => {
          throw new MecatlError("session missing", {
            code: "session_not_found",
            status: 404,
            transport: "grpc",
          });
        },
      }),
    });

    const missing = await app.request("/api/missing");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("content-type")).toContain("application/problem+json");
    await expect(missing.json()).resolves.toEqual({
      code: "not_found",
      detail: "No route matches this request.",
      instance: "/api/missing",
      status: 404,
      title: "Not found",
      type: "urn:mecatl-studio:problem:not_found",
    });

    const upstream = await app.request("/api/v1/runtime");
    expect(upstream.status).toBe(404);
    await expect(upstream.json()).resolves.toMatchObject({
      code: "session_not_found",
      status: 404,
      type: "urn:mecatl-studio:problem:session_not_found",
    });
  });

  it("problem details from upstream errors are clamped and carry no bearer material", async () => {
    const noisy = `upstream https://mecak8s.internal:443/v1 at 10.0.0.7:50051 said Bearer abc.def-ghi rejected ${"x".repeat(1_000)}`;
    const app = createApp({
      runtime: fakeRuntime({
        snapshot: () => {
          throw new MecatlError(noisy, { code: "internal", status: 500, transport: "grpc" });
        },
      }),
    });
    const response = await app.request("/api/v1/runtime");
    expect(response.status).toBe(500);
    const body = (await response.json()) as { detail: string };
    expect([...body.detail].length).toBeLessThanOrEqual(400);
    expect(body.detail).not.toContain("abc.def-ghi");
    expect(body.detail).not.toContain("mecak8s.internal");
    expect(body.detail).not.toContain("10.0.0.7");
    expect(body.detail).toContain("[upstream]");
  });
});
