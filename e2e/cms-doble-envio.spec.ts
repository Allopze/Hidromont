/**
 * Guarda contra el doble envío.
 *
 * Un inventario del panel dio 4 de 7 formularios y 5 de 11 acciones de
 * escritura con alguna protección, y la que había era un efecto colateral del
 * `disabled` que pone `setButtonLoading`. Las consecuencias medidas:
 *
 *  · `saveEntryForm` manda hasta nueve PATCH en serie, a propósito para que no
 *    se conflictúen entre sí. Nada impedía arrancar una segunda tanda encima.
 *  · El formulario de imagen sube el archivo con `fetch` directo: reenviar
 *    antes de que termine duplicaba la subida.
 *  · Cerrar el panel a media tanda abortaba los PATCH restantes en silencio.
 */
import { test, expect, type Page } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

async function apiLogin(page: Page) {
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

async function abrirPrimerServicio(page: Page) {
  await page.goto('/?cms=1');
  await page.locator('.hm-cms-bar [data-action="collections"]').click();
  const panel = page.locator('.hm-cms-panel.open');
  await expect(panel).toBeVisible();
  await panel.locator('[data-action="edit-entry"]').first().click();
  await expect(panel.locator('[data-entry-form]')).toBeVisible();
  return panel;
}

test.describe('Doble envío', () => {
  test('dos clics seguidos en Guardar producen una sola tanda de PATCH', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);

    const patches: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PATCH' && r.url().includes('/fields/')) patches.push(r.url());
    });

    const guardar = panel.locator('button[type="submit"]');
    // Sin `force` el segundo clic esperaría a que el botón deje de estar
    // deshabilitado, que es justo lo que queremos esquivar para probar la
    // guarda de flujo y no la del botón.
    await guardar.click();
    await guardar.click({ force: true });
    await guardar.click({ force: true });

    await expect(panel.locator('[data-action="edit-entry"]').first()).toBeVisible({
      timeout: 15_000,
    });

    const unicos = new Set(patches);
    expect(
      patches.length,
      `se enviaron ${patches.length} PATCH para ${unicos.size} campos distintos`
    ).toBe(unicos.size);
  });

  test('el guardado informa de su avance campo a campo', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);

    const estados: string[] = [];
    const status = panel.locator('[data-entry-form] [data-status]');
    // Se muestrea mientras guarda: antes el texto era un «Guardando...» fijo
    // durante las nueve peticiones.
    const muestreo = setInterval(async () => {
      const t = await status.textContent().catch(() => null);
      if (t && !estados.includes(t)) estados.push(t);
    }, 60);

    await panel.locator('button[type="submit"]').click();
    await expect(panel.locator('[data-action="edit-entry"]').first()).toBeVisible({
      timeout: 15_000,
    });
    clearInterval(muestreo);

    expect(estados.some((t) => /Guardando campo \d+ de \d+/.test(t))).toBe(true);
  });

  test('los avisos de estado son regiones vivas', async ({ page }) => {
    // Hasta ahora no había NINGUNA región `aria-live` en el overlay, así que
    // todo mensaje de guardado y todo error eran mudos para un lector de
    // pantalla.
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);
    const status = panel.locator('[data-entry-form] [data-status]');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
  });

  test('el panel no se cierra mientras está guardando', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);

    await panel.locator('button[type="submit"]').click();
    // Inmediatamente: la tanda de PATCH sigue viva.
    await panel
      .locator('[data-action="close"]')
      .click({ force: true })
      .catch(() => {});

    // Debe seguir abierto y terminar el trabajo, no cerrarse a medias.
    await expect(panel.locator('[data-action="edit-entry"]').first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
