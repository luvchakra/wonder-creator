import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite for Wonder Creator.
 *
 * The app server is NOT started here (no `webServer`): run it yourself against the local
 * Supabase stack with WONDER_AI_PROVIDER=offline, e.g.
 *   (cd apps/web && npx next dev -p 3000)
 * CI builds the app and starts it with `next start` before `npm run test:e2e`
 * (see .github/workflows/ci.yml).
 *
 * Env:
 *   E2E_BASE_URL              app origin (default http://localhost:3000)
 *   PLAYWRIGHT_CHROMIUM_PATH  Chromium binary; unset → /opt/pw-browsers/chromium when present,
 *                             empty string → Playwright's own installed browser (CI).
 *   E2E_SUPABASE_URL / E2E_SUPABASE_SECRET_KEY  override the values read from apps/web/.env.local
 */
const DEFAULT_CHROMIUM = "/opt/pw-browsers/chromium";
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (existsSync(DEFAULT_CHROMIUM) ? DEFAULT_CHROMIUM : "");

export default defineConfig({
  testDir: "e2e",
  // Tests share one dev server and one database; run them one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  projects: [
    {
      name: "desktop",
      grepInvert: /@mobile/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "mobile",
      grep: /@mobile/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 }, isMobile: false, hasTouch: false },
    },
  ],
});
