/**
 * P2-34 (auditoría 2026-09): las páginas de servicio no enlazaban a sus obras
 * y el botón abría /proyectos/ sin filtrar.
 */
import { test, expect } from '@playwright/test';

test('Tanques Especiales enlaza a sus obras con ficha', async ({ page }) => {
  await page.goto('/servicios/tanques-especiales/');
  const bloque = page.locator('[data-proyectos-del-servicio]');
  await expect(bloque).toBeVisible();
  const enlaces = await bloque
    .locator('a[href^="/proyectos/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(enlaces.some((h) => h?.includes('tanques-glp'))).toBe(true);
});

test('«Ver proyectos» abre el listado filtrado por la categoría del servicio', async ({ page }) => {
  await page.goto('/servicios/compuertas/');
  const boton = page.getByRole('link', { name: /Ver proyectos/ });
  await expect(boton).toHaveAttribute('href', /\/proyectos\/\?cat=compuertas/);
  await boton.click();
  await expect(page.locator('[data-filter="compuertas"]')).toHaveAttribute('aria-checked', 'true');
});

test('P3-13: las fotos de la galería de una ficha se amplían en el visor', async ({ page }) => {
  await page.goto('/proyectos/ch-queltehues/');
  const foto = page.locator('.aspect-video[data-visor]').first();
  await expect(foto).toBeVisible();
  await foto.click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect(page.locator('[data-lb-counter]')).toContainText('1 /');
  await page.keyboard.press('Escape');
  await expect(page.locator('#lightbox')).toBeHidden();
  // Y con el teclado.
  await foto.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#lightbox')).toBeVisible();
});
