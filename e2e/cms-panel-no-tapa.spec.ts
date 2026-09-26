/**
 * P2-21 (auditoría 2026-09): el panel tapaba lo que se editaba en la mitad
 * derecha de la página y, con una ficha abierta, cortaba «Publicar cambios».
 */
import { test, expect } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  await page.goto('/?cms=1');
  await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
});

test('el botón de la cabecera queda a la vista mientras se edita', async ({ page }) => {
  const cta = page
    .locator('header [data-cms-entry="layout.header"][data-cms-field="ctaLabel"]')
    .first();
  await cta.click();
  const panel = page.locator('.hm-cms-panel.open');
  await expect(panel.locator('form[data-edit]')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/hm-cms-con-panel/);
  const cajaPanel = (await panel.boundingBox())!;
  const cajaCta = (await cta.boundingBox())!;
  expect(cajaCta.x + cajaCta.width).toBeLessThanOrEqual(cajaPanel.x);

  await panel
    .getByRole('button', { name: /Cerrar/ })
    .first()
    .click();
  await expect(page.locator('html')).not.toHaveClass(/hm-cms-con-panel/);
});

test('con una ficha abierta «Publicar cambios» no queda debajo del panel', async ({ page }) => {
  await page.locator('.hm-cms-bar [data-action="collections"]').click();
  const panel = page.locator('.hm-cms-panel.open');
  await panel.locator('.hm-cms-tab[data-action="tab-kind"][data-kind="servicio"]').click();
  await panel.locator('.hm-cms-collection-item [data-action="edit-entry"]').first().click();
  await expect(panel.locator('form[data-entry-form]')).toBeVisible();
  const cajaPanel = (await panel.boundingBox())!;
  const publicar = page.locator('.hm-cms-bar').getByRole('button', { name: 'Publicar cambios' });
  await expect(publicar).toBeVisible();
  const caja = (await publicar.boundingBox())!;
  expect(caja.x + caja.width).toBeLessThanOrEqual(cajaPanel.x);
});
