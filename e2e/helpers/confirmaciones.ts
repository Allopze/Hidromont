import type { Page } from '@playwright/test';

/**
 * Acepta las confirmaciones del panel.
 *
 * Desde sep-2026 el CMS pide confirmación con su propio diálogo y no con
 * `window.confirm`, así que `page.on('dialog', d => d.accept())` ya no las ve.
 * El manejador de localizador las acepta antes de la siguiente acción o
 * aserción, igual que hacía el nativo.
 *
 * El nativo se mantiene: el aviso del navegador al salir con cambios sin
 * guardar (`beforeunload`) no se puede sustituir y sigue siendo del sistema.
 *
 * Para comprobar el TEXTO de una confirmación no uses esto: el manejador la
 * aceptaría antes de la aserción. Localiza `[data-cms-dialog]` a mano.
 */
export async function aceptarConfirmaciones(page: Page): Promise<void> {
  page.on('dialog', (d) => d.accept());
  await page.addLocatorHandler(page.locator('[data-cms-dialog]'), async (capa) => {
    await capa.locator('[data-dialog-ok]').click();
  });
}
