import { describe, expect, it } from "vitest";
import { stripMcpAuthorizationControlBody } from "./mcp-authorization-fetch";

const recheck = "/api/mecatl/v1/sessions/s1/mcp-authorizations/auth-1/recheck";
const cancel = "/api/mecatl/v1/sessions/s1/mcp-authorizations/auth-1/cancel";

const emptyPost = (): RequestInit => ({
  method: "POST",
  body: "{}",
  headers: new Headers({
    "content-type": "application/json",
    "x-trace": "keep-me",
  }),
});

describe("stripMcpAuthorizationControlBody", () => {
  it("drops the SDK's empty-object body and its content-type on the recheck route", () => {
    const init = stripMcpAuthorizationControlBody(recheck, emptyPost());
    expect(init?.body).toBeUndefined();
    const headers = new Headers(init?.headers);
    expect(headers.get("content-type")).toBeNull();
    expect(headers.get("x-trace")).toBe("keep-me");
    expect(init?.method).toBe("POST");
  });

  it("handles the cancel route, an absolute URL, and a URL object alike", () => {
    expect(stripMcpAuthorizationControlBody(cancel, emptyPost())?.body).toBe(
      undefined,
    );
    expect(
      stripMcpAuthorizationControlBody(
        `http://127.0.0.1:8099${recheck.replace("/api/mecatl", "")}?x=1`,
        emptyPost(),
      )?.body,
    ).toBeUndefined();
    expect(
      stripMcpAuthorizationControlBody(
        new URL(`http://daemon.test${cancel}`),
        emptyPost(),
      )?.body,
    ).toBeUndefined();
  });

  it("leaves every other request untouched", () => {
    const steer: RequestInit = {
      method: "POST",
      body: JSON.stringify({ text: "hi" }),
    };
    expect(
      stripMcpAuthorizationControlBody(
        "/api/mecatl/v1/sessions/s1/steer",
        steer,
      ),
    ).toBe(steer);
    const compact: RequestInit = { method: "POST", body: "{}" };
    expect(
      stripMcpAuthorizationControlBody(
        "/api/mecatl/v1/sessions/s1/compact",
        compact,
      ),
    ).toBe(compact);
    const presentation: RequestInit = { method: "GET" };
    expect(
      stripMcpAuthorizationControlBody(
        "/api/mecatl/v1/sessions/s1/mcp-authorizations/auth-1/presentation",
        presentation,
      ),
    ).toBe(presentation);
    expect(
      stripMcpAuthorizationControlBody(recheck, undefined),
    ).toBeUndefined();
  });

  it("keeps a NON-empty body on the control routes so a real request is never silently rewritten", () => {
    const init: RequestInit = { method: "POST", body: '{"token":"x"}' };
    expect(stripMcpAuthorizationControlBody(recheck, init)).toBe(init);
  });
});
