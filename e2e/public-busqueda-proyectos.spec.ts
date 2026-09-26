/**
 * P2-30 (auditoría 2026-09): búsqueda de /proyectos con normalización común y
 * estado en la dirección.
 */
import { test, expect } from '@playwright/test';

const conteo = (page: import('@playwright/test').Page) =>
  page.locator('#project-results-count').innerText();

test('«1600», «ø1600» y «Ø 1.600» dan lo mismo; «CH Ralco» encuentra C.H. Ralco', async ({
  page,
}) => {
  await page.goto('/proyectos/');
  const buscador = page.locator('#project-search');
  await buscador.fill('Ø 1.600');
  const referencia = await conteo(page);
  expect(referencia).not.toContain(' 0 de 0');
  for (const variante of ['1600', 'ø1600']) {
    await buscador.fill(variante);
    await expect(page.locator('#project-results-count')).toHaveText(referencia);
  }
  await buscador.fill('CH Ralco');
  await expect(page.locator('#project-results-count')).not.toContainText(' 0 de 0');
});

test('la búsqueda y el filtro quedan en la dirección y sobreviven a volver atrás', async ({
  page,
}) => {
  await page.goto('/proyectos/');
  const filtro = page.locator('[data-filter]:not([data-filter="todos"])').first();
  const cat = (await filtro.getAttribute('data-filter'))!;
  await filtro.click();
  await page.locator('#project-search').fill('ralco');
  await expect(page).toHaveURL(new RegExp(`[?&]cat=${cat}`));
  await expect(page).toHaveURL(/[?&]q=ralco/);
  const antes = await conteo(page);

  await page.goto('/empresa/');
  await page.goBack();
  await expect(page.locator('#project-search')).toHaveValue('ralco');
  await expect(page.locator(`[data-filter="${cat}"]`)).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#project-results-count')).toHaveText(antes);
});

test('un enlace con ?cat= abre la lista filtrada', async ({ page }) => {
  await page.goto('/proyectos/');
  const cat = (await page
    .locator('[data-filter]:not([data-filter="todos"])')
    .first()
    .getAttribute('data-filter'))!;
  await page.goto(`/proyectos/?cat=${cat}`);
  await expect(page.locator(`[data-filter="${cat}"]`)).toHaveAttribute('aria-checked', 'true');
});
