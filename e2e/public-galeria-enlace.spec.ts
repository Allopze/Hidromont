/**
 * P2-33 (auditoría 2026-09): abrir /galeria/?foto=30 mostraba «1 / 24» y otra
 * foto, porque el visor leía los datos antes de que la página los rellenara.
 */
import { test, expect } from '@playwright/test';

test('el enlace de una foto lejana abre esa foto, con el total real', async ({ page, context }) => {
  await page.goto('/galeria/');
  await page.locator('.gallery-card').nth(2).click();
  const contador = page.locator('[data-lb-counter]');
  await expect(contador).toContainText('3 /');
  for (let i = 0; i < 27; i++) await page.keyboard.press('ArrowRight');
  await expect(contador).toContainText('30 /');
  const texto = (await contador.innerText()).trim();
  const url = page.url();
  expect(new URL(url).searchParams.get('foto')).not.toBe('30');
  const imagen = page.locator('[data-lb-img]');
  await expect(imagen).not.toHaveAttribute('alt', '');
  const alt = await imagen.getAttribute('alt');

  const otra = await context.newPage();
  await otra.goto(url);
  await expect(otra.locator('#lightbox')).toBeVisible();
  await expect(otra.locator('[data-lb-counter]')).toHaveText(texto);
  await expect(otra.locator('[data-lb-img]')).toHaveAttribute('alt', alt ?? '');
  expect(otra.url()).toBe(url);
});

test('una foto que no existe no abre el visor ni cambia la dirección', async ({ page }) => {
  await page.goto('/galeria/?foto=no-existe');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#lightbox')).toBeHidden();
  expect(new URL(page.url()).searchParams.get('foto')).toBe('no-existe');
});
