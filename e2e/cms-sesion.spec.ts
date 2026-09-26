/**
 * P2-04, P2-16 y P2-18 (auditoría 2026-09): acceso, sesión caducada y errores.
 */
import { test, expect } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
});

test('sin sesión siempre hay un botón para entrar, también tras cerrar el acceso', async ({
  page,
}) => {
  await page.goto('/?cms=1');
  await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
  const entrar = page.locator('.hm-cms-bar [data-action="abrir-acceso"]');
  await expect(entrar).toBeVisible();
  await entrar.click();
  await expect(page.locator('form[data-login]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.hm-cms-panel.open')).toHaveCount(0);
  await expect(entrar).toBeVisible();
});

test('al entrar, el formulario de acceso desaparece y el botón «Entrar» también', async ({
  page,
}) => {
  await page.goto('/?cms=1');
  await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
  await page.locator('.hm-cms-bar [data-action="abrir-acceso"]').click();
  const form = page.locator('form[data-login]');
  await form.locator('input[name="email"]').fill(ADMIN_EMAIL);
  await form.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('.hm-cms-bar [data-action="collections"]')).toBeVisible();
  await expect(page.locator('form[data-login]')).toHaveCount(0);
  await expect(page.locator('.hm-cms-bar [data-action="abrir-acceso"]')).toBeHidden();
});

test.describe('con sesión', () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    await page.goto('/?cms=1');
    await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
    await expect(page.locator('.hm-cms-bar [data-action="collections"]')).toBeVisible();
  });

  test('un error del servidor al abrir un campo no se muestra como pantalla de acceso', async ({
    page,
  }) => {
    await page.route('**/api/cms/entries/home.hero', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Fallo"}' })
    );
    await page.locator('[data-cms-entry="home.hero"][data-cms-field="title"]').first().click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toContainText('No se pudo abrir este elemento');
    await expect(page.locator('form[data-login]')).toHaveCount(0);
  });

  test('sin conexión el mensaje está en español', async ({ page }) => {
    await page.route('**/api/cms/entries/home.hero', (route) =>
      route.abort('internetdisconnected')
    );
    await page.locator('[data-cms-entry="home.hero"][data-cms-field="title"]').first().click();
    await expect(page.locator('.hm-cms-panel.open')).toContainText('No se pudo conectar');
    await expect(page.locator('.hm-cms-panel.open')).not.toContainText('Failed to fetch');
  });

  test('P3-01: «Cerrar las demás sesiones» cierra la de otro equipo y conserva esta', async ({
    page,
    browser,
  }) => {
    // Otra sesión, como si fuera otro equipo.
    const otro = await browser.newContext();
    const res = await otro.request.post(`${CMS_URL}/api/cms/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();

    await page.locator('.hm-cms-bar-more > button').click();
    await page.locator('.hm-cms-bar [data-action="admin"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.getByRole('button', { name: 'Cerrar las demás sesiones' }).click();
    await expect(panel.locator('[data-sesiones-estado]')).toContainText(/Listo|No había/);

    const sesionDelOtro = await (await otro.request.get(`${CMS_URL}/api/cms/session`)).json();
    expect(sesionDelOtro.authenticated).toBe(false);
    // Esta sigue abierta.
    await expect(page.locator('.hm-cms-bar [data-action="collections"]')).toBeVisible();
    await otro.close();
  });

  test('si la sesión caduca al guardar, ofrece entrar de nuevo', async ({ page, context }) => {
    await page.locator('[data-cms-entry="home.hero"][data-cms-field="title"]').first().click();
    const form = page.locator('form[data-edit]');
    await expect(form).toBeVisible();
    await context.clearCookies();
    await form.locator('[name="value"]').first().fill('Título de prueba de sesión');
    await form.locator('button[type="submit"]').click();
    await expect(form).toContainText('Tu sesión terminó');
    await expect(form.locator('[data-action="abrir-acceso"]')).toBeVisible();
  });
});
