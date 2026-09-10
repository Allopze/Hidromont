import { expect, test } from '@playwright/test';

test('gallery infinite-scrolls through all photos and searches the full dataset', async ({
  page,
}) => {
  await page.goto('/galeria');
  const cards = page.locator('#photo-wall .gallery-card');

  await expect(cards).toHaveCount(24);

  // Un scroll real por vuelta: cada `wheel` mueve la posición, así que el
  // IntersectionObserver del centinela vuelve a evaluar y dispara otro lote
  // de 24 fotos. No se usa `expect(...).toPass()` aquí porque su intento
  // interno (`toHaveCount(173)`) agota su propio timeout de 5s en cada
  // vuelta esperando un valor que solo sube de a 24 — con el timeout externo
  // de `toPass` solo alcanzan 2-3 vueltas antes de cortar. Un bucle simple
  // con esperas cortas deja hacer todas las vueltas que hagan falta. 173
  // tras deduplicar 34 fotos repetidas (32% de las 201 originales, tres
  // pipelines de ingesta que nunca se dedujeron entre sí) y ampliar turbinas
  // y limpiarrejas con material ya vetted de los catálogos de la empresa.
  for (let i = 0; i < 20 && (await cards.count()) < 173; i++) {
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(250);
  }
  await expect(cards).toHaveCount(173);

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

// 320 px es el móvil pequeño real (iPhone SE de 1.ª gen y equivalentes
// Android), y es donde aparecían los desbordes que 390 no detecta: la
// rejilla de tres columnas del banner de /servicios pedía 300 px dentro de
// un contenedor de 272.
for (const width of [320, 390, 768, 1440]) {
  test(`public pages have no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/',
      '/servicios',
      '/proyectos',
      '/galeria',
      '/contacto',
      '/clientes',
      '/empresa',
      '/servicios/compuertas',
      '/proyectos/ch-los-condores',
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
}
