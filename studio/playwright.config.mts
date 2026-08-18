import { defineConfig, devices } from "@playwright/test";

// Set E2E defaults so `pnpm exec playwright test` works without manual env vars.
// The package.json test:e2e script also sets these for the build step.
process.env.BETTER_AUTH_SECRET ??= "e2e-test-secret-at-least-32-chars-long";
process.env.BETTER_AUTH_RATE_LIMIT ??= "100";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function isServerRunning(): Promise<boolean> {
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

const serverAlreadyRunning = await isServerRunning();

// Shared env for all webServer processes. The mock config server is only
// activated when CONFIG_SERVER_URL is set — the DAL returns null when it's
// absent, so tests that don't use the config fixture are unaffected.
const e2eEnv = {
  API_BASE_URL: "http://localhost:9090",
  OIDC_ISSUER_URL: "http://localhost:4000",
  OIDC_CLIENT_ID: "better-auth-dev",
  OIDC_CLIENT_SECRET: "dev-secret-change-in-production",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "e2e-test-secret-at-least-32-chars-long",
  // Better Auth rate limits sign-in to 3 requests per 10 seconds by default.
  // E2E tests with multiple authenticatedPage fixtures exceed this limit,
  // causing 429 errors. Set to 100 to allow rapid sequential logins.
  BETTER_AUTH_RATE_LIMIT: "100",
  // Always use testing model for E2E tests to avoid needing OpenRouter API keys
  USE_E2E_MODEL: "true",
  E2E_MODEL_NAME: process.env.E2E_MODEL_NAME ?? "qwen2.5:1.5b",
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  // Point the DAL at the mock config server. This is the only env change needed
  // to activate config-server-dependent tests — no DAL code changes required.
  CONFIG_SERVER_URL: "http://localhost:4001",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Start all servers independently so Playwright can wait for each one's
  // health check before running tests. Splitting them also means a failure in
  // one server shows a clear error instead of a combined process timeout.
  webServer: serverAlreadyRunning
    ? undefined
    : [
        {
          command: "pnpm oidc",
          url: "http://localhost:4000/.well-known/openid-configuration",
          timeout: 30_000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            OIDC_ISSUER_URL: e2eEnv.OIDC_ISSUER_URL,
            OIDC_CLIENT_ID: e2eEnv.OIDC_CLIENT_ID,
            OIDC_CLIENT_SECRET: e2eEnv.OIDC_CLIENT_SECRET,
          },
        },
        {
          command: "pnpm mock:config-server",
          url: "http://localhost:4001/health",
          timeout: 30_000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            OIDC_ISSUER_URL: e2eEnv.OIDC_ISSUER_URL,
            OIDC_CLIENT_ID: e2eEnv.OIDC_CLIENT_ID,
            OIDC_CLIENT_SECRET: e2eEnv.OIDC_CLIENT_SECRET,
          },
        },
        {
          command: "pnpm mock:server",
          url: "http://localhost:9090/health",
          timeout: 30_000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            API_BASE_URL: e2eEnv.API_BASE_URL,
          },
        },
        {
          // Run against production build - requires `pnpm build` to be run first
          command: "pnpm start",
          url: BASE_URL,
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
          env: e2eEnv,
        },
      ],
});
