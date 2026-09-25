/**
 * Listas de grupos y confirmaciones del panel.
 *
 * 1. `procesos` de los servicios es una lista de grupos `{ titulo, descripcion }`.
 *    El formulario la pintaba con `String(item)` —«[object Object]»— y tocar un
 *    elemento y guardar reemplazaba los cuatro procesos por esa cadena.
 *    Reproducido el 24-09-2026 contra una copia de la base real. Desde el
 *    25-09-2026 la ficha ya no lo ofrece —ninguna página lo muestra desde
 *    79f5257—, así que lo que se fija es que guardar la ficha no lo toque.
 *
 * 2. Las confirmaciones dejaron de ser `window.confirm`. La propia tiene que
 *    comportarse como un diálogo: foco dentro, Escape cancela sin cerrar el
 *    panel de detrás.
 */
import { test, expect, type Page } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';
const ENTRADA = 'servicios.compuertas';

type Proceso = { titulo: string; descripcion: string };

async function iniciarSesion(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

async function procesosGuardados(page: Page): Promise<unknown[]> {
  const res = await page.request.get(`${CMS_URL}/api/cms/entries/${ENTRADA}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).fields.procesos.value;
}

async function abrirFicha(page: Page) {
  await page.goto('/?cms=1');
  await page.locator('.hm-cms-bar [data-action="collections"]').click();
  const panel = page.locator('.hm-cms-panel.open');
  await panel.locator(`[data-action="edit-entry"][data-entry-id="${ENTRADA}"]`).click();
  const form = panel.locator('form[data-entry-form]');
  await expect(form).toBeVisible();
  return form;
}

test.describe('Listas de grupos', () => {
  let original: Proceso[];
  let csrf: string;

  test.beforeEach(async ({ page }) => {
    csrf = await iniciarSesion(page);
    original = (await procesosGuardados(page)) as Proceso[];
    expect(original.length).toBeGreaterThan(0);
    expect(typeof original[0]).toBe('object');
  });

  test.afterEach(async ({ page }) => {
    // Devolver los procesos a su estado para no contaminar otras pruebas.
    await page.request.patch(`${CMS_URL}/api/cms/entries/${ENTRADA}/fields/procesos`, {
      headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
      data: { value: original },
    });
  });

  test('la ficha ya no ofrece los procesos, que ninguna página muestra', async ({ page }) => {
    const form = await abrirFicha(page);
    await expect(form.locator('[data-field-key="resumen"]')).toBeVisible();
    await expect(form.locator('[data-field-key="procesos"]')).toHaveCount(0);
  });

  test('guardar otro campo de la ficha deja los procesos intactos', async ({ page }) => {
    // El formulario solo envía lo que cambia: que no se vean no puede
    // significar que se borren o se conviertan en texto.
    const entrada = await (await page.request.get(`${CMS_URL}/api/cms/entries/${ENTRADA}`)).json();
    const normasOriginales = entrada.fields.normas.value as string[];

    const form = await abrirFicha(page);
    const primera = form.locator('[data-field-key="normas"] [data-list-item]').first();
    await primera.fill(`${normasOriginales[0]} (E2E)`);
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('[data-status]')).toHaveText(/^Guardado\./, { timeout: 15_000 });

    expect(await procesosGuardados(page)).toEqual(original);

    const res = await page.request.patch(`${CMS_URL}/api/cms/entries/${ENTRADA}/fields/normas`, {
      headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
      data: { value: normasOriginales },
    });
    expect(res.ok()).toBeTruthy();
  });
});

test.describe('Confirmaciones del panel', () => {
  test('son diálogos accesibles: foco dentro y Escape cancela', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/?cms=1');

    const editable = page.locator('[data-cms-entry][data-cms-type="text"]:visible').first();
    await editable.click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel.locator('form[data-edit]')).toBeVisible();

    await panel.locator('[data-action="clear-field"]').click();
    const dialogo = page.getByRole('alertdialog', { name: '¿Vaciar este texto?' });
    await expect(dialogo).toBeVisible();
    // Ante una acción destructiva, el foco empieza en la salida segura.
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();

    // El Tab no se escapa del diálogo.
    await page.keyboard.press('Tab');
    await expect(dialogo.getByRole('button', { name: 'Vaciar' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused();

    // Escape cancela el diálogo, no el panel, y el texto sigue ahí.
    await page.keyboard.press('Escape');
    await expect(dialogo).toHaveCount(0);
    await expect(panel).toBeVisible();
    await expect(panel.locator('form[data-edit] [name="value"]')).not.toHaveValue('');
  });
});
