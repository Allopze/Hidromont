/**
 * Fase 3: barra, publicación y galería.
 *
 * - La barra deja visibles las acciones de cada día y pone Historial,
 *   Administrar y Salir en un menú «Más».
 * - La barra cuenta los cambios sin publicar, también después de recargar.
 * - «Publicar cambios» enseña primero qué va a salir; el avance y el resultado
 *   se explican sin jerga. La compilación se simula: en el sandbox publicar
 *   de verdad exportaría y compilaría el sitio entero.
 * - Galería abre directamente en Imágenes, con pestañas.
 */
import { test, expect, type Page } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

async function iniciarSesion(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

/** Guarda un cambio real en un campo de texto y devuelve cómo deshacerlo. */
async function guardarUnCambio(page: Page, csrf: string) {
  const elemento = page.locator('[data-cms-entry][data-cms-type="text"]:visible').first();
  const entryId = (await elemento.getAttribute('data-cms-entry'))!;
  const campo = (await elemento.getAttribute('data-cms-field'))!;
  const res = await page.request.get(`${CMS_URL}/api/cms/entries/${entryId}`);
  const entrada = await res.json();
  const antes = entrada.fields[campo].value;
  await elemento.click();
  await page.locator('form[data-edit] [name="value"]').fill(`${antes} ·`);
  await page.locator('form[data-edit] button[type="submit"]').click();
  await expect(page.locator('form[data-edit] [data-edit-status]')).toContainText('Guardado.');
  return {
    titulo: entrada.title as string,
    deshacer: () =>
      page.request.patch(`${CMS_URL}/api/cms/entries/${entryId}/fields/${campo}`, {
        headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
        data: { value: antes },
      }),
  };
}

test.describe('Barra', () => {
  test('Historial, Administrar y Salir van en el menú «Más»', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/?cms=1');
    const barra = page.locator('.hm-cms-bar');
    await expect(barra.locator('[data-action="publish"]')).toBeVisible();
    await expect(barra.locator('[data-action="collections"]')).toBeVisible();
    await expect(barra.locator('[data-action="logout"]')).toBeHidden();

    const mas = barra.locator('[data-action="bar-menu"]');
    await mas.click();
    await expect(mas).toHaveAttribute('aria-expanded', 'true');
    for (const accion of ['jobs', 'admin', 'logout']) {
      await expect(barra.locator(`[data-action="${accion}"]`)).toBeVisible();
    }
    // El foco entra en el menú y Escape lo cierra devolviéndolo al botón.
    await expect(barra.locator('[data-action="jobs"]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(barra.locator('[data-action="logout"]')).toBeHidden();
    await expect(mas).toBeFocused();

    // Pulsar fuera también lo cierra.
    await mas.click();
    await page
      .locator('h1')
      .first()
      .click({ position: { x: 5, y: 5 }, force: true });
    await expect(barra.locator('[data-action="logout"]')).toBeHidden();
  });

  test('cuenta los cambios sin publicar, también después de recargar', async ({ page }) => {
    const csrf = await iniciarSesion(page);
    await page.goto('/?cms=1');
    const cambio = await guardarUnCambio(page, csrf);
    try {
      const distintivo = page.locator('.hm-cms-bar [data-state-badge]');
      await expect(distintivo).toHaveText(/^\d+ cambios? sin publicar$/);
      await page.reload();
      await expect(distintivo).toHaveText(/^\d+ cambios? sin publicar$/);
    } finally {
      await cambio.deshacer();
    }
  });
});

test.describe('Publicar', () => {
  test('enseña qué va a salir antes de publicar, y se puede cancelar', async ({ page }) => {
    const csrf = await iniciarSesion(page);
    await page.goto('/?cms=1');
    const cambio = await guardarUnCambio(page, csrf);
    try {
      await page.locator('.hm-cms-panel [data-action="close"]').click();
      await page.locator('.hm-cms-bar [data-action="publish"]').click();

      const resumen = page.locator('[data-publish-summary]');
      await expect(resumen).toBeVisible();
      await expect(resumen.locator('.hm-cms-pending-list')).toContainText(cambio.titulo);
      await expect(resumen.getByRole('button', { name: 'Publicar ahora' })).toBeVisible();

      await resumen.getByRole('button', { name: 'Cancelar' }).click();
      await expect(page.locator('.hm-cms-panel.open')).toHaveCount(0);
    } finally {
      await cambio.deshacer();
    }
  });

  test('si la publicación falla, lo dice sin jerga y ofrece reintentar', async ({ page }) => {
    await iniciarSesion(page);
    await page.route('**/api/cms/publish', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            json: {
              job: { id: 'job-e2e', status: 'failed', logs: ['astro build: error simulado'] },
              exported: {},
            },
          })
        : route.continue()
    );
    await page.goto('/?cms=1');
    await page.locator('.hm-cms-bar [data-action="publish"]').click();
    await page.locator('[data-action="confirm-publish"]').click();

    const resultado = page.locator('[data-publish-result="error"]');
    await expect(resultado).toBeVisible();
    await expect(resultado).toContainText('No se pudo publicar');
    await expect(resultado).toContainText('no se perdió nada de lo guardado');
    // El registro técnico está, pero plegado.
    await expect(resultado.locator('.hm-cms-log')).toBeHidden();
    await expect(resultado.getByRole('button', { name: 'Intentar de nuevo' })).toBeVisible();
    await expect(page.locator('.hm-cms-bar [data-state-badge]')).toHaveText('No se pudo completar');
  });

  test('si sale bien, dice qué pasó y cuánto tardó', async ({ page }) => {
    await iniciarSesion(page);
    await page.route('**/api/cms/publish', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            json: { job: { id: 'job-e2e', status: 'succeeded', logs: [] }, exported: {} },
          })
        : route.continue()
    );
    await page.goto('/?cms=1');
    await page.locator('.hm-cms-bar [data-action="publish"]').click();
    await page.locator('[data-action="confirm-publish"]').click();

    const resultado = page.locator('[data-publish-result="ok"]');
    await expect(resultado).toBeVisible();
    // En local se compila; para verse en el sitio falta desplegar.
    await expect(resultado).toContainText('Compilado en este equipo');
    await expect(resultado).toContainText(/tardó \d+ s/);
  });
});

test.describe('Galería y herramientas', () => {
  test('Galería abre en Imágenes, con pestañas para Álbumes y Categorías', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/?cms=1');
    await page.locator('.hm-cms-bar [data-action="gallery"]').click();

    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel.locator('[data-action="gallery-new-item"]')).toBeVisible();
    const pestanas = panel.locator('.hm-cms-tab');
    await expect(pestanas).toHaveText(['Imágenes', 'Álbumes', 'Categorías']);
    await expect(panel.locator('.hm-cms-tab[aria-current="page"]')).toHaveText('Imágenes');

    await panel.locator('.hm-cms-tab[data-action="gallery-albums"]').click();
    await expect(panel.locator('[data-action="gallery-new-album"]')).toBeVisible();
    await expect(panel.locator('.hm-cms-tab[aria-current="page"]')).toHaveText('Álbumes');
  });

  test('«Exportar» vive en Administración, no en el editor de un campo', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/?cms=1');
    await page.locator('[data-cms-entry][data-cms-type="text"]:visible').first().click();
    await expect(page.locator('form[data-edit]')).toBeVisible();
    await expect(page.locator('form[data-edit] [data-action="export"]')).toHaveCount(0);

    await page.locator('.hm-cms-panel [data-action="close"]').click();
    await page.locator('.hm-cms-bar [data-action="bar-menu"]').click();
    await page.locator('.hm-cms-bar [data-action="admin"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel.getByRole('heading', { name: 'Herramientas avanzadas' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Exportar archivos' })).toBeVisible();
  });
});
