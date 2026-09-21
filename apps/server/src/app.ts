// SPDX-License-Identifier: Apache-2.0

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  healthResponseSchema,
  problemDetailsSchema,
  runtimeResponseSchema,
} from "@mecatl-studio/contracts";
import { MecatlError } from "@stacklok-oss/mecatl-sdk";
import { HTTPException } from "hono/http-exception";
import type { AuthenticationService } from "./auth/service.js";
import type { AppEnv } from "./http/env.js";
import { problem, sanitizeUpstreamDetail } from "./http/problem.js";
import {
  csrfCookieIssuer,
  rateLimiter,
  requestContext,
  type SecurityOptions,
  sameOriginMutations,
  securityHeaders,
} from "./http/security.js";
import { spaHandler } from "./http/static.js";
import { type Logger, silentLogger } from "./log.js";
import { type MecatlRuntime, RuntimeNotReadyError } from "./mecatl/runtime.js";
import { registerAuthRoutes } from "./routes/auth.js";

export const openApiInfo = {
  info: { title: "Mecatl Studio API", version: "1.0.0" },
  openapi: "3.1.0",
} as const;

const problemResponse = (description: string) =>
  ({
    content: { "application/problem+json": { schema: problemDetailsSchema } },
    description,
  }) as const;

const healthRoute = createRoute({
  method: "get",
  operationId: "getHealth",
  path: "/api/health",
  responses: {
    200: {
      content: { "application/json": { schema: healthResponseSchema } },
      description: "The Studio BFF is listening.",
    },
  },
});

const runtimeRoute = createRoute({
  method: "get",
  operationId: "getRuntime",
  path: "/api/v1/runtime",
  responses: {
    200: {
      content: { "application/json": { schema: runtimeResponseSchema } },
      description: "The connected Mecatl runtime and its capabilities.",
    },
    401: problemResponse("Sign in before using this deployment."),
    503: problemResponse("The Mecatl runtime is unavailable or not yet negotiated."),
  },
});

export interface AppDependencies {
  readonly authentication?: AuthenticationService;
  readonly logger?: Logger;
  readonly runtime?: MecatlRuntime;
  readonly security?: SecurityOptions;
  /** Directory holding the built SPA; omitted in tests and OpenAPI generation. */
  readonly webDist?: string;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = new OpenAPIHono<AppEnv>();
  const logger = dependencies.logger ?? silentLogger;
  const security = dependencies.security ?? {};
  const { authentication, runtime } = dependencies;

  for (const middleware of requestContext(security)) app.use(middleware);
  app.use(securityHeaders());
  app.use("/api/*", csrfCookieIssuer(security));
  app.use("/api/v1/auth/*", rateLimiter(security));
  app.use("/api/v1/*", sameOriginMutations(security));

  registerAuthRoutes(app, authentication, runtime);

  // AC3.8: with interactive login active, everything under /api/v1 except the
  // auth routes themselves needs a live session; /api/health never does.
  app.use("/api/v1/*", async (context, next) => {
    if (context.req.path.startsWith("/api/v1/auth/")) return next();
    if (authentication === undefined) return next();
    const resolution = await authentication.credential(context);
    if (resolution.status === "anonymous") {
      return problem(
        context,
        401,
        "unauthenticated",
        "Authentication required",
        "Sign in before using this Mecatl deployment.",
      );
    }
    if (resolution.status === "expired") {
      return problem(
        context,
        401,
        "session_expired",
        "Session expired",
        "Your session has expired; sign in again.",
      );
    }
    if (runtime === undefined) return next();
    return runtime.runWithCredential(resolution.credential.accessToken, next);
  });

  app.openapi(healthRoute, (context) =>
    context.json({ service: "mecatl-studio" as const, status: "ok" as const }, 200),
  );

  app.openapi(runtimeRoute, (context) => {
    if (runtime === undefined) return runtimeUnavailable(context, "The BFF has no Mecatl runtime.");
    try {
      return context.json(runtime.snapshot(), 200);
    } catch (error) {
      if (error instanceof RuntimeNotReadyError) {
        void runtime.ready().catch(() => undefined);
        return runtimeUnavailable(context, "Compatibility negotiation with Mecatl is pending.");
      }
      throw error;
    }
  });

  app.doc("/api/openapi.json", openApiInfo);

  if (dependencies.webDist !== undefined) app.use("*", spaHandler(dependencies.webDist));

  app.notFound((context) =>
    problem(context, 404, "not_found", "Not found", "No route matches this request."),
  );

  app.onError((error, context) => {
    if (error instanceof MecatlError) {
      if (
        authentication !== undefined &&
        (error.code === "unauthenticated" || error.code === "authentication")
      ) {
        // AC3.9: an upstream rejection of a session we believed valid ends the session.
        authentication.clear(context);
        return problem(
          context,
          401,
          "session_expired",
          "Session expired",
          "Mecatl rejected the current session; sign in again.",
        );
      }
      return problem(
        context,
        errorStatus(error),
        error.code,
        "Mecatl request failed",
        sanitizeUpstreamDetail(error.message),
      );
    }
    if (error instanceof HTTPException) {
      return problem(
        context,
        error.status,
        "http_error",
        "Request failed",
        error.message || "The request could not be completed.",
      );
    }
    logger.error("http.unhandled", {
      message: error instanceof Error ? error.message : String(error),
      path: context.req.path,
      requestId: context.get("requestId"),
    });
    return problem(
      context,
      500,
      "internal_error",
      "Internal server error",
      "The server could not complete the request.",
    );
  });

  return app;
}

function runtimeUnavailable(context: Parameters<typeof problem>[0], detail: string) {
  return problem(context, 503, "runtime_unavailable", "Mecatl runtime unavailable", detail);
}

function errorStatus(
  error: MecatlError,
): 400 | 401 | 404 | 409 | 410 | 412 | 429 | 500 | 501 | 503 {
  switch (error.status) {
    case 400:
    case 401:
    case 404:
    case 409:
    case 410:
    case 412:
    case 429:
    case 500:
    case 501:
    case 503:
      return error.status;
    default:
      return error.code === "transport" ? 503 : 500;
  }
}
