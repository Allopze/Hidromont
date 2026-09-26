/**
 * P3-10 (auditoría 2026-09): accesibilidad menor del sitio.
 */
import { test, expect } from '@playwright/test';

test('en escritorio, los títulos del pie no son controles', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const titulos = page.locator('footer summary');
  expect(await titulos.count()).toBeGreaterThan(0);
  for (const t of await titulos.all()) await expect(t).toHaveAttribute('tabindex', '-1');
  // Pulsarlo (o Intro sobre él) ya no pliega la columna.
  await titulos.first().evaluate((el) => (el as HTMLElement).click());
  await expect(page.locator('footer details').first()).toHaveAttribute('open', '');
});

test('los textos de ejemplo de los campos llegan a 4,5:1', async ({ page }) => {
  await page.goto('/contacto/');
  const color = await page
    .locator('#nombre')
    .evaluate((el) => getComputedStyle(el, '::placeholder').color);
  expect(color).toBe('rgb(91, 103, 112)');
});

test('con el visor abierto, el pie tampoco se alcanza', async ({ page }) => {
  await page.goto('/galeria/');
  await page.locator('.gallery-card').first().click();
  await expect(page.locator('#lightbox')).toBeVisible();
  await expect(page.locator('footer')).toHaveAttribute('inert', '');
});

test('el menú de categorías de la galería es una sola parada y se cierra al salir', async ({
  page,
}) => {
  await page.goto('/galeria/');
  const menu = page.locator('#filter-menu');
  expect(await menu.locator('[role="option"][tabindex="0"]').count()).toBe(1);
  await page.locator('[aria-controls="filter-menu"]').first().click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(menu).toBeHidden();
});

test('los filtros de /proyectos son un grupo con nombre y el recuento concuerda', async ({
  page,
}) => {
  await page.goto('/proyectos/');
  await expect(
    page.locator('[role="radiogroup"][aria-label="Filtrar proyectos por categoría"]')
  ).toHaveCount(1);
  await expect(page.locator('nav#project-filter-container')).toHaveCount(0);
  await page.locator('#project-search').fill('ralco');
  await expect(page.locator('#project-results-count')).toHaveText(/de 1 proyecto\.$/);
});

test('P3-14: el HTML de /galeria no lleva los LQIP', async ({ request }) => {
  const html = await (await request.get('/galeria/')).text();
  expect(html).not.toContain('data:image/webp;base64');
});
