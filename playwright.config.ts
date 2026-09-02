import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4321',
      url: 'http://127.0.0.1:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run cms',
      url: 'http://127.0.0.1:8787/api/cms/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
