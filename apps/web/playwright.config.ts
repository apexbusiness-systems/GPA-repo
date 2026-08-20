import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for GamePointAgent web user-shoes E2E tests.
 *
 * The suite tests the *built* app served via `vite preview` so it exercises
 * the same bundle that Cloudflare Workers Builds produces.
 *
 * Environment variables (optional — tests accept auth-not-configured gate when absent):
 *   VITE_SUPABASE_URL            — baked into the Vite build
 *   VITE_SUPABASE_PUBLISHABLE_KEY — baked into the Vite build
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Capped locally too (not just in CI): two projects now run against one
  // shared `vite preview` server, and unconstrained parallelism (Playwright's
  // default of half the CPU cores) was flaky under that combined load on
  // typical dev hardware even though every test passes at workers: 2.
  workers: process.env.CI ? 1 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  // Start `vite preview` before running tests. The dist/ directory must exist
  // (built by the `browser-e2e` CI job step that precedes this one).
  webServer: {
    command: 'pnpm preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/mobile-sidebar.spec.ts'],
    },
    {
      // Plain viewport override on desktop Chrome rather than a full device
      // profile (e.g. devices['iPhone 13']) — this is testing a CSS breakpoint,
      // not touch/UA-dependent behavior, so keep the blast radius to viewport size.
      name: 'mobile-nav',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
      testMatch: ['**/mobile-sidebar.spec.ts'],
    },
  ],
});
