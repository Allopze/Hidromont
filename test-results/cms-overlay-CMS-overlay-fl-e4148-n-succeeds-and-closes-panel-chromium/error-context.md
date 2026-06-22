# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cms-overlay.spec.ts >> CMS overlay flow >> overlay login succeeds and closes panel
- Location: e2e/cms-overlay.spec.ts:169:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4321/
Call log:
  - navigating to "http://localhost:4321/", waiting until "load"

```

# Test source

```ts
  50  | 
  51  |   test('proyectos index loads', async ({ page }) => {
  52  |     await page.goto('/proyectos');
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
> 150 |     await page.goto('/');
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4321/
  151 |     await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  152 |   });
  153 | 
  154 |   test('overlay bar appears with ?cms=1', async ({ page }) => {
  155 |     await page.goto('/?cms=1');
  156 |     await expect(page.locator('.hm-cms-bar')).toBeVisible();
  157 |   });
  158 | 
  159 |   test('overlay shows login form when not authenticated', async ({ page }) => {
  160 |     await page.goto('/?cms=1');
  161 |     // Click on any editable element to trigger login
  162 |     const editable = page.locator('[data-cms-entry]').first();
  163 |     if (await editable.count() > 0) {
  164 |       await editable.click({ force: true });
  165 |       await expect(page.locator('form[data-login]')).toBeVisible();
  166 |     }
  167 |   });
  168 | 
  169 |   test('overlay login succeeds and closes panel', async ({ page }) => {
  170 |     await page.goto('/?cms=1');
  171 |     // Open panel with any editable element
  172 |     const editable = page.locator('[data-cms-entry]').first();
  173 |     if (await editable.count() === 0) return;
  174 |     await editable.click({ force: true });
  175 | 
  176 |     // Fill login form
  177 |     const loginForm = page.locator('form[data-login]');
  178 |     if (await loginForm.count() === 0) return; // Already logged in
  179 |     await loginForm.locator('[name="email"]').fill(ADMIN_EMAIL);
  180 |     await loginForm.locator('[name="password"]').fill(ADMIN_PASSWORD);
  181 |     await loginForm.locator('button[type="submit"]').click();
  182 | 
  183 |     // Panel should close after login
  184 |     await expect(page.locator('.hm-cms-panel.open')).not.toBeVisible({ timeout: 3000 });
  185 |   });
  186 | 
  187 |   test('collections panel opens and shows entries', async ({ page }) => {
  188 |     // Login first via API
  189 |     await page.goto('/');
  190 |     const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
  191 |       data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  192 |     });
  193 |     expect(res.ok()).toBeTruthy();
  194 | 
  195 |     await page.goto('/?cms=1');
  196 |     await page.locator('[data-action="collections"]').click();
  197 |     await expect(page.locator('.hm-cms-panel.open')).toBeVisible();
  198 |   });
  199 | });
  200 | 
```