/**
 * P1-10, P1-11 y P1-12 (auditoría 2026-09): menú móvil inalcanzable, foco del
 * teclado casi invisible y foco perdido en la galería.
 */
import { test, expect } from '@playwright/test';

test.describe('Menú móvil', () => {
  for (const [width, height, desplegar] of [
    [568, 320, false],
    [844, 390, false],
    [390, 664, true],
  ] as const) {
    test(`a ${width}×${height}${desplegar ? ' con Servicios desplegado' : ''} se llega al CTA`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await page.locator('#menu-toggle').click();
      const menu = page.locator('#mobile-menu');
      await expect(menu).toBeVisible();
      if (desplegar) await menu.locator('summary').first().click();

      const cta = menu.locator('.pt-4 a');
      await cta.scrollIntoViewIfNeeded();
      const caja = await cta.boundingBox();
      expect(caja, 'el CTA debe tener caja').not.toBeNull();
      expect(caja!.y + caja!.height).toBeLessThanOrEqual(height);
      // El menú se desplaza por dentro, no la página.
      expect(await menu.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    });
  }

  test('al pasar a escritorio con el menú abierto la página vuelve a desplazarse', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto('/servicios/');
    await page.locator('#menu-toggle').click();
    await page.setViewportSize({ width: 1180, height: 820 });
    await expect(page.locator('body')).not.toHaveClass(/overflow-hidden/);
  });
});

test.describe('Foco visible', () => {
  test('los botones principales tienen un contorno de foco opaco', async ({ page }) => {
    await page.goto('/contacto/');
    const boton = page.locator('#contacto-submit');
    await boton.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const color = await boton.evaluate((el) => getComputedStyle(el).outlineColor);
    // rgb(...) sin canal alfa, o rgba con alfa 1.
    expect(color).not.toMatch(/rgba\([^)]*,\s*0?\.\d+\)/);
    expect(await boton.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  });

  test('el buscador de la galería marca el foco', async ({ page }) => {
    await page.goto('/galeria/');
    const buscador = page.locator('#gallery-search');
    await buscador.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(buscador).toBeFocused();
    expect(await buscador.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  });
});

test.describe('Foco en la galería', () => {
  test('tabular por el muro no pierde el foco al cargar más fotos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/galeria/');
    await page.locator('.gallery-card').first().focus();
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const enTarjeta = await page.evaluate(
        () => !!document.activeElement?.closest('.gallery-card')
      );
      expect(enTarjeta, `Tab ${i + 1}`).toBe(true);
      await page.waitForTimeout(60);
    }
    expect(await page.locator('.gallery-card').count()).toBeGreaterThan(24);
  });

  test('al cerrar el visor el foco vuelve a la foto que lo abrió', async ({ page }) => {
    await page.goto('/galeria/');
    const tercera = page.locator('.gallery-card').nth(2);
    const id = await tercera.getAttribute('data-item-id');
    await tercera.click();
    await expect(page.locator('#lightbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#lightbox')).toBeHidden();
    expect(
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.itemId)
    ).toBe(id);
  });
});
