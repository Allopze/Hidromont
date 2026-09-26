/**
 * P2-37 (auditoría 2026-09): el visor precargaba un candidato del srcset y
 * mostraba otro, así que en móvil cada foto se descargaba dos veces.
 */
import { test, expect } from '@playwright/test';

test('en móvil, cada foto del visor se pide una sola vez', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto('/galeria/');
  const pedidas: string[] = [];
  page.on('request', (r) => {
    const m = /\/gallery\/derived\/([0-9a-f]+)-\d+\.webp/.exec(r.url());
    if (m) pedidas.push(`${m[1]}|${r.url()}`);
  });
  await page.locator('.gallery-card').first().click();
  const contador = page.locator('[data-lb-counter]');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowRight');
    await expect(contador).toContainText(`${i + 2} /`);
    await expect(page.locator('[data-lb-img]')).toHaveCSS('opacity', '1');
  }
  await page.waitForLoadState('networkidle');
  // Por cada foto (hash), un único ancho pedido.
  const anchosPorFoto = new Map<string, Set<string>>();
  for (const p of pedidas) {
    const [hash, url] = p.split('|');
    if (!anchosPorFoto.has(hash)) anchosPorFoto.set(hash, new Set());
    anchosPorFoto.get(hash)!.add(url);
  }
  const repetidas = [...anchosPorFoto].filter(([, urls]) => urls.size > 1);
  expect(pedidas.length).toBeGreaterThan(0);
  expect(repetidas).toEqual([]);
  await ctx.close();
});
