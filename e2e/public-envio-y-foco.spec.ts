/**
 * P2-31 y P2-32 (auditoría 2026-09): el foco caía a `body` al enviar el
 * formulario y tras el último «Ver más» de /proyectos, y una respuesta que no
 * llegaba dejaba el formulario en «Enviando…» para siempre.
 */
import { test, expect, type Page } from '@playwright/test';

async function rellenar(page: Page) {
  await page.fill('#nombre', 'Carlos Pérez');
  await page.fill('#email', 'carlos@ejemplo.cl');
  await page.fill('#mensaje', 'Consulta de prueba del formulario');
}

test('enviar con Intro no saca el foco del botón, y un error lo lleva al aviso', async ({
  page,
}) => {
  let liberar: () => void = () => {};
  const listo = new Promise<void>((r) => (liberar = r));
  await page.route('**/formsubmit.co/**', async (route) => {
    await listo;
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/contacto/');
  await rellenar(page);
  await page.locator('#contacto-submit').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#contacto-submit')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#contacto-submit')).toBeFocused();
  liberar();
  await expect(page.locator('#contacto-error')).toBeVisible();
  await expect(page.locator('#contacto-error')).toBeFocused();
  await expect(page.locator('#contacto-submit')).not.toHaveAttribute('aria-disabled', 'true');
  // Lo escrito sigue ahí.
  await expect(page.locator('#mensaje')).toHaveValue('Consulta de prueba del formulario');
});

test('si el servicio no responde, a los 20 s avisa y deja reintentar', async ({ page }) => {
  await page.clock.install();
  await page.route('**/formsubmit.co/**', () => {
    /* nunca responde */
  });
  await page.goto('/contacto/');
  await rellenar(page);
  await page.locator('#contacto-submit').click();
  await expect(page.locator('#contacto-submit')).toHaveAttribute('aria-busy', 'true');
  await page.clock.fastForward(21_000);
  await expect(page.locator('#contacto-error')).toBeVisible();
  await expect(page.locator('#contacto-submit')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#mensaje')).toHaveValue('Consulta de prueba del formulario');
});

test('tras el último «Ver más» de /proyectos el foco queda en la lista', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/proyectos/');
  const boton = page.locator('#project-load-more');
  while (await boton.isVisible()) {
    await boton.click();
    const enfocado = await page.evaluate(() => document.activeElement?.tagName);
    expect(enfocado).not.toBe('BODY');
    await expect(page.locator(':focus')).toBeVisible();
  }
});

test('P3-13: el mensaje lleva contador y un nombre de espacios no vale', async ({ page }) => {
  await page.goto('/contacto/');
  await page.fill('#mensaje', 'Hola');
  await expect(page.locator('#mensaje-contador')).toContainText('4 / 2000');
  await page.fill('#nombre', '   ');
  await page.fill('#email', 'carlos@ejemplo.cl');
  let enviado = false;
  await page.route('**/formsubmit.co/**', (route) => {
    enviado = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"success":"true"}',
    });
  });
  await page.locator('#contacto-submit').click();
  await expect(page.locator('#nombre')).toHaveAttribute('aria-invalid', 'true');
  expect(enviado).toBe(false);
});
