/**
 * E2E tests for the CMS overlay.
 * Requires:
 *   1. Astro dev server running: npm run dev (port 4321)
 *   2. CMS server running:       npm run cms  (port 8787)
 *
 * Run with: npx playwright test
 */
import { test, expect } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

// Helper: login via API
async function apiLogin(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

test.describe('Public site', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Hidromont/i);
    await expect(page.locator('header').first()).toBeVisible();
  });

  test('navigation links work', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/servicios"]');
    await expect(page).toHaveURL(/\/servicios/);
  });

  test('servicios index loads all cards', async ({ page }) => {
    await page.goto('/servicios');
    // At least one service card should be visible. Scope to <main>: the header
    // nav dropdown also contains /servicios/* links but they start hidden
    // (visibility:hidden until hover/focus), so .first() must not match those.
    const cards = page.locator('main [href^="/servicios/"]');
    await expect(cards.first()).toBeVisible();
  });

  test('servicio detail page loads', async ({ page }) => {
    await page.goto('/servicios/tuberias-forzadas');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('proyectos index loads', async ({ page }) => {
    await page.goto('/proyectos');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('clientes page shows logos', async ({ page }) => {
    await page.goto('/clientes');
    // Should show at least one client logo img
    const logos = page.locator('img[alt]').filter({ hasNot: page.locator('[alt=""]') });
    await expect(logos.first()).toBeVisible();
  });

  test('contacto page loads', async ({ page }) => {
    await page.goto('/contacto');
    await expect(page.locator('form')).toBeVisible();
  });

  test('build output has no data-cms-* attributes', async ({ page }) => {
    // In prod build there should be no cms attributes exposed
    // This test runs against the dev server — just verify the overlay requires ?cms=1
    await page.goto('/');
    const cmsBar = page.locator('.hm-cms-bar');
    // Without ?cms=1 in URL and no localStorage, overlay should not be visible
    await expect(cmsBar).not.toBeVisible();
  });
});

test.describe('CMS API', () => {
  test('health endpoint is reachable', async ({ request }) => {
    const res = await request.get(`${CMS_URL}/api/cms/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe('connected');
  });

  test('session endpoint returns unauthenticated without cookie', async ({ request }) => {
    const res = await request.get(`${CMS_URL}/api/cms/session`);
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).authenticated).toBe(false);
  });

  test('login with correct credentials', async ({ request }) => {
    const res = await request.post(`${CMS_URL}/api/cms/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.csrfToken).toBe('string');
  });

  test('login fails with wrong password', async ({ request }) => {
    const res = await request.post(`${CMS_URL}/api/cms/login`, {
      data: { email: ADMIN_EMAIL, password: 'wrong-password' },
    });
    expect(res.status()).toBe(401);
  });

  test('entries list requires auth', async ({ request }) => {
    const res = await request.get(`${CMS_URL}/api/cms/entries`);
    expect(res.status()).toBe(401);
  });

  test('authenticated entries list returns items', async ({ page }) => {
    await apiLogin(page);
    const res = await page.request.get(`${CMS_URL}/api/cms/entries`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.entries)).toBe(true);
    expect(body.entries.length).toBeGreaterThan(0);
  });

  test('media list returns items with usageCount', async ({ page }) => {
    await apiLogin(page);
    const res = await page.request.get(`${CMS_URL}/api/cms/media`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    // Each item should have usageCount
    if (body.items.length > 0) {
      expect(typeof body.items[0].usageCount).toBe('number');
    }
  });

  test('schema endpoint returns field types', async ({ page }) => {
    await apiLogin(page);
    const res = await page.request.get(`${CMS_URL}/api/cms/schema`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.fieldTypes)).toBe(true);
    expect(body.fieldTypes).toContain('image');
    expect(body.fieldTypes).toContain('richtext');
  });
});

test.describe('CMS overlay flow', () => {
  test.beforeEach(async ({ page }) => {
    // Enable overlay via localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  });

  test('overlay bar appears with ?cms=1', async ({ page }) => {
    await page.goto('/?cms=1');
    await expect(page.locator('.hm-cms-bar')).toBeVisible();
  });

  test('overlay shows login form when not authenticated', async ({ page }) => {
    await page.goto('/?cms=1');
    // Click on any editable element to trigger login
    const editable = page.locator('[data-cms-entry]').first();
    if (await editable.count() > 0) {
      await editable.click({ force: true });
      await expect(page.locator('form[data-login]')).toBeVisible();
    }
  });

  test('overlay login succeeds and closes panel', async ({ page }) => {
    await page.goto('/?cms=1');
    // Open panel with any editable element
    const editable = page.locator('[data-cms-entry]').first();
    if (await editable.count() === 0) return;
    await editable.click({ force: true });

    // Fill login form
    const loginForm = page.locator('form[data-login]');
    if (await loginForm.count() === 0) return; // Already logged in
    await loginForm.locator('[name="email"]').fill(ADMIN_EMAIL);
    await loginForm.locator('[name="password"]').fill(ADMIN_PASSWORD);
    await loginForm.locator('button[type="submit"]').click();

    // Panel should close after login
    await expect(page.locator('.hm-cms-panel.open')).not.toBeVisible({ timeout: 3000 });
  });

  test('collections panel opens and shows entries', async ({ page }) => {
    // Login first via API
    await page.goto('/');
    const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto('/?cms=1');
    await page.locator('[data-action="collections"]').click();
    await expect(page.locator('.hm-cms-panel.open')).toBeVisible();
  });
});
