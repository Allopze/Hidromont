/**
 * Videos de cabecera e iconos de servicio (sep-2026).
 *
 * - Una cabecera con foto ofrece «Poner un video»; el video se sube, se elige
 *   de la biblioteca y se encuadra arrastrándolo, como una foto. La foto queda
 *   de respaldo. El de Limpiarrejas, que estaba fijo en el código, ahora es uno
 *   más.
 * - El icono de una tarjeta de servicio se cambia pulsándolo: uno de los ocho
 *   de la lista o uno propio (SVG o PNG), que el servidor guarda como PNG.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';
// 8,1 MB: más que el tope de las fotos (8 MB), así que prueba también que el
// tope de los videos es otro.
const VIDEO = 'public/videos/limpiarrejas-hero.mp4';

async function iniciarSesion(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

async function abrirConEditor(page: Page, ruta: string) {
  await page.goto(`${ruta}?cms=1`);
  await expect(page.locator('[data-cms-editable-ready]').first()).toBeAttached();
}

async function campo(page: Page, entrada: string, key: string) {
  const res = await page.request.get(`${CMS_URL}/api/cms/entries/${entrada}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).fields[key]?.value;
}

async function restaurar(page: Page, csrf: string, entrada: string, key: string, value: unknown) {
  const res = await page.request.patch(`${CMS_URL}/api/cms/entries/${entrada}/fields/${key}`, {
    headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
    data: { value },
  });
  expect(res.ok()).toBeTruthy();
}

async function guardar(page: Page) {
  const form = page.locator('.hm-cms-panel.open form[data-edit]');
  await form.locator('button[type="submit"]').click();
  await expect(form.locator('[data-edit-status]')).toHaveText(/^Guardado\./, { timeout: 30_000 });
}

test.describe('Video de cabecera', () => {
  test('el de Limpiarrejas se edita y se encuadra como una foto', async ({ page }) => {
    const csrf = await iniciarSesion(page);
    await abrirConEditor(page, '/servicios/limpiarrejas');

    const video = page.locator('video[data-cms-type="video"]');
    // P2-35: el archivo del CMS va en `data-src`; se reproduce la variante que
    // corresponda al ancho.
    await expect(video).toHaveAttribute('data-src', '/videos/limpiarrejas-hero.mp4');
    await expect(video).toHaveAttribute('src', /\/videos\/limpiarrejas-hero(-\d+)?\.mp4$/);
    await video.click();

    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel.locator('form[data-edit]')).toHaveAttribute('data-field', 'video');
    await expect(panel.locator('[data-action="quitar-video"]')).toBeVisible();
    await expect(panel.locator('[data-action="editar-respaldo"]')).toBeVisible();
    // La biblioteca ofrece videos, no fotos.
    await expect(panel.locator('[data-media-grid] video').first()).toBeAttached();
    await expect(panel.locator('[data-media-grid] img')).toHaveCount(0);

    // El marco copia la forma de la cabecera y el video se arrastra dentro.
    const marco = panel.locator('[data-encuadre-marco].is-movible');
    await expect(marco).toBeVisible({ timeout: 15_000 });
    // El panel entra deslizándose: se espera a que esté entero en pantalla.
    await page.waitForFunction(() => {
      const abierto = document.querySelector('.hm-cms-panel.open');
      return abierto && abierto.getBoundingClientRect().right <= window.innerWidth + 1;
    });
    const caja = (await marco.boundingBox())!;
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await page.mouse.down();
    await page.mouse.move(caja.x + caja.width / 2 + 60, caja.y + caja.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(video).toHaveAttribute('style', /object-position/);
    await guardar(page);

    const media = await (
      await page.request.get(`${CMS_URL}/api/cms/media?tipo=video&q=limpiarrejas-hero`)
    ).json();
    const asset = media.items.find(
      (m: { path: string }) => m.path === '/videos/limpiarrejas-hero.mp4'
    );
    expect(asset.focalX).not.toBe(0.5);
    await page.request.patch(`${CMS_URL}/api/cms/media/${asset.id}`, {
      headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
      data: { focalX: 0.5, focalY: 0.5 },
    });
  });

  test('una cabecera con foto pasa a tener un video subido', async ({ page }) => {
    const csrf = await iniciarSesion(page);
    await abrirConEditor(page, '/servicios/compuertas');

    await page.locator('img[data-cms-video-field="video"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('[data-action="poner-video"]').click();
    await expect(panel.locator('form[data-edit]')).toHaveAttribute('data-field', 'video');
    const provisional = page.locator('video[data-cms-provisional]');
    await expect(provisional).toBeAttached();

    await panel.locator('input[type="file"]').setInputFiles(VIDEO);
    await guardar(page);

    const guardado = String(await campo(page, 'service-image.compuertas', 'video'));
    expect(guardado).toMatch(/^\/uploads\/cms\/.+\.mp4$/);
    // Guardado: deja de ser provisional y sigue en la página.
    await expect(page.locator('video[data-cms-field="video"]')).toHaveAttribute('src', guardado);
    await expect(page.locator('video[data-cms-provisional]')).toHaveCount(0);

    await restaurar(page, csrf, 'service-image.compuertas', 'video', '');
  });

  test('«Poner un video» sin guardar deja la foto como estaba', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/servicios/compuertas');
    const foto = page.locator('img[data-cms-video-field="video"]');
    await foto.click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('[data-action="poner-video"]').click();
    await expect(page.locator('video[data-cms-provisional]')).toBeAttached();

    await panel.locator('[data-action="close"]').click();
    await expect(page.locator('video[data-cms-provisional]')).toHaveCount(0);
    await expect(foto).toBeVisible();
  });
});

test.describe('Iconos de servicio', () => {
  test('se elige otro de la lista pulsando el icono de la tarjeta', async ({ page }) => {
    const csrf = await iniciarSesion(page);
    const original = await campo(page, 'servicios.compuertas', 'icono');
    await abrirConEditor(page, '/');

    const icono = page.locator('[data-cms-type="icono"][data-cms-entry="servicios.compuertas"]');
    await icono.click();
    const panel = page.locator('.hm-cms-panel.open');
    const opciones = panel.locator('[data-action="elegir-icono"]');
    await expect(opciones).toHaveCount(8);
    await expect(panel.locator(`[data-icono="${original}"]`)).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await panel.locator('[data-icono="valve"]').click();
    await guardar(page);
    expect(await campo(page, 'servicios.compuertas', 'icono')).toBe('valve');
    await expect(icono.locator('svg')).toBeAttached();

    await restaurar(page, csrf, 'servicios.compuertas', 'icono', original);
  });

  test('se sube uno propio en SVG y se guarda como PNG', async ({ page }) => {
    const csrf = await iniciarSesion(page);
    await abrirConEditor(page, '/servicios');

    const svg = path.join(os.tmpdir(), `icono-e2e-${Date.now()}.svg`);
    fs.writeFileSync(
      svg,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>'
    );
    const icono = page.locator('[data-cms-type="icono"][data-cms-entry="servicios.turbinas"]');
    await icono.click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('input[type="file"]').setInputFiles(svg);
    // Al elegirlo ya se ve en la tarjeta, y ninguno de la lista queda marcado.
    await expect(icono.locator('.icono-propio')).toBeAttached();
    await expect(panel.locator('[aria-checked="true"]')).toHaveCount(0);
    await guardar(page);

    const propio = String(await campo(page, 'servicios.turbinas', 'iconoPropio'));
    expect(propio).toMatch(/^\/uploads\/cms\/.+\.png$/);

    await restaurar(page, csrf, 'servicios.turbinas', 'iconoPropio', '');
    fs.rmSync(svg, { force: true });
  });
});
