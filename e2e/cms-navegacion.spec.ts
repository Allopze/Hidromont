/**
 * P1-07 y P1-08 (auditoría 2026-09).
 *
 * En modo edición el menú, las tarjetas y los botones abren el editor en vez de
 * navegar, y no había otra forma de cambiar de página que escribir la
 * dirección. Y entre 641 y ~1.070 px la barra se salía de la pantalla, así que
 * en una tablet «Publicar cambios» y «Más» no se podían pulsar.
 */
import { test, expect } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

async function entrar(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  await page.goto('/?cms=1');
  await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
}

test.describe('Navegar con el editor abierto', () => {
  test('«Ir a otra página» lleva a cualquier página del sitio sin escribir la dirección', async ({
    page,
  }) => {
    await entrar(page);
    await page.locator('.hm-cms-bar-more > button').click();
    await page.locator('.hm-cms-bar [data-action="pages"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('.hm-cms-page-link', { hasText: 'Empresa' }).click();
    await expect(page).toHaveURL(/\/empresa\/?$/);
  });

  test('el editor de un enlace ofrece ir a su destino', async ({ page }) => {
    await entrar(page);
    // Una entrada del menú: pulsarla abre el editor de su texto.
    await page.locator('header nav a[href="/proyectos"] [data-cms-entry]').first().click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel.locator('form[data-edit]')).toBeVisible();
    await panel.getByRole('link', { name: 'Ir a esta página →' }).click();
    await expect(page).toHaveURL(/\/proyectos\/?$/);
  });
});

test.describe('Barra del editor en tablet', () => {
  for (const [width, height] of [
    [768, 1024],
    [800, 1280],
    [1024, 768],
  ]) {
    test(`a ${width} px se llega a «Publicar cambios»`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await entrar(page);
      await page.getByRole('button', { name: 'Editar sitio: abrir el menú' }).click();
      const menu = page.locator('#hm-cms-mobile-sheet');
      const publicar = menu.getByRole('button', { name: 'Publicar cambios' });
      await expect(publicar).toBeVisible();
      const caja = await publicar.boundingBox();
      expect(caja && caja.x + caja.width).toBeLessThanOrEqual(width);
      // La barra de escritorio no asoma cortada por detrás.
      await expect(page.locator('.hm-cms-bar')).toBeHidden();
    });
  }
});
