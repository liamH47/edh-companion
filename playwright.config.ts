import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests run against a *running app*, not a dev server this config starts.
 * In CI that app is the production Docker image (see the `docker-e2e` job); locally it
 * is whatever `E2E_BASE_URL` points at -- see e2e/README.md for reproducing the
 * container's serving path without Docker.
 *
 * Deliberately no `webServer` block: the whole point of this suite is to exercise the
 * artifact that actually ships, so the app must be started the same way production
 * starts it rather than by a test-only convenience path.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8080'

export default defineConfig({
  testDir: './e2e',
  // Every spec seeds its own state through the UI or localStorage, so nothing is
  // shared -- but the app persists to localStorage, so a single worker with isolated
  // contexts keeps runs readable when one fails.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL,
    // Traces are the whole value of a failing E2E run; keep them on the first retry.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // This app is phone-first (bottom tab bar, thumb-zone action bars, safe-area
      // padding), so a phone viewport is the primary target rather than an extra.
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
})
