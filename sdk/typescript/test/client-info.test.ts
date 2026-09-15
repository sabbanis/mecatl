import { describe, expect, it } from "vitest";

import { connect } from "../src/index.js";

interface Recorded {
  readonly path: string;
  readonly search: string;
}

function harness(): { readonly requests: Recorded[]; readonly fetch: typeof globalThis.fetch } {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requests.push({ path: url.pathname, search: url.search });
    if (url.pathname === "/v1/compatibility") {
      return Response.json({
        api_major: 1,
        capabilities: { steer: true, scheduling: true, posture: "auto" },
        features: ["http_steer", "server_info"],
      });
    }
    if (url.pathname === "/v1/info") {
      return Response.json({
        build_id: "abc123",
        llm_provider_display_endpoint: "https://api.example/v1",
        server_implementation: "mecated",
      });
    }
    return Response.json({ code: "not_found", detail: "not found" }, { status: 404 });
  };
  return { fetch, requests };
}

describe("client.compatibility", () => {
  it("projects the compatibility document", async () => {
    const { fetch } = harness();
    const client = connect({ baseUrl: "http://mecatl.test", fetch });
    const info = await client.compatibility();
    expect(info.apiMajor).toBe(1);
    expect(info.features).toEqual(["http_steer", "server_info"]);
    expect(info.capabilities).toMatchObject({ posture: "auto", scheduling: true, steer: true });
    await client.close();
  });
});

describe("client.serverInfo", () => {
  it("reads the identity probe and passes the provider selector", async () => {
    const { fetch, requests } = harness();
    const client = connect({ baseUrl: "http://mecatl.test", fetch });
    await expect(client.serverInfo({ providerId: "openai" })).resolves.toEqual({
      buildId: "abc123",
      llmProviderDisplayEndpoint: "https://api.example/v1",
      serverImplementation: "mecated",
    });
    const info = requests.find((request) => request.path === "/v1/info");
    expect(info?.search).toBe("?provider_id=openai");
    await client.close();
  });

  it("omits the selector when none is given", async () => {
    const { fetch, requests } = harness();
    const client = connect({ baseUrl: "http://mecatl.test", fetch });
    await client.serverInfo();
    const info = requests.find((request) => request.path === "/v1/info");
    expect(info?.search).toBe("");
    await client.close();
  });
});
