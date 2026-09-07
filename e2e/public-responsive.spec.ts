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

// Antes se verificaba lo contrario ("renders without an external embed"): el
// mapa se había quitado y el test fijaba esa decisión. Se repuso a pedido, con
// la misma forma sin clave del embed que usaba la versión original.
test('location renders the map embed and the directions link', async ({ page }) => {
  await page.goto('/contacto');
  const map = page.locator('iframe[title*="Mapa"]');
  await expect(map).toHaveCount(1);
  await expect(map).toHaveAttribute('loading', 'lazy');
  await expect(page.getByRole('link', { name: 'Abrir en Google Maps' }).first()).toBeVisible();
});

for (const slug of ['ch-besaya', 'ch-doiras', 'ch-queltehues']) {
  test(`${slug} keeps its project image within the useful source size`, async ({ page }) => {
    await page.goto(`/proyectos/${slug}`);
    const image = page.locator('[data-image-presentation="contained"] img').first();
    await expect(image).toBeVisible();
    const dimensions = await image.evaluate((element) => {
      const projectImage = element as HTMLImageElement;
      return {
        renderedWidth: projectImage.getBoundingClientRect().width,
        renderedHeight: projectImage.getBoundingClientRect().height,
        sourceWidth: projectImage.naturalWidth,
        sourceHeight: projectImage.naturalHeight,
      };
    });
    expect(dimensions.renderedWidth).toBeLessThanOrEqual(dimensions.sourceWidth);
    expect(dimensions.renderedHeight).toBeLessThanOrEqual(dimensions.sourceHeight);
  });
}

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
