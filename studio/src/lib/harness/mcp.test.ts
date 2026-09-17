import { afterEach, describe, expect, it, vi } from "vitest";
import { HarnessApiError } from "./errors";
import {
  availabilityLabel,
  catalogueLabel,
  connectorToolCount,
  enrollmentLabel,
  isNoMcpProvider,
  listHarnessMcpSources,
  listHarnessToolHiveGroups,
} from "./mcp";
import { resetHarnessClient } from "./sdk";
import {
  jsonResponse,
  problemResponse,
  stubHarnessFetch,
} from "./sdk-test-stub";

/**
 * Pins the MCP inventory adapter behind the `/mcp` panel's Studio analogue:
 * the source read hits exactly GET /v1/mcp/sources and projects every
 * source with its servers and skip reasons; the ToolHive groups read hits
 * exactly GET /v1/mcp/toolhive/groups; the daemon's `no_mcp_provider`
 * refusal is classified; and the broker labels are the TUI's words.
 */

afterEach(async () => {
  vi.unstubAllGlobals();
  await resetHarnessClient();
});

describe("listHarnessMcpSources", () => {
  it("reads GET /v1/mcp/sources and projects sources, servers and diagnostics", async () => {
    const { requests } = stubHarnessFetch((request) =>
      request.path === "/v1/mcp/sources"
        ? jsonResponse(200, {
            sources: [
              {
                name: "static",
                kind: "static",
                enabled: true,
                servers: [
                  {
                    name: "github",
                    url: "http://127.0.0.1:1/gh",
                    transport: "streamable-http",
                  },
                ],
              },
              {
                name: "toolhive(default)",
                kind: "toolhive",
                enabled: false,
                group: "default",
                servers: [],
                diagnostics: ["fetch skipped: unsupported transport stdio", ""],
              },
            ],
          })
        : undefined,
    );
    await expect(listHarnessMcpSources()).resolves.toEqual([
      {
        name: "static",
        kind: "static",
        enabled: true,
        group: "",
        servers: [
          {
            name: "github",
            url: "http://127.0.0.1:1/gh",
            transport: "streamable-http",
            group: "",
          },
        ],
        diagnostics: [],
      },
      {
        name: "toolhive(default)",
        kind: "toolhive",
        enabled: false,
        group: "default",
        servers: [],
        diagnostics: ["fetch skipped: unsupported transport stdio"],
      },
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("GET");
    expect(requests[0].url).toBe("/api/mecatl/v1/mcp/sources");
  });

  it("returns an empty list when the daemon resolved no source", async () => {
    stubHarnessFetch((request) =>
      request.path === "/v1/mcp/sources" ? jsonResponse(200, {}) : undefined,
    );
    await expect(listHarnessMcpSources()).resolves.toEqual([]);
  });

  it("throws the typed error, classified as no_mcp_provider, on the daemon's 412", async () => {
    stubHarnessFetch(() =>
      problemResponse(412, "no_mcp_provider", "No MCP provider configured"),
    );
    const failure = await listHarnessMcpSources().catch((error) => error);
    expect(failure).toBeInstanceOf(HarnessApiError);
    expect(isNoMcpProvider(failure)).toBe(true);
    expect(isNoMcpProvider(new Error("other"))).toBe(false);
  });
});

describe("listHarnessToolHiveGroups", () => {
  it("reads GET /v1/mcp/toolhive/groups and drops blank groups", async () => {
    const { requests } = stubHarnessFetch((request) =>
      request.path === "/v1/mcp/toolhive/groups"
        ? jsonResponse(200, { groups: ["default", "", "research"] })
        : undefined,
    );
    await expect(listHarnessToolHiveGroups()).resolves.toEqual([
      "default",
      "research",
    ]);
    expect(requests[0].method).toBe("GET");
    expect(requests[0].url).toBe("/api/mecatl/v1/mcp/toolhive/groups");
  });

  it("rethrows the typed error so the caller can degrade to 'unavailable'", async () => {
    stubHarnessFetch(() => problemResponse(404, "not_found", "no such route"));
    await expect(listHarnessToolHiveGroups()).rejects.toMatchObject({
      name: "HarnessApiError",
      status: 404,
    });
  });
});

describe("broker labels", () => {
  it("words the enrollment state as the TUI does", () => {
    expect(enrollmentLabel("not_required")).toBe("No setup required");
    expect(enrollmentLabel("not_started")).toBe("No active setup");
    expect(enrollmentLabel("pending")).toBe("Setup in progress");
    expect(enrollmentLabel("completed")).toBe("Catalogue ready");
    expect(enrollmentLabel("unknown")).toBe("Status unavailable");
    expect(enrollmentLabel("")).toBe("Status unavailable");
  });

  it("words the catalogue state as the TUI does", () => {
    expect(catalogueLabel("hidden")).toBe("Awaiting discovery");
    expect(catalogueLabel("declared")).toBe("Tools declared");
    expect(catalogueLabel("discovered")).toBe("Tools discovered");
    expect(catalogueLabel("bogus")).toBe("Status unavailable");
  });

  it("shows a tool count only for a declared or discovered catalogue", () => {
    expect(
      connectorToolCount({ catalogueState: "discovered", toolCount: 12 }),
    ).toBe("12");
    expect(
      connectorToolCount({ catalogueState: "declared", toolCount: 0 }),
    ).toBe("0");
    expect(connectorToolCount({ catalogueState: "hidden", toolCount: 7 })).toBe(
      "—",
    );
  });

  it("distinguishes a broker-reported outage from an unknown availability", () => {
    expect(availabilityLabel("unavailable")).toBe("Broker state unavailable");
    expect(availabilityLabel("weird")).toBe("Status unavailable");
  });
});
