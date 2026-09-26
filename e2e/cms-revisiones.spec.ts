/**
 * P2-26 (auditoría 2026-09): «Revisiones» era a ciegas —número y fecha— y,
 * abierta desde un campo, «Restaurar» devolvía la ficha entera.
 */
import { test, expect, type Page } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

async function entrar(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

test('desde un campo se ve cada valor y se restaura solo ese campo', async ({ page }) => {
  const csrf = await entrar(page);
  const entrada = await (await page.request.get(`${CMS_URL}/api/cms/entries/home.hero`)).json();
  const claves = Object.keys(entrada.fields).filter(
    (k) => typeof entrada.fields[k].value === 'string' && entrada.fields[k].type === 'text'
  );
  const [campo, otro] = [
    claves.find((k) => k === 'title') ?? claves[0],
    claves.find((k) => k !== 'title')!,
  ];
  const original = entrada.fields[campo].value as string;
  const originalOtro = entrada.fields[otro].value as string;
  const escribir = (key: string, value: string) =>
    page.request.patch(`${CMS_URL}/api/cms/entries/home.hero/fields/${key}`, {
      headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
      data: { value },
    });

  try {
    expect((await escribir(campo, 'Título intermedio e2e')).ok()).toBeTruthy();
    expect((await escribir(otro, `${originalOtro} (cambiado)`)).ok()).toBeTruthy();

    await page.goto('/?cms=1');
    await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
    await page.locator(`[data-cms-entry="home.hero"][data-cms-field="${campo}"]`).first().click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.getByRole('button', { name: 'Revisiones' }).click();

    const anterior = panel.locator('.hm-cms-revision-item', { hasText: original }).first();
    await expect(anterior).toBeVisible();
    await expect(panel.locator('.hm-cms-revision-item.current')).toContainText(
      'Título intermedio e2e'
    );
    await expect(panel).not.toContainText(/\d{2}-\d{2}-\d{2},/);

    await anterior.getByRole('button', { name: 'Restaurar este valor' }).click();
    await page.locator('[data-cms-dialog]').getByRole('button', { name: 'Restaurar' }).click();
    await expect(panel.locator('.hm-cms-revision-item.current')).toContainText(original);

    const despues = await (await page.request.get(`${CMS_URL}/api/cms/entries/home.hero`)).json();
    expect(despues.fields[campo].value).toBe(original);
    expect(despues.fields[otro].value).toBe(`${originalOtro} (cambiado)`);

    await panel.locator('[data-action="back-to-editor"]').click();
    await expect(panel.locator('form[data-edit]')).toBeVisible();
  } finally {
    await escribir(campo, original);
    await escribir(otro, originalOtro);
  }
});

test('desde una ficha, «Volver» regresa a la ficha', async ({ page }) => {
  await entrar(page);
  await page.goto('/?cms=1');
  await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
  await page.locator('.hm-cms-bar [data-action="collections"]').click();
  const panel = page.locator('.hm-cms-panel.open');
  await panel.locator('.hm-cms-tab[data-action="tab-kind"][data-kind="servicio"]').click();
  await panel.locator('.hm-cms-collection-item [data-action="edit-entry"]').first().click();
  await expect(panel.locator('form[data-entry-form]')).toBeVisible();
  await panel.getByRole('button', { name: 'Revisiones' }).click();
  await expect(panel.locator('[data-action="back-to-editor"]')).toBeVisible();
  await panel.locator('[data-action="back-to-editor"]').click();
  await expect(panel.locator('form[data-entry-form]')).toBeVisible();
});
