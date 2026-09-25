/**
 * Deshacer un borrado, desde la interfaz.
 *
 * Los borrados de galería eran irreversibles y el de fotos no tenía ni
 * confirmación en servidor pese a destruir título, alt, posición, categoría,
 * álbum y destacado de un clic.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { aceptarConfirmaciones } from './helpers/confirmaciones';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';
let testCategoryIds: string[] = [];

async function apiLogin(page: Page) {
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

/** Crea una categoría por API y devuelve su id: es lo más barato de borrar. */
async function crearCategoria(page: Page, csrf: string, nombre: string) {
  const res = await page.request.post(`${CMS_URL}/api/cms/gallery/categories`, {
    headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
    data: { name: nombre },
  });
  expect(res.status()).toBe(201);
  const id = (await res.json()).id as string;
  testCategoryIds.push(id);
  return id;
}

async function abrirCategorias(page: Page) {
  await page.goto('/?cms=1');
  await page.locator('.hm-cms-bar [data-action="gallery"]').click();
  await page.getByRole('button', { name: 'Gestionar categorías' }).click();
  await expect(page.locator('.hm-cms-panel.open')).toBeVisible();
}

test.describe('Deshacer', () => {
  test.beforeEach(() => {
    testCategoryIds = [];
  });

  test.afterEach(async ({ page }) => {
    if (!testCategoryIds.length) return;
    const csrf = await apiLogin(page);
    for (const id of testCategoryIds) {
      await page.request
        .delete(`${CMS_URL}/api/cms/gallery/categories/${encodeURIComponent(id)}`, {
          headers: { 'x-csrf-token': csrf },
        })
        .catch(() => {});
    }
  });

  test('borrar una categoría ofrece deshacerlo, y la devuelve', async ({ page }) => {
    const csrf = await apiLogin(page);
    const nombre = `Prueba ${Date.now()}`;
    await crearCategoria(page, csrf, nombre);

    await abrirCategorias(page);
    await expect(page.getByText(nombre, { exact: false }).first()).toBeVisible();

    await aceptarConfirmaciones(page);
    await page.locator(`[data-action="gallery-delete-cat"][data-cat-name="${nombre}"]`).click();

    const aviso = page.locator('[data-undo-host]');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText(nombre);

    await aviso.locator('[data-action="undo"]').click();
    await expect(aviso).toContainText('Restaurado');

    await abrirCategorias(page);
    await expect(page.getByText(nombre, { exact: false }).first()).toBeVisible();
  });

  test('el aviso sobrevive a que el panel se repinte', async ({ page }) => {
    // Es la prueba que fija la decisión de montarlo en el shell. Los borradores
    // llaman acto seguido a un cargador que hace panelBody.innerHTML = html;
    // dentro del panel, el aviso moriría al nacer. Sin esta prueba alguien lo
    // moverá allí y parecerá que funciona hasta que no.
    const csrf = await apiLogin(page);
    const nombre = `Repintado ${Date.now()}`;
    await crearCategoria(page, csrf, nombre);

    await abrirCategorias(page);
    await aceptarConfirmaciones(page);
    await page.locator(`[data-action="gallery-delete-cat"][data-cat-name="${nombre}"]`).click();

    const aviso = page.locator('[data-undo-host]');
    await expect(aviso).toBeVisible();

    // Navegar a otra vista repinta panelBody entero. Se usa la barra porque
    // sus botones existen siempre, mire el panel lo que mire.
    await page.locator('.hm-cms-bar [data-action="collections"]').click();
    await expect(page.locator('[data-action="edit-entry"]').first()).toBeVisible();
    await expect(aviso, 'el aviso debe seguir en pie tras repintar el panel').toBeVisible();

    await aviso.locator('[data-action="undo"]').click();
    await expect(aviso).toContainText('Restaurado');
  });

  test('es una región viva y la cuenta atrás no la satura', async ({ page }) => {
    const csrf = await apiLogin(page);
    const nombre = `Accesible ${Date.now()}`;
    await crearCategoria(page, csrf, nombre);

    await page.goto('/?cms=1');
    const aviso = page.locator('[data-undo-host]');
    // Existe desde el montaje, vacío: una región viva insertada y rellenada en
    // el mismo fotograma no se anuncia de forma fiable.
    await expect(aviso).toHaveAttribute('role', 'status');
    await expect(aviso).toHaveAttribute('aria-live', 'polite');

    await page.locator('.hm-cms-bar [data-action="gallery"]').click();
    await page.getByRole('button', { name: 'Gestionar categorías' }).click();
    await aceptarConfirmaciones(page);
    await page.locator(`[data-action="gallery-delete-cat"][data-cat-name="${nombre}"]`).click();
    await expect(aviso).toBeVisible();

    // Los segundos van aparte y ocultos: doce actualizaciones seguidas dentro
    // de la región dejarían un lector de pantalla inservible.
    await expect(aviso.locator('[data-undo-cuenta]')).toHaveAttribute('aria-hidden', 'true');

    await aviso.locator('[data-action="undo"]').click();
    await expect(aviso).toContainText('Restaurado');
  });

  test('el botón Deshacer es alcanzable con teclado', async ({ page }) => {
    // Vive fuera del panel, así que la trampa de foco lo dejaba inaccesible.
    const csrf = await apiLogin(page);
    const nombre = `Teclado ${Date.now()}`;
    await crearCategoria(page, csrf, nombre);

    await abrirCategorias(page);
    await aceptarConfirmaciones(page);
    await page.locator(`[data-action="gallery-delete-cat"][data-cat-name="${nombre}"]`).click();
    await expect(page.locator('[data-undo-host]')).toBeVisible();

    // Se coloca el foco en el último control del panel y se pulsa Tab UNA vez.
    // Recorrer el orden a fuerza de pulsaciones tardaba más que los 12 s de la
    // ventana y hacía la prueba intermitente: competía con su propio
    // temporizador. El ciclo es panel → deshacer → panel, así que una
    // pulsación desde el final del panel basta para demostrarlo.
    await page.evaluate(() => {
      const enfocables = document.querySelectorAll<HTMLElement>(
        '.hm-cms-panel a[href], .hm-cms-panel button:not([disabled]), .hm-cms-panel input:not([type="hidden"]):not([disabled]), .hm-cms-panel textarea:not([disabled]), .hm-cms-panel select:not([disabled])'
      );
      enfocables[enfocables.length - 1]?.focus();
    });
    await page.keyboard.press('Tab');

    expect(
      await page.evaluate(() => document.activeElement?.getAttribute('data-action')),
      'desde el final del panel, Tab debería llegar a Deshacer'
    ).toBe('undo');

    await page.keyboard.press('Enter');
    await expect(page.locator('[data-undo-host]')).toContainText('Restaurado');
  });

  test('el overlay sigue sin violaciones de axe con el aviso abierto', async ({ page }) => {
    // El shell tiene historial de problemas de landmarks, y el aviso añade un
    // elemento nuevo a esa superficie. Las ocho escenas del panel están en 0
    // violaciones; esta es la novena.
    const csrf = await apiLogin(page);
    const nombre = `Axe ${Date.now()}`;
    await crearCategoria(page, csrf, nombre);

    await abrirCategorias(page);
    await aceptarConfirmaciones(page);
    await page.locator(`[data-action="gallery-delete-cat"][data-cat-name="${nombre}"]`).click();
    await expect(page.locator('[data-undo-host]')).toBeVisible();

    const r = await new AxeBuilder({ page }).include('.hm-cms-shell').analyze();
    const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      graves.map((v) => ({ id: v.id, nodos: v.nodes.map((n) => n.target) })),
      'el aviso de deshacer introdujo violaciones'
    ).toEqual([]);

    await page.locator('[data-undo-host] [data-action="undo"]').click();
    await expect(page.locator('[data-undo-host]')).toContainText('Restaurado');
  });

  test('un segundo borrado reemplaza el aviso, no lo apila', async ({ page }) => {
    const csrf = await apiLogin(page);
    const a = `UnoA ${Date.now()}`;
    const b = `UnoB ${Date.now()}`;
    await crearCategoria(page, csrf, a);
    await crearCategoria(page, csrf, b);

    await abrirCategorias(page);
    await aceptarConfirmaciones(page);
    await page.locator(`[data-action="gallery-delete-cat"][data-cat-name="${a}"]`).click();
    await expect(page.locator('[data-undo-host]')).toContainText(a);
    await page.locator(`[data-action="gallery-delete-cat"][data-cat-name="${b}"]`).click();

    const avisos = page.locator('[data-undo-host]');
    await expect(avisos).toHaveCount(1);
    await expect(avisos).toContainText(b);
    await expect(avisos).not.toContainText(a);
  });
});
