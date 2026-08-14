/**
 * Config for the demo recording in `tests/demo/`.
 *
 * Deliberately separate from the `node --test` suite that `npm test` runs, so a
 * demo recording is never part of CI or a normal verification pass.
 *
 * Assumes the full local stack is already up (`npm run dev` → vinext on 3000,
 * the controller on 8788, and mecated on 8081). No webServer block: this is
 * something you drive deliberately against a real, credentialed stack.
 *
 * Headed and single-worker — the recording shows live streaming and hover state.
 * Videos land in `demo-recordings/raw/`; `npm run demo:record` transcodes them.
 */

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/demo",
  testMatch: /.*\.demo\.ts/,
  outputDir: "./demo-recordings/raw",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  // A full walkthrough with a live agent turn is minutes long by design.
  timeout: 900_000,
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1600, height: 900 },
    video: { mode: "on", size: { width: 1600, height: 900 } },
    headless: false,
    launchOptions: { args: ["--window-size=1620,1000", "--hide-scrollbars"] },
  },
  projects: [{ name: "demo", use: { ...devices["Desktop Chrome"] } }],
});
