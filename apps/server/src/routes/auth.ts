// SPDX-License-Identifier: Apache-2.0

import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { authSessionResponseSchema, problemDetailsSchema } from "@mecatl-studio/contracts";
import type { Context } from "hono";
import { AuthenticationError, type AuthenticationService } from "../auth/service.js";
import type { AppEnv } from "../http/env.js";
import { problem } from "../http/problem.js";
import type { MecatlRuntime } from "../mecatl/runtime.js";

const problemResponse = {
  content: { "application/problem+json": { schema: problemDetailsSchema } },
  description: "The authentication operation could not be completed.",
} as const;

const redirectResponse = {
  description: "Continue the browser authentication flow.",
  headers: z.object({ Location: z.string() }),
} as const;

const sessionRoute = createRoute({
  method: "get",
  operationId: "getAuthSession",
  path: "/api/v1/auth/session",
  responses: {
    200: {
      content: { "application/json": { schema: authSessionResponseSchema } },
      description: "How this deployment identifies callers, and this browser's own state.",
    },
  },
});

const loginRoute = createRoute({
  method: "get",
  operationId: "startAuthLogin",
  path: "/api/v1/auth/login",
  request: {
    query: z.object({
      returnTo: z.string().optional(),
    }),
  },
  responses: {
    302: redirectResponse,
    400: problemResponse,
    409: problemResponse,
    503: problemResponse,
  },
});

const callbackRoute = createRoute({
  method: "get",
  operationId: "completeAuthLogin",
  path: "/api/v1/auth/callback",
  responses: {
    302: redirectResponse,
    400: problemResponse,
    401: problemResponse,
    409: problemResponse,
    500: problemResponse,
    503: problemResponse,
  },
});

const logoutRoute = createRoute({
  method: "post",
  operationId: "logoutAuthSession",
  path: "/api/v1/auth/logout",
  responses: {
    204: { description: "The browser session was cleared." },
    403: problemResponse,
  },
});

export function registerAuthRoutes(
  app: OpenAPIHono<AppEnv>,
  authentication: AuthenticationService | undefined,
  runtime: MecatlRuntime | undefined,
) {
  app.openapi(sessionRoute, async (context) => {
    if (authentication === undefined) {
      return context.json(
        { mode: runtime?.authMode ?? ("none" as const), status: "disabled" as const },
        200,
      );
    }
    const resolution = await authentication.credential(context);
    return context.json(
      {
        mode: "oidc" as const,
        status:
          resolution.status === "authenticated"
            ? ("authenticated" as const)
            : ("anonymous" as const),
      },
      200,
    );
  });

  app.openapi(loginRoute, async (context) => {
    if (authentication === undefined) return authenticationDisabled(context);
    try {
      const location = await authentication.startLogin(
        context,
        context.req.valid("query").returnTo,
      );
      return context.redirect(location, 302);
    } catch (error) {
      return authenticationFailure(context, error, 503);
    }
  });

  const completeLogin = async (context: Context<AppEnv>) => {
    if (authentication === undefined || runtime === undefined) {
      return authenticationDisabled(context);
    }
    try {
      const result = await authentication.completeLogin(context);
      await runtime.verifyCredential(result.credential.accessToken);
      await authentication.save(context, result.credential);
      return context.redirect(result.returnTo, 302);
    } catch (error) {
      authentication.clear(context);
      if (error instanceof AuthenticationError) {
        return authenticationFailure(context, error, 400);
      }
      return problem(
        context,
        401,
        "mecatl_credential_rejected",
        "Login rejected",
        "Mecatl rejected the credential returned by the identity provider.",
      );
    }
  };

  app.openapi(callbackRoute, completeLogin);
  // The mecatui loopback callback alias used by local development (AC3.4).
  app.get("/oauth/callback", completeLogin);

  app.openapi(logoutRoute, async (context) => {
    await authentication?.logout(context);
    return context.body(null, 204);
  });
}

function authenticationDisabled(context: Context<AppEnv>) {
  return problem(
    context,
    409,
    "authentication_disabled",
    "Authentication disabled",
    "This Mecatl connection does not advertise interactive authentication.",
  );
}

function authenticationFailure(
  context: Context<AppEnv>,
  error: unknown,
  fallbackStatus: 400 | 503,
) {
  if (error instanceof AuthenticationError) {
    const status =
      error.code === "session_too_large"
        ? 500
        : error.code.includes("discovery") ||
            error.code === "pkce_unsupported" ||
            error.code === "login_unconfigured"
          ? 503
          : 400;
    return problem(context, status, error.code, "Authentication failed", error.message);
  }
  return problem(
    context,
    fallbackStatus,
    "authentication_failed",
    "Authentication failed",
    "The browser login could not be completed.",
  );
}
