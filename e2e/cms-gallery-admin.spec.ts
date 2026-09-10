/**
 * E2E tests: Administración completa de la galería en el CMS.
 * Cubre: gestión de categorías (crear, editar, eliminar), álbumes y fotos.
 */
import { test, expect } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

const TEST_CAT_NAME = 'Cat E2E Automatizada';
const TEST_CAT_SLUG = 'cat-e2e-auto';

const TEST_ALBUM_NAME = 'Álbum E2E Automatizado';
const TEST_ALBUM_SLUG = 'album-e2e-auto';

async function apiLogin(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

test.describe('CMS Gallery Administration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  });

  test.afterEach(async ({ page }) => {
    // Limpieza de seguridad por si algún test falló a la mitad
    await page.request
      .delete(`${CMS_URL}/api/cms/gallery/categories/${TEST_CAT_SLUG}`)
      .catch(() => {});
    await page.request
      .delete(`${CMS_URL}/api/cms/gallery/albums/${TEST_ALBUM_SLUG}`)
      .catch(() => {});
  });

  test('gestión de categorías: crear, editar y eliminar', async ({ page }) => {
    await apiLogin(page);
    await page.goto('/?cms=1');
    page.on('dialog', (d) => d.accept());

    // 1. Abrir menú de Galería
    await page.locator('.hm-cms-bar [data-action="gallery"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toBeVisible();

    // 2. Entrar a Categorías
    await panel.getByRole('button', { name: 'Gestionar categorías' }).click();
    await expect(panel.locator('[data-action="gallery-new-cat"]')).toBeVisible();

    // 3. Crear nueva categoría
    await panel.locator('[data-action="gallery-new-cat"]').click();
    const form = panel.locator('form[data-gallery-cat-form]');
    await expect(form).toBeVisible();

    await form.locator('input[name="name"]').fill(TEST_CAT_NAME);
    await form.locator('input[name="slug"]').fill(TEST_CAT_SLUG);
    await form.locator('button[type="submit"]').click();

    // Volver a la lista y verificar que existe
    await expect(panel.locator('.hm-cms-gallery-cat-name', { hasText: TEST_CAT_NAME })).toBeVisible(
      {
        timeout: 5000,
      }
    );

    // 4. Editar categoría
    const catItem = panel.locator('.hm-cms-gallery-cat-btn', { hasText: TEST_CAT_NAME });
    await catItem.locator('[data-action="gallery-edit-cat"]').click();
    await expect(form).toBeVisible();

    const nombreEditado = `${TEST_CAT_NAME} Modificada`;
    await form.locator('input[name="name"]').fill(nombreEditado);
    await form.locator('button[type="submit"]').click();

    await expect(panel.locator('.hm-cms-gallery-cat-name', { hasText: nombreEditado })).toBeVisible(
      {
        timeout: 5000,
      }
    );

    // 5. Eliminar categoría
    const catEditada = panel.locator('.hm-cms-gallery-cat-btn', { hasText: nombreEditado });
    await catEditada.locator('[data-action="gallery-delete-cat"]').click();

    await expect(panel.locator('.hm-cms-gallery-cat-name', { hasText: nombreEditado })).toHaveCount(
      0
    );
  });

  test('gestión de álbumes: crear, editar y eliminar', async ({ page }) => {
    await apiLogin(page);
    await page.goto('/?cms=1');
    page.on('dialog', (d) => d.accept());

    await page.locator('.hm-cms-bar [data-action="gallery"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toBeVisible();

    // Entrar a Álbumes
    await panel.getByRole('button', { name: 'Gestionar álbumes' }).click();
    await expect(panel.locator('[data-action="gallery-new-album"]')).toBeVisible();

    // Crear nuevo álbum
    await panel.locator('[data-action="gallery-new-album"]').click();
    const form = panel.locator('form[data-gallery-album-form]');
    await expect(form).toBeVisible();

    await form.locator('input[name="name"]').fill(TEST_ALBUM_NAME);
    await form.locator('input[name="slug"]').fill(TEST_ALBUM_SLUG);
    await form.locator('button[type="submit"]').click();

    // Verificar en la lista
    await expect(
      panel.locator('.hm-cms-gallery-cat-name', { hasText: TEST_ALBUM_NAME })
    ).toBeVisible({
      timeout: 5000,
    });

    // Editar álbum
    const albumItem = panel.locator('.hm-cms-gallery-cat-btn', { hasText: TEST_ALBUM_NAME });
    await albumItem.locator('[data-action="gallery-edit-album"]').click();
    await expect(form).toBeVisible();

    const albumEditado = `${TEST_ALBUM_NAME} Modificado`;
    await form.locator('input[name="name"]').fill(albumEditado);
    await form.locator('button[type="submit"]').click();

    await expect(panel.locator('.hm-cms-gallery-cat-name', { hasText: albumEditado })).toBeVisible({
      timeout: 5000,
    });

    // Eliminar álbum
    const albumParaBorrar = panel.locator('.hm-cms-gallery-cat-btn', { hasText: albumEditado });
    await albumParaBorrar.locator('[data-action="gallery-delete-album"]').click();

    await expect(panel.locator('.hm-cms-gallery-cat-name', { hasText: albumEditado })).toHaveCount(
      0
    );
  });

  test('gestión de imágenes: agregar imagen, buscarla y eliminarla', async ({ page }) => {
    await apiLogin(page);
    await page.goto('/?cms=1');
    page.on('dialog', (d) => d.accept());

    await page.locator('.hm-cms-bar [data-action="gallery"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toBeVisible();

    // Entrar a Imágenes
    await panel.getByRole('button', { name: 'Gestionar imágenes' }).click();
    await expect(panel.locator('[data-action="gallery-new-item"]')).toBeVisible();

    // Click en Agregar imagen
    await panel.locator('[data-action="gallery-new-item"]').click();
    const form = panel.locator('form[data-gallery-item-form]');
    await expect(form).toBeVisible();

    // Seleccionar una imagen existente de la biblioteca
    const primeraThumb = form
      .locator('[data-gallery-media-grid] button[data-action="gallery-select-media"]')
      .first();
    await expect(primeraThumb).toBeVisible({ timeout: 5000 });
    await primeraThumb.click();

    const testAlt = `FotoAutoE2E${Date.now()}`;
    await form.locator('input[name="alt"]').fill(testAlt);
    await form.locator('button[type="submit"]').click();

    // Verificar que vuelve a la lista de imágenes
    const filterInput = panel.locator('input[data-gallery-filter-q]');
    await expect(filterInput).toBeVisible({ timeout: 5000 });

    // Filtrar por el alt único de prueba para localizar la tarjeta sin depender de paginación
    await filterInput.fill(testAlt);
    const itemFoto = panel.locator(`[data-action="gallery-edit-item"][title="${testAlt}"]`);
    await expect(itemFoto).toBeVisible({ timeout: 5000 });

    // Editar la foto y eliminarla
    await itemFoto.click();
    await expect(form).toBeVisible();
    await form.locator('[data-action="gallery-delete-item"]').click();

    // Verificar que al volver a filtrar ya no está
    await expect(
      panel.locator(`[data-action="gallery-edit-item"][title="${testAlt}"]`)
    ).toHaveCount(0);
  });
});
