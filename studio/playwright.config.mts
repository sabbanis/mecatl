import { defineConfig, devices } from "@playwright/test";

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
  // Runs against a production build (`npm run build` first). The spec brings
  // its own hermetic fake-daemon fixture; no other servers are involved.
  webServer: serverAlreadyRunning
    ? undefined
    : [
        {
          command: "npm run start",
          url: BASE_URL,
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      ],
});
