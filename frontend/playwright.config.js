// @ts-check
import { defineConfig, devices } from "playwright/test";

/**
 * Playwright configuration for Hyro frontend e2e tests.
 *
 * The suite uses the DEV server (Vite) so that the /screens/* unguarded
 * routes are available. Auth-gated /app/* routes are reached by seeding
 * localStorage (arisan_app_access) and Supabase session cookies in a
 * global setup step rather than going through the real UI login on every
 * test file — both for speed and headless reliability.
 *
 * Run: npm run test:e2e  (from frontend/)
 */
export default defineConfig({
  testDir: "./e2e",
  /* Maximum time one test can run. */
  timeout: 30_000,
  /* Run files in parallel. */
  fullyParallel: true,
  /* Fail fast in CI: no retry on first run. */
  retries: process.env.CI ? 1 : 0,
  /* Limit workers to keep the dev server stable. */
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],

  use: {
    baseURL: "http://localhost:5173",
    /* Only capture trace / screenshots on failure. */
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    /* Emulate a mobile viewport (390×844) — matches the app's design target. */
    viewport: { width: 390, height: 844 },
    /* Slightly longer navigation timeout for Vite cold starts. */
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
  },

  projects: [
    /* Global setup runs first to seed auth state. */
    {
      name: "setup",
      testMatch: /.*\.setup\.js/,
    },
    /* Main chromium suite, depends on setup. */
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        /* Re-use the storage state written by the setup project. */
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  /* Start the Vite dev server before running tests. */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
