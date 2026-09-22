/**
 * E2E tests: Validaciones y estados de error del formulario de contacto.
 * Cubre: validaciones en cliente (campos vacíos, formato email),
 * fallo del servicio externo (HTTP 500), estado de carga y rate-limiting de cliente.
 */
import { test, expect } from '@playwright/test';

test.describe('Formulario de contacto: validaciones y manejo de errores', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contacto');
  });

  test('validación en cliente con campos vacíos activa mensajes accesibles', async ({ page }) => {
    const submitBtn = page.locator('#contacto-submit');
    await submitBtn.click();

    // Comprobar que los campos requeridos se marcan con aria-invalid
    const nombreInput = page.locator('#nombre');
    const emailInput = page.locator('#email');
    const mensajeInput = page.locator('#mensaje');

    await expect(nombreInput).toHaveAttribute('aria-invalid', 'true');
    await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    await expect(mensajeInput).toHaveAttribute('aria-invalid', 'true');

    // Mensajes de error legibles y visibles
    const nombreError = page.locator('#nombre-error');
    const emailError = page.locator('#email-error');
    const mensajeError = page.locator('#mensaje-error');

    await expect(nombreError).toBeVisible();
    await expect(emailError).toBeVisible();
    await expect(mensajeError).toBeVisible();

    // El primer campo inválido recibe el foco
    await expect(nombreInput).toBeFocused();
  });

  test('validación de formato de correo electrónico inválido', async ({ page }) => {
    await page.fill('#nombre', 'Nombre Valido');
    await page.fill('#email', 'correo-invalido-sin-arroba');
    await page.fill('#mensaje', 'Consulta de prueba');

    await page.click('#contacto-submit');

    const emailInput = page.locator('#email');
    await expect(emailInput).toHaveAttribute('aria-invalid', 'true');

    const emailError = page.locator('#email-error');
    await expect(emailError).toBeVisible();
    await expect(emailError).toContainText(/correo válido/i);
  });

  test('manejo de error 500 del servicio externo muestra aviso y reactiva botón', async ({
    page,
  }) => {
    // Interceptar llamada a FormSubmit simulando caída de servicio
    await page.route('**/formsubmit.co/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: '{"error":"Error interno"}',
      })
    );

    await page.fill('#nombre', 'Carlos Perez');
    await page.fill('#email', 'carlos@ejemplo.cl');
    await page.fill('#mensaje', 'Mensaje de prueba con servicio caído');

    const submitBtn = page.locator('#contacto-submit');
    await submitBtn.click();

    // Debe mostrarse el banner de error general
    const errorBanner = page.locator('#contacto-error');
    await expect(errorBanner).toBeVisible({ timeout: 5000 });

    // El formulario no debe desaparecer ni mostrar el estado de éxito
    await expect(page.locator('#contacto-form')).toBeVisible();
    await expect(page.locator('#contacto-success')).toBeHidden();

    // El botón debe volver a estar habilitado para reintentar
    await expect(submitBtn).toBeEnabled();
  });

  test('rate-limiting de cliente tras múltiples envíos', async ({ page }) => {
    /*
     * La clave y el mensaje cambiaron en 13de19c y esta prueba se quedó atrás:
     * sembraba `hidromont:contact:submits` y esperaba «Demasiados envíos», así
     * que el limitador veía la lista vacía, el envío salía a la red y fallaba
     * con el error genérico. Pasaba por un fallo real del formulario cuando lo
     * que había caducado era la prueba.
     *
     * El nombre nuevo describe la semántica nueva: solo cuentan los envíos que
     * el proveedor aceptó. Un fallo de transporte o un rechazo del proveedor
     * siguen siendo reintentables y no consumen el cupo.
     */
    await page.evaluate(() => {
      const now = Date.now();
      sessionStorage.setItem(
        'hidromont:contact:accepted-submits',
        JSON.stringify([now - 10000, now - 5000, now - 1000])
      );
    });

    await page.fill('#nombre', 'Usuario Frecuente');
    await page.fill('#email', 'frecuente@ejemplo.cl');
    await page.fill('#mensaje', 'Intento que debería ser frenado por rate limit');

    await page.click('#contacto-submit');

    const errorBanner = page.locator('#contacto-error');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/Ya se aceptaron varios envíos/i);
    // El aviso dice cuándo volver a intentarlo, no solo que no se puede.
    await expect(errorBanner).toContainText(/Intente nuevamente en \d+ segundos/i);
  });
});
