/**
 * P2-20 (auditoría 2026-09): «Volver», «Cancelar» y las pestañas descartaban lo
 * escrito sin preguntar, mientras la X sí preguntaba.
 */
import { test, expect } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

test('«Volver» con cambios sin guardar pregunta antes de salir', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  await page.goto('/?cms=1');
  await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });

  await page.locator('.hm-cms-bar [data-action="collections"]').click();
  const panel = page.locator('.hm-cms-panel.open');
  await panel.locator('.hm-cms-tab[data-action="tab-kind"][data-kind="servicio"]').click();
  await panel.locator('.hm-cms-collection-item [data-action="edit-entry"]').first().click();
  const form = panel.locator('form[data-entry-form]');
  await expect(form).toBeVisible();

  const resumen = form.locator('[name="field:resumen"]');
  await resumen.fill(`${await resumen.inputValue()} (sin guardar)`);

  await panel.locator('[data-action="back-to-collections"]').click();
  const dialogo = page.locator('[data-cms-dialog]');
  await expect(dialogo).toContainText('Tienes cambios sin guardar');
  await dialogo.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(form).toBeVisible();

  await panel.locator('[data-action="back-to-collections"]').click();
  await dialogo.getByRole('button', { name: 'Salir sin guardar' }).click();
  await expect(panel.locator('.hm-cms-collection-list')).toBeVisible();
});
