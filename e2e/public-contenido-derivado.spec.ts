/**
 * P2-11 y P2-12 (auditoría 2026-09): contenido que se copiaba a mano en
 * varios sitios y se desincronizaba.
 */
import { test, expect } from '@playwright/test';

test('el formulario de contacto ofrece todos los servicios, con su nombre', async ({ page }) => {
  await page.goto('/servicios/');
  const titulos = (await page.locator('main h2, main h3').allInnerTexts()).map((t) => t.trim());
  await page.goto('/contacto/');
  const opciones = (await page.locator('#servicio option').allInnerTexts())
    .map((t) => t.trim())
    .slice(1); // la primera es «Seleccione un servicio»
  expect(opciones.at(-1)).toBe('Otro');
  const servicios = opciones.slice(0, -1);
  expect(servicios).toHaveLength(8);
  for (const nombre of ['Infraestructuras', 'Tanques Especiales']) {
    expect(servicios.some((s) => s.includes(nombre))).toBe(true);
  }
  // Cada opción es el nombre de una ficha publicada.
  for (const s of servicios) expect(titulos).toContain(s);
});

test('/clientes no pinta dos veces el mismo cliente', async ({ page }) => {
  await page.goto('/clientes/');
  const nombres = await page
    .locator('.clientes-grid .clientes-item')
    .evaluateAll((items) => items.map((i) => (i.getAttribute('title') || '').toLowerCase()));
  expect(nombres.length).toBeGreaterThan(0);
  expect(new Set(nombres).size).toBe(nombres.length);
});
