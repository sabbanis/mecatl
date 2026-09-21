// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import {
  type AuthenticationService,
  createAuthenticationService,
  mecatuiCallbackUrl,
} from "../auth/service.js";
import type { MecatlRuntime, RuntimeConfig } from "../mecatl/runtime.js";
import { fakeIssuer, resourceUrl } from "../testing/fake-issuer.js";
import { cookieHeader, csrfHeaders, fakeRuntime } from "../testing/fakes.js";

const external: RuntimeConfig = { baseUrl: resourceUrl, resourceUrl, source: "external" };
const secret = "0123456789abcdef0123456789abcdef";

async function service(publicUrl: URL | undefined) {
  return (await createAuthenticationService(external, {
    fetch: fakeIssuer().fetch,
    ...(publicUrl === undefined ? {} : { publicUrl }),
    sessionSecret: secret,
  })) as AuthenticationService;
}

async function completeLogin(
  app: ReturnType<typeof createApp>,
  origin: string,
  headers: Record<string, string> = {},
) {
  const login = await app.request(`${origin}/api/v1/auth/login?returnTo=%2Fworkspace%2Fx`, {
    headers,
  });
  const transaction = login.headers.getSetCookie();
  const location = new URL(login.headers.get("location") ?? "");
  const callbackPath = new URL(location.searchParams.get("redirect_uri") ?? "").pathname;
  const callback = await app.request(
    `${origin}${callbackPath}?code=code-1&state=${location.searchParams.get("state")}`,
    { headers: { ...headers, Cookie: cookieHeader(transaction) } },
  );
  return { callback, login, location };
}

describe("authentication routes", () => {
  it("the callback URL is derived from STUDIO_PUBLIC_URL", async () => {
    const publicUrl = new URL("https://studio.example.com");
    const hosted = createApp({
      authentication: await service(publicUrl),
      runtime: fakeRuntime(),
      security: { publicUrl },
    });
    // Even a request that arrives over plain HTTP on an internal host derives from the public URL.
    const login = await hosted.request("http://studio-internal:3100/api/v1/auth/login");
    expect(login.status).toBe(302);
    const location = new URL(login.headers.get("location") ?? "");
    expect(location.origin).toBe("https://issuer.example.com");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://studio.example.com/api/v1/auth/callback",
    );
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("scope")).toBe("offline_access openid");

    // Development exception: no public URL, the Vite loopback host → mecatui's callback.
    const dev = createApp({ authentication: await service(undefined), runtime: fakeRuntime() });
    const loopback = await dev.request("http://127.0.0.1:18473/api/v1/auth/login", {
      headers: { Host: "127.0.0.1:18473" },
    });
    expect(loopback.status).toBe(302);
    expect(new URL(loopback.headers.get("location") ?? "").searchParams.get("redirect_uri")).toBe(
      mecatuiCallbackUrl,
    );

    // Any other origin without a public URL cannot start login.
    const elsewhere = await dev.request("http://studio.internal:3100/api/v1/auth/login", {
      headers: { Host: "studio.internal:3100" },
    });
    expect(elsewhere.status).toBe(503);
    await expect(elsewhere.json()).resolves.toMatchObject({ code: "login_unconfigured" });
  });

  it("the callback completes login, sets session cookies, and logout clears them", async () => {
    const publicUrl = new URL("https://studio.example.com");
    const verified: string[] = [];
    const runtime: MecatlRuntime = fakeRuntime({
      verifyCredential: async (token) => {
        verified.push(token);
      },
    });
    const app = createApp({
      authentication: await service(publicUrl),
      runtime,
      security: { publicUrl },
    });

    const { callback } = await completeLogin(app, "https://studio.example.com");
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/workspace/x");
    const set = callback.headers.getSetCookie();
    expect(set.some((c) => c.startsWith("studio_access=") && c.includes("HttpOnly"))).toBe(true);
    expect(set.some((c) => c.startsWith("studio_refresh=") && c.includes("HttpOnly"))).toBe(true);
    expect(set.some((c) => c.startsWith("studio_login=;"))).toBe(true);
    expect(verified).toHaveLength(1);

    const session = cookieHeader(set);
    const me = await app.request("https://studio.example.com/api/v1/auth/session", {
      headers: { Cookie: session },
    });
    await expect(me.json()).resolves.toEqual({ mode: "oidc", status: "authenticated" });

    const logout = await app.request("https://studio.example.com/api/v1/auth/logout", {
      headers: csrfHeaders("t", { Cookie: `${session}; studio_csrf=t` }),
      method: "POST",
    });
    expect(logout.status).toBe(204);
    const cleared = logout.headers.getSetCookie();
    for (const name of ["studio_access", "studio_refresh"]) {
      expect(cleared.some((c) => c.startsWith(`${name}=;`) && c.includes("Max-Age=0"))).toBe(true);
    }
    const after = await app.request("https://studio.example.com/api/v1/auth/session");
    await expect(after.json()).resolves.toEqual({ mode: "oidc", status: "anonymous" });

    // Development alias serves the same handler.
    const dev = createApp({ authentication: await service(undefined), runtime: fakeRuntime() });
    const loop = await completeLogin(dev, "http://127.0.0.1:18473", { Host: "127.0.0.1:18473" });
    expect(loop.location.searchParams.get("redirect_uri")).toBe(mecatuiCallbackUrl);
    expect(loop.callback.status).toBe(302);
  });

  it("a missing transaction cookie or mismatched state fails the callback with 400", async () => {
    const publicUrl = new URL("https://studio.example.com");
    const app = createApp({
      authentication: await service(publicUrl),
      runtime: fakeRuntime(),
      security: { publicUrl },
    });
    const login = await app.request("https://studio.example.com/api/v1/auth/login");
    const transaction = cookieHeader(login.headers.getSetCookie());
    const state = new URL(login.headers.get("location") ?? "").searchParams.get("state");

    const noCookie = await app.request(
      `https://studio.example.com/api/v1/auth/callback?code=c&state=${state}`,
    );
    expect(noCookie.status).toBe(400);
    await expect(noCookie.json()).resolves.toMatchObject({ code: "login_state_mismatch" });

    const wrongState = await app.request(
      "https://studio.example.com/api/v1/auth/callback?code=c&state=someone-elses",
      { headers: { Cookie: transaction } },
    );
    expect(wrongState.status).toBe(400);
    await expect(wrongState.json()).resolves.toMatchObject({ code: "login_state_mismatch" });
    expect(
      wrongState.headers
        .getSetCookie()
        .some((c) => c.startsWith("studio_access=") && !c.includes("Max-Age=0")),
    ).toBe(false);
  });

  it("session cookies are Secure when STUDIO_PUBLIC_URL is https regardless of request scheme", async () => {
    const https = new URL("https://studio.example.com");
    const behindProxy = createApp({
      authentication: await service(https),
      runtime: fakeRuntime(),
      security: { publicUrl: https },
    });
    // The Ingress terminated TLS; the BFF sees plain http.
    const { callback } = await completeLogin(behindProxy, "http://studio-internal:3100");
    expect(callback.status).toBe(302);
    for (const cookie of callback.headers.getSetCookie()) {
      if (cookie.startsWith("studio_login=;")) continue;
      expect(cookie).toContain("Secure");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain("Path=/");
    }
    const access = callback.headers.getSetCookie().find((c) => c.startsWith("studio_access="));
    expect(access).toContain("HttpOnly");
    expect(access).toContain("Max-Age=2592000");

    const http = new URL("http://127.0.0.1:3100");
    const local = createApp({
      authentication: await service(http),
      runtime: fakeRuntime(),
      security: { publicUrl: http },
    });
    const plain = await completeLogin(local, "http://127.0.0.1:3100");
    for (const cookie of plain.callback.headers.getSetCookie()) {
      expect(cookie).not.toContain("Secure");
    }
  });
});
