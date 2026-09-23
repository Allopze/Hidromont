import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const envFile = path.join(rootDir, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile);
}

const CMS_URL = 'http://localhost:8787';
const PAGE_URL = 'http://localhost:4321';
if (process.env.CMS_URL && new URL(process.env.CMS_URL).origin !== CMS_URL) {
  throw new Error('Playwright CMS_URL debe apuntar al CMS local aislado (http://localhost:8787).');
}
if (process.env.E2E_BASE_URL && new URL(process.env.E2E_BASE_URL).origin !== PAGE_URL) {
  throw new Error('Playwright E2E_BASE_URL debe apuntar al sitio local (http://localhost:4321).');
}
process.env.CMS_URL = CMS_URL;
process.env.E2E_BASE_URL = PAGE_URL;
process.env.PUBLIC_CMS_API_BASE = CMS_URL;

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
      url: PAGE_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'node --import tsx scripts/e2e-cms-sandbox.mjs',
      url: `${CMS_URL}/api/cms/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
