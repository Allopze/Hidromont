/**
 * P3-11 (auditoría 2026-09): accesibilidad menor del CMS.
 */
import { test, expect, type Page } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

async function entrar(page: Page, ruta = '/?cms=1') {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  await page.goto(ruta);
  await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
}

test('la pestaña activa de Colecciones se anuncia', async ({ page }) => {
  await entrar(page);
  await page.locator('.hm-cms-bar [data-action="collections"]').click();
  const panel = page.locator('.hm-cms-panel.open');
  await panel.locator('.hm-cms-tab[data-kind="proyecto"]').click();
  await expect(panel.locator('.hm-cms-tab[data-kind="proyecto"]')).toHaveAttribute(
    'aria-current',
    'true'
  );
  await expect(panel.locator('.hm-cms-tab[aria-current]')).toHaveCount(1);
});

test('al abrir un texto, el cursor queda al final', async ({ page }) => {
  await entrar(page);
  await page.locator('[data-cms-entry="home.hero"][data-cms-field="title"]').first().click();
  const campo = page.locator('.hm-cms-panel.open form[data-edit] [name="value"]').first();
  await expect(campo).toBeFocused();
  const [inicio, largo] = await campo.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => [
    el.selectionStart,
    el.value.length,
  ]);
  expect(inicio).toBe(largo);
});

test('el marco de encuadre es un grupo con nombre', async ({ page }) => {
  await entrar(page, '/servicios/compuertas/?cms=1');
  await page.locator('[data-cms-type="image"][data-cms-field="image"]').first().click();
  await expect(page.locator('[data-encuadre-marco]')).toHaveAttribute('role', 'group');
});

test('el selector de iconos se recorre con flechas', async ({ page }) => {
  await entrar(page, '/?cms=1');
  const icono = page.locator('[data-cms-type="icono"]').first();
  test.skip((await icono.count()) === 0, 'la portada no tiene iconos editables');
  await icono.click();
  const grupo = page.locator('[data-iconos]');
  await expect(grupo.locator('[tabindex="0"]')).toHaveCount(1);
  const primero = grupo.locator('[tabindex="0"]');
  await primero.focus();
  const antes = await primero.getAttribute('data-icono');
  await page.keyboard.press('ArrowRight');
  const ahora = grupo.locator('[aria-checked="true"]');
  await expect(ahora).toBeFocused();
  expect(await ahora.getAttribute('data-icono')).not.toBe(antes);
});

test('los identificadores de la galería aceptan guiones sin error de patrón', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /pattern/i.test(m.text())) errores.push(m.text());
  });
  await entrar(page);
  await page.locator('.hm-cms-bar [data-action="gallery"]').click();
  const panel = page.locator('.hm-cms-panel.open');
  await panel.locator('.hm-cms-tab[data-action="gallery-cats"]').click();
  await panel.locator('[data-action="gallery-new-cat"]').click();
  const slug = panel.locator('input[name="slug"]');
  const invalido = await slug.evaluate((el: HTMLInputElement) => {
    el.value = 'con-guion';
    return el.validity.patternMismatch;
  });
  expect(invalido).toBe(false);
  expect(errores).toEqual([]);
});
