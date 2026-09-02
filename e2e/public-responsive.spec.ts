import { expect, test } from '@playwright/test';

test('gallery progressively renders all photos and searches the full dataset', async ({ page }) => {
  await page.goto('/galeria');
  const cards = page.locator('#photo-wall .gallery-card');
  const loadMore = page.getByRole('button', { name: 'Ver 24 fotos más' });

  await expect(cards).toHaveCount(24);
  await loadMore.click();
  await expect(cards).toHaveCount(48);

  while (await loadMore.isVisible()) await loadMore.click();
  await expect(cards).toHaveCount(201);

  await page.getByLabel('Buscar proyecto en galería').fill('vista cenital del tablero');
  await expect(cards).toHaveCount(1);
});

test('project bank paginates after filtering the complete list', async ({ page }) => {
  await page.goto('/proyectos');
  const rows = page.locator('tr[data-project-item]:visible');
  const loadMore = page.getByRole('button', { name: 'Ver 12 proyectos más' });

  await expect(rows).toHaveCount(12);
  await loadMore.click();
  await expect(rows).toHaveCount(24);

  await page.getByLabel('Buscar en el banco de proyectos').fill('ralco');
  await expect(rows).not.toHaveCount(0);
});

test('location renders without an external embed', async ({ page }) => {
  await page.goto('/contacto');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Abrir en Google Maps' }).first()).toBeVisible();
});

for (const width of [390, 768, 1440]) {
  test(`public pages have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/servicios', '/proyectos', '/galeria', '/contacto', '/clientes']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
}
