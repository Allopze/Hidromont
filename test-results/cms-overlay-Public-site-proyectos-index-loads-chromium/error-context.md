# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cms-overlay.spec.ts >> Public site >> proyectos index loads
- Location: e2e/cms-overlay.spec.ts:51:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4321/proyectos
Call log:
  - navigating to "http://localhost:4321/proyectos", waiting until "load"

```

# Test source

```ts
  1   | /**
  2   |  * E2E tests for the CMS overlay.
  3   |  * Requires:
  4   |  *   1. Astro dev server running: npm run dev (port 4321)
  5   |  *   2. CMS server running:       npm run cms  (port 8787)
  6   |  *
  7   |  * Run with: npx playwright test
  8   |  */
  9   | import { test, expect } from '@playwright/test';
  10  | 
  11  | const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
  12  | const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
  13  | const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';
  14  | 
  15  | // Helper: login via API
  16  | async function apiLogin(page: import('@playwright/test').Page) {
  17  |   const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
  18  |     data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  19  |   });
  20  |   expect(res.ok()).toBeTruthy();
  21  |   return (await res.json()).csrfToken as string;
  22  | }
  23  | 
  24  | test.describe('Public site', () => {
  25  |   test('home page loads', async ({ page }) => {
  26  |     await page.goto('/');
  27  |     await expect(page).toHaveTitle(/Hidromont/i);
  28  |     await expect(page.locator('header').first()).toBeVisible();
  29  |   });
  30  | 
  31  |   test('navigation links work', async ({ page }) => {
  32  |     await page.goto('/');
  33  |     await page.click('a[href="/servicios"]');
  34  |     await expect(page).toHaveURL(/\/servicios/);
  35  |   });
  36  | 
  37  |   test('servicios index loads all cards', async ({ page }) => {
  38  |     await page.goto('/servicios');
  39  |     // At least one service card should be visible. Scope to <main>: the header
  40  |     // nav dropdown also contains /servicios/* links but they start hidden
  41  |     // (visibility:hidden until hover/focus), so .first() must not match those.
  42  |     const cards = page.locator('main [href^="/servicios/"]');
  43  |     await expect(cards.first()).toBeVisible();
  44  |   });
  45  | 
  46  |   test('servicio detail page loads', async ({ page }) => {
  47  |     await page.goto('/servicios/tuberias-forzadas');
  48  |     await expect(page.locator('h1').first()).toBeVisible();
  49  |   });
  50  | 
  51  |   test('proyectos index loads', async ({ page }) => {
> 52  |     await page.goto('/proyectos');
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4321/proyectos
  53  |     await expect(page.locator('h1')).toBeVisible();
  54  |   });
  55  | 
  56  |   test('clientes page shows logos', async ({ page }) => {
  57  |     await page.goto('/clientes');
  58  |     // Should show at least one client logo img
  59  |     const logos = page.locator('img[alt]').filter({ hasNot: page.locator('[alt=""]') });
  60  |     await expect(logos.first()).toBeVisible();
  61  |   });
  62  | 
  63  |   test('contacto page loads', async ({ page }) => {
  64  |     await page.goto('/contacto');
  65  |     await expect(page.locator('form')).toBeVisible();
  66  |   });
  67  | 
  68  |   test('build output has no data-cms-* attributes', async ({ page }) => {
  69  |     // In prod build there should be no cms attributes exposed
  70  |     // This test runs against the dev server — just verify the overlay requires ?cms=1
  71  |     await page.goto('/');
  72  |     const cmsBar = page.locator('.hm-cms-bar');
  73  |     // Without ?cms=1 in URL and no localStorage, overlay should not be visible
  74  |     await expect(cmsBar).not.toBeVisible();
  75  |   });
  76  | });
  77  | 
  78  | test.describe('CMS API', () => {
  79  |   test('health endpoint is reachable', async ({ request }) => {
  80  |     const res = await request.get(`${CMS_URL}/api/cms/health`);
  81  |     expect(res.ok()).toBeTruthy();
  82  |     const body = await res.json();
  83  |     expect(body.ok).toBe(true);
  84  |     expect(body.db).toBe('connected');
  85  |   });
  86  | 
  87  |   test('session endpoint returns unauthenticated without cookie', async ({ request }) => {
  88  |     const res = await request.get(`${CMS_URL}/api/cms/session`);
  89  |     expect(res.ok()).toBeTruthy();
  90  |     expect((await res.json()).authenticated).toBe(false);
  91  |   });
  92  | 
  93  |   test('login with correct credentials', async ({ request }) => {
  94  |     const res = await request.post(`${CMS_URL}/api/cms/login`, {
  95  |       data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  96  |     });
  97  |     expect(res.ok()).toBeTruthy();
  98  |     const body = await res.json();
  99  |     expect(body.ok).toBe(true);
  100 |     expect(typeof body.csrfToken).toBe('string');
  101 |   });
  102 | 
  103 |   test('login fails with wrong password', async ({ request }) => {
  104 |     const res = await request.post(`${CMS_URL}/api/cms/login`, {
  105 |       data: { email: ADMIN_EMAIL, password: 'wrong-password' },
  106 |     });
  107 |     expect(res.status()).toBe(401);
  108 |   });
  109 | 
  110 |   test('entries list requires auth', async ({ request }) => {
  111 |     const res = await request.get(`${CMS_URL}/api/cms/entries`);
  112 |     expect(res.status()).toBe(401);
  113 |   });
  114 | 
  115 |   test('authenticated entries list returns items', async ({ page }) => {
  116 |     await apiLogin(page);
  117 |     const res = await page.request.get(`${CMS_URL}/api/cms/entries`);
  118 |     expect(res.ok()).toBeTruthy();
  119 |     const body = await res.json();
  120 |     expect(Array.isArray(body.entries)).toBe(true);
  121 |     expect(body.entries.length).toBeGreaterThan(0);
  122 |   });
  123 | 
  124 |   test('media list returns items with usageCount', async ({ page }) => {
  125 |     await apiLogin(page);
  126 |     const res = await page.request.get(`${CMS_URL}/api/cms/media`);
  127 |     expect(res.ok()).toBeTruthy();
  128 |     const body = await res.json();
  129 |     expect(Array.isArray(body.items)).toBe(true);
  130 |     // Each item should have usageCount
  131 |     if (body.items.length > 0) {
  132 |       expect(typeof body.items[0].usageCount).toBe('number');
  133 |     }
  134 |   });
  135 | 
  136 |   test('schema endpoint returns field types', async ({ page }) => {
  137 |     await apiLogin(page);
  138 |     const res = await page.request.get(`${CMS_URL}/api/cms/schema`);
  139 |     expect(res.ok()).toBeTruthy();
  140 |     const body = await res.json();
  141 |     expect(Array.isArray(body.fieldTypes)).toBe(true);
  142 |     expect(body.fieldTypes).toContain('image');
  143 |     expect(body.fieldTypes).toContain('richtext');
  144 |   });
  145 | });
  146 | 
  147 | test.describe('CMS overlay flow', () => {
  148 |   test.beforeEach(async ({ page }) => {
  149 |     // Enable overlay via localStorage
  150 |     await page.goto('/');
  151 |     await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  152 |   });
```