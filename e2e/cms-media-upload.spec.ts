/**
 * E2E tests: Carga real de medios y selector de imágenes en el CMS.
 * Cubre: subida multipart de archivos sintéticos y selector de medios en la UI.
 */
import { test, expect } from '@playwright/test';
import { aceptarConfirmaciones } from './helpers/confirmaciones';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

// PNG válido de 1x1 píxel codificado en base64
const SYNTHETIC_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

let csrfToken: string | undefined;
let uploadedMediaId: string | undefined;

async function apiLogin(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

test.describe('CMS Media & Uploads', () => {
  test.beforeEach(async ({ page }) => {
    csrfToken = undefined;
    uploadedMediaId = undefined;
    await aceptarConfirmaciones(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  });

  test.afterEach(async ({ page }) => {
    if (!csrfToken || !uploadedMediaId) return;
    const response = await page.request.delete(
      `${CMS_URL}/api/cms/media/${encodeURIComponent(uploadedMediaId)}?confirm=1`,
      { headers: { 'x-csrf-token': csrfToken } }
    );
    expect([200, 404]).toContain(response.status());
  });

  test('subida real de archivo de imagen sintética y creación de ítem', async ({ page }) => {
    csrfToken = await apiLogin(page);
    await page.goto('/?cms=1');

    // 1. Abrir galería -> Gestión de imágenes
    await page.locator('.hm-cms-bar [data-action="gallery"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toBeVisible();

    await panel.getByRole('button', { name: 'Gestionar imágenes' }).click();
    await expect(panel.locator('[data-action="gallery-new-item"]')).toBeVisible();

    await panel.locator('[data-action="gallery-new-item"]').click();
    const form = panel.locator('form[data-gallery-item-form]');
    await expect(form).toBeVisible();

    // 2. Subir imagen vía input de archivo
    const fileInput = form.locator('input[data-gallery-upload]');
    await fileInput.setInputFiles({
      name: 'e2e-synthetic-test.png',
      mimeType: 'image/png',
      buffer: SYNTHETIC_PNG_BUFFER,
    });

    const uniqueAlt = `UploadE2E${Date.now()}`;
    await form.locator('input[name="alt"]').fill(uniqueAlt);
    const uploadResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/cms/media' &&
        response.request().method() === 'POST'
    );
    await form.locator('button[type="submit"]').click();
    const uploaded = await uploadResponse;
    expect(uploaded.ok()).toBeTruthy();
    uploadedMediaId = (await uploaded.json()).id as string;
    expect(uploadedMediaId).toBeTruthy();

    // 3. Verificar que se procesó la subida y se creó el ítem en la lista
    const filterInput = panel.locator('input[data-gallery-filter-q]');
    await expect(filterInput).toBeVisible({ timeout: 10000 });
    await filterInput.fill(uniqueAlt);

    const createdThumb = panel.locator(`[data-action="gallery-edit-item"][title="${uniqueAlt}"]`);
    await expect(createdThumb).toBeVisible({ timeout: 5000 });

    // 4. Limpieza: eliminar el ítem creado
    await createdThumb.click();
    await expect(form).toBeVisible();
    await form.locator('[data-action="gallery-delete-item"]').click();

    await expect(
      panel.locator(`[data-action="gallery-edit-item"][title="${uniqueAlt}"]`)
    ).toHaveCount(0);

    const mediaDelete = await page.request.delete(
      `${CMS_URL}/api/cms/media/${encodeURIComponent(uploadedMediaId)}?confirm=1`,
      { headers: { 'x-csrf-token': csrfToken } }
    );
    expect(mediaDelete.ok()).toBeTruthy();
    uploadedMediaId = undefined;
  });

  test('selector de medios en edición de campo visual de imagen', async ({ page }) => {
    csrfToken = await apiLogin(page);
    await page.goto('/?cms=1');

    // Buscar cualquier elemento editable de tipo imagen en la página actual
    const editableImage = page.locator('[data-cms-entry][data-cms-type="image"]').first();
    if ((await editableImage.count()) === 0) return;

    await editableImage.click();

    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toBeVisible();

    // Comprobar que el selector de medios se renderiza
    const mediaGrid = panel.locator('[data-media-grid]');
    await expect(mediaGrid).toBeVisible();

    // Buscar dentro de la biblioteca de medios
    const searchInput = panel.locator('input[data-media-search]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('logo');

    // Seleccionar una imagen de los resultados filtrados
    const mediaTile = mediaGrid.locator('button[data-action="select-media"]').first();
    await expect(mediaTile).toBeVisible({ timeout: 5000 });

    await mediaTile.click();

    // El label del medio seleccionado debe actualizarse
    const selectedLabel = panel.locator('[data-selected-media-label]');
    await expect(selectedLabel).toBeVisible();
    expect(await selectedLabel.textContent()).toBeTruthy();

    // Cerrar panel descartando cambios
    await panel.locator('[data-action="close"]').click();
    await expect(page.locator('.hm-cms-panel.open')).toHaveCount(0);
  });
});
