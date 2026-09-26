/**
 * P2-17 (auditoría 2026-09): al recargar, la página debe mostrar lo guardado y
 * aún sin publicar, marcado, en vez de volver en silencio a lo publicado.
 */
import { test, expect } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

test('un texto guardado se ve en la página al recargar, marcado como sin publicar', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const login = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const csrf = (await login.json()).csrfToken as string;
  const entrada = await (await page.request.get(`${CMS_URL}/api/cms/entries/home.hero`)).json();
  const original = entrada.fields.subtitle.value as string;
  const nuevo = `${original} (guardado sin publicar)`;
  const res = await page.request.patch(`${CMS_URL}/api/cms/entries/home.hero/fields/subtitle`, {
    headers: { 'x-csrf-token': csrf },
    data: { value: nuevo, expectedVersion: entrada.version },
  });
  expect(res.ok()).toBeTruthy();

  try {
    await page.goto('/?cms=1');
    await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
    const subtitulo = page
      .locator('[data-cms-entry="home.hero"][data-cms-field="subtitle"]')
      .first();
    await expect(subtitulo).toHaveText(nuevo);
    await expect(subtitulo).toHaveClass(/hm-cms-sin-publicar/);
  } finally {
    const actual = await (await page.request.get(`${CMS_URL}/api/cms/entries/home.hero`)).json();
    await page.request.patch(`${CMS_URL}/api/cms/entries/home.hero/fields/subtitle`, {
      headers: { 'x-csrf-token': csrf },
      data: { value: original, expectedVersion: actual.version },
    });
  }
});
