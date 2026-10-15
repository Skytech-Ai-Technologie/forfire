import { defineConfig, devices } from '@playwright/test'

const host = '127.0.0.1'
const port = 4173

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://${host}:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // GitHub Actions installs Playwright's Chromium. Locally, use the
        // installed Chrome so the suite does not depend on a separate download.
        ...(process.env.CI ? {} : { channel: 'chrome' as const }),
      },
    },
  ],
  webServer: {
    command: `npm run preview -- --host ${host} --port ${port} --strictPort`,
    url: `http://${host}:${port}/forfire/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
