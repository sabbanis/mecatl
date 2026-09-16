import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchHarnessDiagnosticsOptions,
  HarnessApiError,
  readDiagnosticsOptions,
  saveHarnessDiagnosticsOptions,
} from "./client";
import { resetHarnessClient } from "./sdk";

/**
 * The controller's diagnostics-options route as the browser sees it through
 * /api/mecatl-control: the GET's document + effective product-metrics
 * verdict (null on external mode's 409 or an older controller's 404), and
 * the POST's exact JSON body — the partial patch, nothing else — with a
 * non-OK answer surfacing as a typed HarnessApiError carrying mecated's own
 * refusal.
 */

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetHarnessClient();
});

describe("readDiagnosticsOptions", () => {
  it("fills a sparse document with mecated's defaults and drops a bad threshold to 0", () => {
    expect(readDiagnosticsOptions({})).toEqual({
      logLevel: "info",
      quiet: false,
      admin: { enabled: false, perfMcp: false, goroutineWarnThreshold: 0 },
      productMetrics: { enabled: true, dryRun: false },
    });
    expect(
      readDiagnosticsOptions({
        logLevel: "debug",
        quiet: true,
        admin: { enabled: true, perfMcp: true, goroutineWarnThreshold: "x" },
        productMetrics: { enabled: false, dryRun: true },
      }),
    ).toEqual({
      logLevel: "debug",
      quiet: true,
      admin: { enabled: true, perfMcp: true, goroutineWarnThreshold: 0 },
      productMetrics: { enabled: false, dryRun: true },
    });
    expect(readDiagnosticsOptions(null)).toBeNull();
    expect(readDiagnosticsOptions("info")).toBeNull();
  });
});

describe("fetchHarnessDiagnosticsOptions", () => {
  it("reads the saved document and the effective product-metrics verdict", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return jsonResponse(200, {
        options: {
          logLevel: "warn",
          quiet: false,
          admin: { enabled: true, perfMcp: false, goroutineWarnThreshold: 500 },
          productMetrics: { enabled: true, dryRun: false },
        },
        productMetrics: {
          enabled: false,
          dryRun: false,
          source: "environment",
        },
      });
    });
    await expect(fetchHarnessDiagnosticsOptions()).resolves.toEqual({
      options: {
        logLevel: "warn",
        quiet: false,
        admin: { enabled: true, perfMcp: false, goroutineWarnThreshold: 500 },
        productMetrics: { enabled: true, dryRun: false },
      },
      productMetrics: { effective: false, source: "environment" },
    });
    expect(calls).toEqual(["/api/mecatl-control/diagnostics-options"]);
  });

  it("derives the verdict from the saved switch when the controller omits it", async () => {
    vi.stubGlobal("fetch", async () =>
      jsonResponse(200, {
        options: { productMetrics: { enabled: false } },
      }),
    );
    const state = await fetchHarnessDiagnosticsOptions();
    expect(state?.productMetrics).toEqual({
      effective: false,
      source: "studio",
    });
  });

  it("returns null when the controller refuses (external mode's 409) or lacks the route (404)", async () => {
    vi.stubGlobal("fetch", async () =>
      jsonResponse(409, { error: "owned by the external deployment" }),
    );
    await expect(fetchHarnessDiagnosticsOptions()).resolves.toBeNull();
    vi.stubGlobal("fetch", async () =>
      jsonResponse(404, { error: "not found" }),
    );
    await expect(fetchHarnessDiagnosticsOptions()).resolves.toBeNull();
    vi.stubGlobal("fetch", async () => jsonResponse(200, { options: null }));
    await expect(fetchHarnessDiagnosticsOptions()).resolves.toBeNull();
  });
});

describe("saveHarnessDiagnosticsOptions", () => {
  it("POSTs exactly the patch as JSON and adopts the controller's echo", async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init });
        return jsonResponse(200, {
          ok: true,
          options: { logLevel: "debug", quiet: true },
        });
      },
    );
    const saved = await saveHarnessDiagnosticsOptions({ logLevel: "debug" });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("/api/mecatl-control/diagnostics-options");
    expect(requests[0].init?.method).toBe("POST");
    expect(new Headers(requests[0].init?.headers).get("content-type")).toBe(
      "application/json",
    );
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      logLevel: "debug",
    });
    expect(saved?.logLevel).toBe("debug");
    expect(saved?.quiet).toBe(true);
  });

  it("throws a HarnessApiError carrying the controller's refusal", async () => {
    vi.stubGlobal("fetch", async () =>
      jsonResponse(400, {
        error:
          "The perf MCP server mounts on the admin listener — enable the admin listener first",
      }),
    );
    const error = await saveHarnessDiagnosticsOptions({
      admin: { perfMcp: true },
    }).catch((caught) => caught);
    expect(error).toBeInstanceOf(HarnessApiError);
    expect((error as HarnessApiError).status).toBe(400);
    expect((error as HarnessApiError).message).toMatch(/admin listener/);
  });
});
