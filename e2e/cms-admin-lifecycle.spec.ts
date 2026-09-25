/**
 * E2E tests: Ciclo de vida administrativo, respaldos, auditoría,
 * publicación y control de sesiones en el CMS.
 */
import { test, expect } from '@playwright/test';
import { aceptarConfirmaciones } from './helpers/confirmaciones';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

async function apiLogin(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

test.describe('CMS Admin Lifecycle & Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await aceptarConfirmaciones(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  });

  test('cierre de sesión (logout) desactiva la barra y revoca la sesión', async ({ page }) => {
    await apiLogin(page);
    await page.goto('/?cms=1');

    // Verificar que los botones administrativos están visibles
    const logoutBtn = page.locator('.hm-cms-bar [data-action="logout"]');
    await expect(logoutBtn).toBeVisible();

    // Clic en Salir
    await logoutBtn.click();

    // La página se recarga y la barra deja de mostrar acciones autenticadas
    await expect(page.locator('.hm-cms-bar [data-action="collections"]')).toBeHidden({
      timeout: 5000,
    });

    // Comprobar que la API confirma la sesión terminada
    const res = await page.request.get(`${CMS_URL}/api/cms/session`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  test('creación de respaldo en vivo desde el panel de administración', async ({ page }) => {
    await apiLogin(page);
    await page.goto('/?cms=1');

    await page.locator('.hm-cms-bar [data-action="admin"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toBeVisible();

    const backupBtn = panel.locator('[data-action="create-backup"]');
    await expect(backupBtn).toBeVisible();

    await backupBtn.click();

    // Debe mostrar notificación de éxito con data-admin-notice y el respaldo en la lista
    const notice = panel.locator('[data-admin-notice]');
    await expect(notice).toBeVisible({ timeout: 10000 });
    await expect(notice).toContainText(/Respaldo creado/i);

    const listaRespaldos = panel.locator('.hm-cms-admin-list li');
    await expect(listaRespaldos.first()).toBeVisible();
  });

  test('historial de publicaciones y jobs', async ({ page }) => {
    await apiLogin(page);
    await page.goto('/?cms=1');

    // Abrir historial de publicaciones (jobs)
    await page.locator('.hm-cms-bar [data-action="jobs"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toBeVisible();

    // Debe mostrar la sección de trabajos
    const jobList = panel.locator('.hm-cms-job-list');
    await expect(jobList).toBeVisible();
  });

  test('manejo de sesión expirada al intentar guardar cambios', async ({ page, context }) => {
    await apiLogin(page);
    await page.goto('/?cms=1');

    // Clic en cualquier elemento editable de texto para abrir el formulario
    const editable = page
      .locator('[data-cms-entry][data-cms-field][data-cms-type="text"]:visible')
      .first();
    if ((await editable.count()) === 0) return;

    await editable.click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toBeVisible();
    const status = panel.locator('form[data-edit] [data-edit-status]');
    await expect(status).toHaveText('Todo guardado.');

    // Simular expiración de sesión borrando las cookies en el cliente
    await context.clearCookies();

    // Modificar el valor e intentar guardar
    const input = panel.locator('form[data-edit] [name="value"]');
    await input.fill('Cambio sin sesión');
    await expect(status).toHaveText('Cambios sin guardar.');

    const submitBtn = panel.locator('form[data-edit] button[type="submit"]');
    await submitBtn.click();

    // El overlay debe capturar el error 401 y mostrar el mensaje en el estado del formulario sin perder el texto
    const errorStatus = panel.locator('form[data-edit] [data-status] .hm-cms-error');
    await expect(errorStatus).toBeVisible({ timeout: 5000 });
    await expect(errorStatus).toHaveAttribute('role', 'alert');
    await expect(input).toHaveValue('Cambio sin sesión');
  });
});
