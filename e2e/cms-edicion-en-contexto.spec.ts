/**
 * Fase 2: edición en contexto.
 *
 * - Editar un campo no oscurece la página: el elemento se resalta y muestra lo
 *   que se escribe; si no se guarda, vuelve a como estaba.
 * - Al pasar el puntero, una etiqueta dice qué se puede hacer.
 * - En la ficha de un servicio, la barra ofrece «Editar este servicio».
 * - La ficha tiene un solo título, el que usa el sitio, y el nombre de la
 *   lista lo sigue.
 * - Las listas se reordenan con botones y Cmd/Ctrl+S guarda.
 */
import { test, expect, type Page } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';
const SERVICIO = 'servicios.compuertas';
const GUARDAR = process.platform === 'darwin' ? 'Meta+S' : 'Control+S';

async function iniciarSesion(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

async function entrada(page: Page, id: string) {
  const res = await page.request.get(`${CMS_URL}/api/cms/entries/${id}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function restaurarCampo(page: Page, csrf: string, id: string, key: string, value: unknown) {
  const res = await page.request.patch(`${CMS_URL}/api/cms/entries/${id}/fields/${key}`, {
    headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
    data: { value },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe('Edición de un campo en la página', () => {
  test('no oscurece la página, muestra lo escrito y lo revierte si no se guarda', async ({
    page,
  }) => {
    await iniciarSesion(page);
    await page.goto('/?cms=1');

    const elemento = page.locator('[data-cms-entry][data-cms-type="text"]:visible').first();
    const original = (await elemento.textContent())?.trim() ?? '';
    await elemento.click();

    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel.locator('form[data-edit]')).toBeVisible();
    await expect(page.locator('[data-cms-backdrop]')).not.toHaveClass(/visible/);
    await expect(elemento).toHaveClass(/hm-cms-editing/);

    const texto = `Vista previa ${Date.now()}`;
    await panel.locator('form[data-edit] [name="value"]').fill(texto);
    await expect(elemento).toHaveText(texto);

    // Cerrar sin guardar: pregunta, y al aceptar la página vuelve a como estaba.
    await panel.locator('[data-action="close"]').click();
    await page.locator('[data-cms-dialog] [data-dialog-ok]').click();
    await expect(panel).toHaveCount(0);
    await expect(elemento).toHaveText(original);
    await expect(elemento).not.toHaveClass(/hm-cms-editing/);
  });

  test('pasar a otro elemento con cambios sin guardar pide confirmación', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/?cms=1');

    const textos = page.locator('[data-cms-entry][data-cms-type="text"]:visible');
    const primero = textos.nth(0);
    const segundo = textos.nth(1);
    const original = (await primero.textContent())?.trim() ?? '';
    await primero.click();
    await page.locator('form[data-edit] [name="value"]').fill('Cambio sin guardar');

    await segundo.click();
    const dialogo = page.getByRole('alertdialog', { name: 'Tienes cambios sin guardar' });
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Seguir editando' }).click();
    await expect(primero).toHaveClass(/hm-cms-editing/);
    await expect(primero).toHaveText('Cambio sin guardar');

    await segundo.click();
    await dialogo.getByRole('button', { name: 'Cambiar de elemento' }).click();
    await expect(segundo).toHaveClass(/hm-cms-editing/);
    await expect(primero).toHaveText(original);
  });

  test('Cmd/Ctrl+S guarda, y lo guardado se queda en la página', async ({ page }) => {
    const csrf = await iniciarSesion(page);
    await page.goto('/?cms=1');

    const elemento = page.locator('[data-cms-entry][data-cms-type="text"]:visible').first();
    const entryId = (await elemento.getAttribute('data-cms-entry'))!;
    const campo = (await elemento.getAttribute('data-cms-field'))!;
    const antes = (await entrada(page, entryId)).fields[campo].value;

    await elemento.click();
    const input = page.locator('form[data-edit] [name="value"]');
    const texto = `${antes} ·`;
    await input.fill(texto);
    try {
      await page.keyboard.press(GUARDAR);
      await expect(page.locator('form[data-edit] [data-edit-status]')).toContainText('Guardado.');
      expect((await entrada(page, entryId)).fields[campo].value).toBe(texto);

      // Guardado: cerrar ya no revierte la página.
      await page.locator('.hm-cms-panel [data-action="close"]').click();
      await expect(elemento).toHaveText(texto);
    } finally {
      await restaurarCampo(page, csrf, entryId, campo, antes);
    }
  });

  test('al pasar el puntero, una etiqueta dice qué se puede hacer', async ({ page }) => {
    await iniciarSesion(page);
    await page.goto('/?cms=1');
    await expect(page.locator('.hm-cms-bar [data-action="collections"]')).toBeVisible();

    await page.locator('[data-cms-entry][data-cms-type="text"]:visible').first().hover();
    await expect(page.locator('.hm-cms-chip')).toBeVisible();
    await expect(page.locator('.hm-cms-chip')).toHaveText('Editar texto');

    await page.locator('[data-cms-entry][data-cms-type="image"]:visible').first().hover();
    await expect(page.locator('.hm-cms-chip')).toHaveText('Cambiar imagen');
  });
});

test.describe('La ficha de un servicio', () => {
  test('la barra ofrece «Editar este servicio» solo en su ficha', async ({ page }) => {
    await iniciarSesion(page);
    // Una página sin ficha propia ni datos para buscadores: nada que ofrecer.
    await page.goto('/contacto/gracias/?cms=1');
    await expect(page.locator('.hm-cms-bar [data-action="collections"]')).toBeVisible();
    await expect(page.locator('.hm-cms-bar [data-action="edit-page-entry"]')).toBeHidden();

    // En la portada, la ficha que guarda su título y descripción en Google.
    await page.goto('/?cms=1');
    const portada = page.locator('.hm-cms-bar [data-action="edit-page-entry"]');
    await expect(portada).toHaveText('Datos para buscadores');
    await portada.click();
    await expect(page.locator('.hm-cms-panel.open form[data-entry-form]')).toHaveAttribute(
      'data-entry-id',
      'home.hero'
    );

    await page.goto('/servicios/compuertas/?cms=1');
    const boton = page.locator('.hm-cms-bar [data-action="edit-page-entry"]');
    await expect(boton).toBeVisible();
    await expect(boton).toHaveText('Editar este servicio');
    await boton.click();

    const form = page.locator('.hm-cms-panel.open form[data-entry-form]');
    await expect(form).toHaveAttribute('data-entry-id', SERVICIO);
    // Un solo título visible, el que usa el sitio, y primero.
    await expect(form.locator('input[name="title"]')).toHaveAttribute('type', 'hidden');
    const primerCampo = form.locator('input:visible, textarea:visible').first();
    await expect(primerCampo).toHaveAttribute('name', 'field:titulo');
    await expect(form.locator('.hm-cms-form-section-title').first()).toHaveText('Contenido');
  });

  test('el título de la lista sigue al del sitio, y las listas se reordenan', async ({ page }) => {
    const csrf = await iniciarSesion(page);
    const original = await entrada(page, SERVICIO);
    const normas = original.fields.normas.value as string[];
    expect(normas.length).toBeGreaterThan(1);

    await page.goto('/servicios/compuertas/?cms=1');
    await page.locator('.hm-cms-bar [data-action="edit-page-entry"]').click();
    const form = page.locator('.hm-cms-panel.open form[data-entry-form]');

    const nuevoTitulo = `${original.fields.titulo.value} (E2E)`;
    await form.locator('input[name="field:titulo"]').fill(nuevoTitulo);

    const listaNormas = form.locator('[data-field-key="normas"]');
    await listaNormas.getByRole('button', { name: 'Bajar el elemento 1' }).click();
    await expect(listaNormas.locator('[data-list-item]').first()).toHaveValue(normas[1]);
    // El primero no puede subir más: no cambia nada.
    await listaNormas.getByRole('button', { name: 'Subir el elemento 1' }).click();
    await expect(listaNormas.locator('[data-list-item]').first()).toHaveValue(normas[1]);

    try {
      await form.locator('button[type="submit"]').click();
      await expect(form.locator('[data-status]')).toHaveText(/^Guardado\./, { timeout: 15_000 });
      const guardada = await entrada(page, SERVICIO);
      expect(guardada.fields.titulo.value).toBe(nuevoTitulo);
      expect(guardada.title).toBe(nuevoTitulo);
      expect(guardada.fields.normas.value).toEqual([normas[1], normas[0], ...normas.slice(2)]);
    } finally {
      await restaurarCampo(page, csrf, SERVICIO, 'titulo', original.fields.titulo.value);
      await restaurarCampo(page, csrf, SERVICIO, 'normas', normas);
      await page.request.patch(`${CMS_URL}/api/cms/entries/${SERVICIO}`, {
        headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
        data: { title: original.title, slug: original.slug, status: original.status },
      });
    }
  });
});
