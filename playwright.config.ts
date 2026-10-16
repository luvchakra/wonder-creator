import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite for Wonder Creator.
 *
 * The app server is NOT started here (no `webServer`). On your machine, `npm run e2e:local -- <spec files>` builds the app
 * against the local Supabase stack, starts it and runs the specs (docs/testing.md). The nightly workflow does the same in
 * parts (.github/workflows/e2e-nightly.yml). Global setup refuses anything but a local app and database, and clears
 * throwaway data earlier runs left behind (e2e/global-setup.ts).
 *
 * Env:
 *   E2E_BASE_URL              app origin (default http://localhost:3000)
 *   PLAYWRIGHT_CHROMIUM_PATH  Chromium binary; unset → /opt/pw-browsers/chromium when present,
 *                             empty string → Playwright's own installed browser (CI).
 *   E2E_SUPABASE_URL / E2E_SUPABASE_SECRET_KEY  override the values read from apps/web/.env.local
 *   E2E_BUDGET_MINUTES        a time budget for the whole run: when it's spent, the run stops cleanly — what didn't start
 *                             is reported as not run, the reports are still written (nightly parts set it)
 *   E2E_JSON_REPORT           also write a JSON report here (the nightly summary reads it)
 */
const DEFAULT_CHROMIUM = "/opt/pw-browsers/chromium";
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (existsSync(DEFAULT_CHROMIUM) ? DEFAULT_CHROMIUM : "");

const budgetMinutes = Number(process.env.E2E_BUDGET_MINUTES || 0);

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTimeout: budgetMinutes > 0 ? budgetMinutes * 60_000 : 0,
  // Tests share one dev server and one database; run them one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // One retry on CI; a test that passes only on retry is reported as flaky (scripts/e2e/summary.mjs) and needs a root cause.
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }], ...(process.env.E2E_JSON_REPORT ? [["json", { outputFile: process.env.E2E_JSON_REPORT }] as ["json", { outputFile: string }]] : [])],
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
