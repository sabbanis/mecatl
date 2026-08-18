import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy header.
 * All API calls (OIDC, backend API) happen server-side,
 * so browser CSP only needs 'self'.
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://randomuser.me;
  font-src 'self';
  connect-src 'self';
  form-action 'self';
  frame-src *;
  frame-ancestors 'none';
  base-uri 'self';
  object-src 'none';
  ${process.env.NODE_ENV === "production" ? "upgrade-insecure-requests;" : ""}
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  poweredByHeader: false,
  // Include OpenAPI schema files in the Vercel/standalone deployment bundle.
  // mocker.ts reads them at runtime via fs.readFileSync to generate fixture
  // handlers; without this they are absent from /var/task/ on Vercel.
  // Include OpenAPI schema files in the Vercel/standalone deployment bundle.
  // mocker.ts reads them at runtime via fs.readFileSync.
  outputFileTracingIncludes: {
    "/api/mock/**": ["./swagger.json", "./user-management-openapi.yaml"],
    "/api-docs/**": ["./swagger.json", "./user-management-openapi.yaml"],
  },
  async headers() {
    return [
      {
        // Apply strict security headers to all routes except the proxy endpoint.
        // The proxy serves third-party HTML that needs unrestricted resource loading,
        // so it gets its own permissive CSP below.
        source: "/((?!api/proxy).*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        // Proxy endpoint: allow the proxied page's own resources to load freely.
        source: "/api/proxy",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  async rewrites() {
    if (!isDev) return [];

    const apiBaseUrl = process.env.API_BASE_URL || "";

    return [
      // Proxy registry API in development (to mock server or real backend)
      {
        source: "/registry/:path*",
        destination: `${apiBaseUrl}/registry/:path*`,
      },
    ];
  },
};

export default nextConfig;
