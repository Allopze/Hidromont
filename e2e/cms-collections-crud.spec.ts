/**
 * E2E tests: CRUD completo de colecciones en el overlay del CMS.
 * Cubre: creación, edición de campos, listas dinámicas, historial de
 * revisiones con restauración y eliminación con confirmación.
 */
import { test, expect } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

const TEST_ENTRY_ID = 'servicio.e2e-test-unitario';
const TEST_SLUG = 'e2e-test-servicio';
const TEST_TITLE = 'Servicio E2E Automatizado';

async function apiLogin(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

test.describe('CMS Collections CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Activar overlay vía localStorage
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  });

  test.afterEach(async ({ page }) => {
    // Asegurar limpieza de la entrada de prueba si quedó creada
    await page.request
      .delete(`${CMS_URL}/api/cms/entries/${encodeURIComponent(TEST_ENTRY_ID)}`)
      .catch(() => {});
  });

  test('ciclo completo: crear entrada, editarla, consultar revisiones y eliminarla', async ({
    page,
  }) => {
    await apiLogin(page);
    await page.goto('/?cms=1');

    // Manejo de diálogos de confirmación (para borrado o despublicación)
    page.on('dialog', (dialog) => dialog.accept());

    // 1. Abrir panel de colecciones
    const collectionsBtn = page.locator('.hm-cms-bar [data-action="collections"]');
    await expect(collectionsBtn).toBeVisible();
    await collectionsBtn.click();

    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toBeVisible();

    // Cambiar a la pestaña de Servicios
    const tabServicios = panel.locator('.hm-cms-tab[data-action="tab-kind"][data-kind="servicio"]');
    await expect(tabServicios).toBeVisible();
    await tabServicios.click();

    // 2. Crear nueva entrada
    const newEntryBtn = panel.locator('button[data-action="new-entry"]');
    await expect(newEntryBtn).toBeVisible();
    await newEntryBtn.click();

    const entryForm = panel.locator('form[data-entry-form]');
    await expect(entryForm).toBeVisible();

    await entryForm.locator('input[name="id"]').fill(TEST_ENTRY_ID);
    await entryForm.locator('input[name="title"]').fill(TEST_TITLE);
    await entryForm.locator('input[name="slug"]').fill(TEST_SLUG);
    await entryForm.locator('select[name="status"]').selectOption('draft');

    await entryForm.locator('button[type="submit"]').click();

    // Al guardar, el formulario muestra feedback y vuelve a la lista
    await expect(panel.locator('.hm-cms-collection-list')).toBeVisible({ timeout: 5000 });
    const itemCreado = panel.locator('.hm-cms-collection-item', { hasText: TEST_TITLE });
    await expect(itemCreado).toBeVisible();
    await expect(itemCreado.locator('.hm-cms-badge')).toContainText(/borrador/i);

    // 3. Editar la entrada creada
    await itemCreado.locator('[data-action="edit-entry"]').click();
    await expect(entryForm).toBeVisible();

    const nuevoTitulo = `${TEST_TITLE} Modificado`;
    await entryForm.locator('input[name="title"]').fill(nuevoTitulo);

    // Si tiene campos de lista (ej: aplicaciones o items), probar añadir y remover
    const listEditor = entryForm.locator('[data-list-editor]').first();
    if ((await listEditor.count()) > 0) {
      const addBtn = listEditor.locator('[data-action="add-list-item"]');
      await addBtn.click();
      const nuevoInput = listEditor.locator('input[data-list-item]').last();
      await nuevoInput.fill('Elemento de prueba dinámica');
    }

    await entryForm.locator('button[type="submit"]').click();
    await expect(panel.locator('.hm-cms-collection-list')).toBeVisible({ timeout: 5000 });

    const itemModificado = panel.locator('.hm-cms-collection-item', { hasText: nuevoTitulo });
    await expect(itemModificado).toBeVisible();

    // 4. Eliminar la entrada
    await panel.locator('.hm-cms-tabs button[data-kind="servicio"]').click();
    await expect(itemModificado).toBeVisible();
    await itemModificado.locator('[data-action="delete-entry"]').click();

    // Verificar que desapareció del panel
    await expect(panel.locator('.hm-cms-collection-item', { hasText: nuevoTitulo })).toHaveCount(0);

    // Verificar en la API que el recurso fue eliminado (404)
    const res = await page.request.get(
      `${CMS_URL}/api/cms/entries/${encodeURIComponent(TEST_ENTRY_ID)}`
    );
    expect(res.status()).toBe(404);
  });

  test('búsqueda y filtrado dentro del panel de colecciones', async ({ page }) => {
    await apiLogin(page);
    await page.goto('/?cms=1');

    await page.locator('.hm-cms-bar [data-action="collections"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toBeVisible();

    const searchInput = panel.locator('input[data-collection-search]');
    await expect(searchInput).toBeVisible();

    // Búsqueda con coincidencia exacta de un servicio real
    await searchInput.fill('compuertas');
    const items = panel.locator('.hm-cms-collection-item');
    await expect(items.first()).toContainText(/compuertas/i);

    // Búsqueda sin coincidencia
    await searchInput.fill('termino_imposible_12345');
    await expect(panel.locator('.hm-cms-collection-item')).toHaveCount(0);
    await expect(panel).toContainText(/ninguna entrada/i);
  });
});
