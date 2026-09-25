/**
 * Punto de enfoque: arrastrar la foto para elegir qué parte se ve.
 *
 * El marco del editor tiene la forma del hueco de la página y recorta igual.
 * Se prueba con la primera foto de la galería de Válvulas, que es vertical
 * dentro de una tarjeta apaisada: el recorte al centro le quitaba el
 * actuador, que es lo que la foto quiere enseñar.
 */
import { test, expect, type Page } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';
const FOTO = '[data-cms-entry="service-gallery.valvulas"][data-cms-field="gallery1"]';

let csrf = '';

async function abrirFoto(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  csrf = (await res.json()).csrfToken;
  await page.goto('/servicios/valvulas/?cms=1');
  const foto = page.locator(FOTO);
  await foto.scrollIntoViewIfNeeded();
  await foto.click();
  const marco = page.locator('[data-encuadre-marco].is-movible');
  await expect(marco).toBeVisible();
  // El panel entra deslizándose: medir el marco a mitad de camino haría que
  // el arrastre empezara fuera de él.
  await expect(page.locator('.hm-cms-panel.open')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 0)'
  );
  return { foto, marco };
}

async function arrastrarHaciaAbajo(page: Page, marco: import('@playwright/test').Locator) {
  const caja = (await marco.boundingBox())!;
  const x = caja.x + caja.width / 2;
  const y = caja.y + caja.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x, y + i * 15);
  await page.mouse.up();
}

test.describe('Punto de enfoque', () => {
  test('arrastrar cambia el recorte en el marco y en la página', async ({ page }) => {
    const { foto, marco } = await abrirFoto(page);
    const antes = await foto.evaluate((el) => getComputedStyle(el).objectPosition);

    await arrastrarHaciaAbajo(page, marco);
    // Arrastrar hacia abajo enseña la parte de arriba: el punto sube.
    const y = Number(await page.locator('form[data-edit] [name="focalY"]').inputValue());
    expect(y).toBeLessThan(0.5);
    await expect(page.locator('[data-edit-status]')).toHaveText('Cambios sin guardar.');
    await expect(foto).not.toHaveCSS('object-position', antes);
    const enMarco = await marco.locator('img').evaluate((el) => el.style.objectPosition);
    expect(await foto.evaluate((el) => el.style.objectPosition)).toBe(enMarco);

    // Cerrar sin guardar devuelve la foto de la página a como estaba.
    await page.locator('.hm-cms-panel-head [data-action="close"]').click();
    await page.locator('[data-cms-dialog] [data-dialog-ok]').click();
    await expect(foto).toHaveCSS('object-position', antes);
  });

  test('el encuadre se guarda en la foto y cuenta como cambio pendiente', async ({ page }) => {
    const { marco } = await abrirFoto(page);
    const mediaId = await page.locator('form[data-edit] [name="mediaId"]').inputValue();
    expect(mediaId).not.toBe('');
    const original = await (await page.request.get(`${CMS_URL}/api/cms/media/${mediaId}`)).json();

    try {
      await arrastrarHaciaAbajo(page, marco);
      const y = Number(await page.locator('form[data-edit] [name="focalY"]').inputValue());
      await page.locator('form[data-edit] button[type="submit"]').click();
      await expect(page.locator('[data-edit-status]')).toContainText('Guardado.');

      const guardado = await (await page.request.get(`${CMS_URL}/api/cms/media/${mediaId}`)).json();
      expect(guardado.focalY).toBeCloseTo(y, 2);
      const pendientes = await (
        await page.request.get(`${CMS_URL}/api/cms/publish/pending`)
      ).json();
      expect(pendientes.cambios.map((c: { clave: string }) => c.clave)).toContain('encuadre');
    } finally {
      await page.request.patch(`${CMS_URL}/api/cms/media/${mediaId}`, {
        headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
        data: { focalX: original.focalX, focalY: original.focalY },
      });
    }
  });

  test('también se encuadra con el teclado, y «Centrar» lo deshace', async ({ page }) => {
    const { marco } = await abrirFoto(page);
    const focalY = page.locator('form[data-edit] [name="focalY"]');
    const inicial = Number(await focalY.inputValue());

    await marco.focus();
    await page.keyboard.press('ArrowDown');
    expect(Number(await focalY.inputValue())).toBeCloseTo(Math.max(0, inicial - 0.05), 2);

    await page.getByRole('button', { name: 'Centrar' }).click();
    await expect(focalY).toHaveValue('0.5');
    await expect(page.getByRole('button', { name: 'Centrar' })).toBeDisabled();
  });

  test('una foto que se ve entera, como el logo, no ofrece encuadre', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
    await page.request.post(`${CMS_URL}/api/cms/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    await page.goto('/?cms=1');
    await page.locator('[data-cms-entry="layout.header"][data-cms-type="image"]').first().click();
    await expect(page.locator('form[data-edit]')).toBeVisible();
    await expect(page.locator('[data-encuadre-marco]')).not.toHaveClass(/is-movible/);
    await expect(page.locator('[data-encuadre-ayuda]')).toBeHidden();
  });
});
