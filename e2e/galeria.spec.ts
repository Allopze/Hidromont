/**
 * El visor de la galería no tenía ninguna cobertura e2e, y M-9 cambia
 * justo de dónde saca sus datos: el bloque `#lightbox-data` ya no viaja
 * serializado desde el servidor —eran los mismos 173 items una segunda vez, 81
 * de los 329 KB de la página— sino que lo rellena el script de la galería al
 * cargar, como ya hacía en cada cambio de filtro.
 *
 * Se comprueban las dos mitades del contrato: que la página deja de mandar el
 * duplicado, y que el visor sigue abriendo, navegando y respetando el filtro
 * activo, que es lo que se rompería si el orden de ejecución no aguantara.
 */
import { test, expect } from '@playwright/test';

test.describe('Galería pública', () => {
  test('M-9: el HTML servido no trae la lista de fotos dos veces', async ({ page, request }) => {
    // Del HTML crudo, antes de que corra un solo script.
    const html = await (await request.get('/galeria')).text();
    const bloques = [
      ...html.matchAll(/id="(gallery-wall-data|lightbox-data)"[^>]*>(.*?)<\/script>/gs),
    ];
    expect(bloques.map((b) => b[1])).toEqual(['gallery-wall-data', 'lightbox-data']);

    const [, , wall] = bloques[0];
    const [, , lightbox] = bloques[1];
    expect(JSON.parse(wall.replace(/\\u003c/g, '<')).length).toBeGreaterThan(50);
    expect(lightbox.trim()).toBe('[]');

    // Y una vez cargada, el visor sí tiene con qué trabajar.
    await page.goto('/galeria');
    const items = await page.locator('#lightbox-data').textContent();
    expect(JSON.parse(items ?? '[]').length).toBeGreaterThan(50);
  });

  test('el visor abre la foto pulsada y navega con las flechas', async ({ page }) => {
    await page.goto('/galeria');

    const tarjetas = page.locator('.gallery-card');
    await expect(tarjetas.first()).toBeVisible();
    const altPrimera = await tarjetas.first().getAttribute('aria-label');

    await tarjetas.first().click();
    const visor = page.getByRole('dialog', { name: 'Visor de imágenes de galería' });
    await expect(visor).toBeVisible();
    // Abre exactamente la que se pulsó, no la primera del conjunto.
    await expect(visor.locator('[data-lb-img]')).toHaveAttribute('alt', altPrimera ?? '');
    await expect(visor.locator('[data-lb-counter]')).toContainText('1');

    await visor.locator('[data-lb-next]').click();
    await expect(visor.locator('[data-lb-counter]')).toContainText('2');
    await visor.locator('[data-lb-prev]').click();
    await expect(visor.locator('[data-lb-counter]')).toContainText('1');

    await page.keyboard.press('Escape');
    await expect(visor).toBeHidden();
  });

  test('con un filtro activo el visor navega solo dentro de esa categoría', async ({ page }) => {
    await page.goto('/galeria');

    // Se elige la primera categoría concreta del menú, la que sea.
    await page.locator('#filter-trigger').click();
    const opciones = page.locator('#filter-menu [data-filter]');
    const categoria = await opciones.nth(1).getAttribute('data-filter');
    expect(categoria).toBeTruthy();
    await opciones.nth(1).click();

    const visibles = page.locator('.gallery-card');
    const cuantas = await visibles.count();
    expect(cuantas).toBeGreaterThan(0);

    // El visor debe contar ese subconjunto, no las 173 de la galería completa.
    await visibles.first().click();
    const visor = page.getByRole('dialog', { name: 'Visor de imágenes de galería' });
    await expect(visor).toBeVisible();
    const contador = await visor.locator('[data-lb-counter]').textContent();
    const total = Number((contador ?? '').match(/(\d+)\s*$/)?.[1]);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(173);

    // Y todas las fotos del recorrido son de la categoría elegida.
    const categoriaVisor = await visor.locator('[data-lb-category]').textContent();
    await visor.locator('[data-lb-next]').click();
    await expect(visor.locator('[data-lb-category]')).toHaveText(categoriaVisor ?? '');
  });
});
