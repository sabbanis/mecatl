/** Cloudflare Worker entry point: static assets, image optimization, and the
 *  same-origin proxies to the local mecated API and Studio controller. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

// Declared locally rather than pulled from @cloudflare/workers-types: the two
// bindings below are all this worker touches, and the full types package would
// be a dependency for two symbols.
interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: AssetFetcher;
  MECATL_BASE_URL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Same-origin streaming proxy for the local mecatl HTTP/SSE server. In local
    // development this targets mecated's loopback listener; hosted deployments
    // may provide MECATL_BASE_URL as an environment variable.
    if (url.pathname.startsWith("/api/mecatl/")) {
      const base = (env.MECATL_BASE_URL || "http://127.0.0.1:8081").replace(/\/$/, "");
      const upstream = new URL(url.pathname.slice("/api/mecatl".length) + url.search, base);
      try {
        return await fetch(new Request(upstream, request));
      } catch {
        return Response.json({ error: "The local Mecatl API is unavailable. It may be restarting." }, { status: 503 });
      }
    }

    if (url.pathname.startsWith("/api/mecatl-control/")) {
      const upstream = new URL(url.pathname.slice("/api/mecatl-control".length) + url.search, "http://127.0.0.1:8788");
      try {
        return await fetch(new Request(upstream, request));
      } catch {
        return Response.json({ error: "The local Mecatl controller is unavailable. It may be restarting." }, { status: 503 });
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
