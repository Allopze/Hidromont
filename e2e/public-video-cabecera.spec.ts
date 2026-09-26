/**
 * P2-35 (auditoría 2026-09): el video de cabecera de Limpiarrejas (1080p,
 * 8 MB) se descargaba entero en móvil y también con «reducir movimiento».
 */
import { test, expect } from '@playwright/test';

test('con «reducir movimiento» no se descarga el video', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pedidos: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('.mp4')) pedidos.push(r.url());
  });
  await page.goto('/servicios/limpiarrejas/');
  await page.waitForLoadState('networkidle');
  const video = page.locator('video[data-hero-video]');
  await expect(video).not.toHaveAttribute('src', /./);
  expect(pedidos).toEqual([]);
});

test('en móvil se reproduce la variante de 480p', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/servicios/limpiarrejas/');
  await expect(page.locator('video[data-hero-video]')).toHaveAttribute('src', /-480\.mp4$/);
});
