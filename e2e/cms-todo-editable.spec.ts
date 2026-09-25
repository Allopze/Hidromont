/**
 * Lo que tras la auditoría de edición en contexto seguía sin poder editarse
 * (25-09-2026): la lista de clientes, la foto de portada, los nombres de las
 * categorías, los rótulos de plantilla, la 404, y las fichas que el panel no
 * listaba (formulario de contacto, datos de la empresa, cabecera, pie). Y un
 * fallo público: las casillas «+ Agregar imagen» se veían en hidromontchile.cl.
 *
 * Cada prueba devuelve lo que toca a su valor original.
 */
import { readdirSync } from 'node:fs';
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

async function abrirConEditor(page: Page, ruta: string) {
  await page.goto(`${ruta}${ruta.includes('?') ? '&' : '?'}cms=1`);
  await expect(page.locator('[data-cms-editable-ready]').first()).toBeAttached();
}

async function entrada(page: Page, id: string) {
  const res = await page.request.get(`${CMS_URL}/api/cms/entries/${id}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

async function guardarCampo(page: Page, csrf: string, id: string, key: string, value: unknown) {
  return page.request.patch(`${CMS_URL}/api/cms/entries/${id}/fields/${key}`, {
    headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
    data: { value },
  });
}

test.describe('Textos del sitio', () => {
  test('el panel lista las fichas que no tenían dónde editarse', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/');
    await page.locator('.hm-cms-bar [data-action="collections"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('[data-action="tab-kind"][data-kind="sitio"]').click();

    for (const id of ['contact.form', 'site.company', 'layout.header', 'layout.footer']) {
      await expect(
        panel.locator(`[data-action="edit-entry"][data-entry-id="${id}"]`)
      ).toBeVisible();
    }
    // Son fijas: ni se crean ni se borran.
    await expect(panel.locator('[data-action="new-entry"]')).toHaveCount(0);
    await expect(panel.locator('[data-action="delete-entry"]')).toHaveCount(0);

    await panel.locator('[data-action="edit-entry"][data-entry-id="contact.form"]').click();
    const form = panel.locator('form[data-entry-form]');
    await expect(form.locator('[data-field-key="namePlaceholder"]')).toBeVisible();
    await expect(form.locator('[data-field-key="successBody"]')).toBeVisible();
    // Sin dirección ni estado: pasar a borrador vaciaba la cabecera o el pie.
    await expect(form.locator('select[name="status"]')).toHaveCount(0);
  });

  test('la cabecera no ofrece los destinos del menú', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/');
    await page.locator('.hm-cms-bar [data-action="collections"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('[data-action="tab-kind"][data-kind="sitio"]').click();
    await panel.locator('[data-action="edit-entry"][data-entry-id="layout.header"]').click();
    const form = panel.locator('form[data-entry-form]');
    await expect(form.locator('[data-field-key="navInicio"]')).toBeVisible();
    await expect(form.locator('[data-field-key^="href"]')).toHaveCount(0);
  });
});

test.describe('Lista de clientes', () => {
  test('se edita en /clientes y el recuadro no lo ve el público', async ({ page }) => {
    // Sin editor: el recuadro de la lista llega oculto.
    await page.goto('/clientes');
    await expect(page.locator('.clientes-lista-editor')).toBeHidden();

    const csrf = await iniciarSesion(page);
    const original = (await entrada(page, 'clientes.lista')).fields.nombres.value as string[];
    await abrirConEditor(page, '/clientes');

    const lista = page.locator('[data-cms-entry="clientes.lista"][data-cms-field="nombres"]');
    await expect(lista).toBeVisible();
    await lista.click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('[data-action="add-list-item"]').click();
    await panel.locator('[data-list-item]').last().fill('Cliente E2E');
    const form = panel.locator('form[data-edit]');
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('[data-edit-status]')).toHaveText(/^Guardado\./, {
      timeout: 15_000,
    });

    await expect(lista.locator('li')).toHaveCount(original.length + 1);
    await expect(lista.locator('li').last()).toHaveText('Cliente E2E');
    expect((await entrada(page, 'clientes.lista')).fields.nombres.value).toEqual([
      ...original,
      'Cliente E2E',
    ]);

    const res = await guardarCampo(page, csrf, 'clientes.lista', 'nombres', original);
    expect(res.ok()).toBeTruthy();
  });

  test('el logo de un cliente nuevo se puede guardar aunque su campo no exista', async ({
    page,
  }) => {
    const csrf = await iniciarSesion(page);
    const nuevo = await guardarCampo(
      page,
      csrf,
      'clientes.logos',
      'logo-cliente-e2e',
      '/logos-clientes/acciona.png'
    );
    expect(nuevo.ok()).toBeTruthy();
    expect((await entrada(page, 'clientes.logos')).fields['logo-cliente-e2e']?.value).toBe(
      '/logos-clientes/acciona.png'
    );
    // Solo los logos: cualquier otra clave inexistente sigue siendo un error.
    const otro = await guardarCampo(page, csrf, 'clientes.logos', 'otra-cosa', 'x');
    expect(otro.ok()).toBeFalsy();
  });
});

test.describe('Foto de portada y categorías', () => {
  test('la foto de fondo del inicio se cambia pulsándola', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/');
    const portada = page.locator('section:has([data-cms-fondo])').first();
    const caja = await portada.boundingBox();
    expect(caja).not.toBeNull();
    // A la derecha, donde no hay texto encima.
    await page.mouse.click(caja!.x + caja!.width - 60, caja!.y + caja!.height / 2);
    await expect(page.locator('.hm-cms-panel.open form[data-edit]')).toHaveAttribute(
      'data-field',
      'image'
    );
  });

  test('el nombre de una categoría se edita y el desplegable de la ficha lo sigue', async ({
    page,
  }) => {
    const csrf = await iniciarSesion(page);
    const original = (await entrada(page, 'proyectos.categorias')).fields.compuertas.value;
    await abrirConEditor(page, '/proyectos');
    // La primera sección del banco: las demás pueden quedar tras «ver más».
    await page
      .locator('h3[data-cms-entry="proyectos.categorias"][data-cms-field="compuertas"]')
      .click();
    await expect(page.locator('.hm-cms-panel.open form[data-edit]')).toHaveAttribute(
      'data-entry-id',
      'proyectos.categorias'
    );

    expect(
      (
        await guardarCampo(page, csrf, 'proyectos.categorias', 'compuertas', 'Compuertas (E2E)')
      ).ok()
    ).toBeTruthy();
    const schema = await (await page.request.get(`${CMS_URL}/api/cms/schema`)).json();
    const opcion = schema.enumFields.proyecto.categoria.find(
      (o: { value: string }) => o.value === 'compuertas'
    );
    expect(opcion.label).toBe('Compuertas (E2E)');
    await guardarCampo(page, csrf, 'proyectos.categorias', 'compuertas', original);
  });
});

test.describe('Galería', () => {
  test('con sesión, pulsar una foto abre su ficha de galería y no el visor', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/galeria');
    await page.locator('.gallery-card[data-item-id]').first().click();
    await expect(page.locator('.hm-cms-panel.open')).toBeVisible();
    await expect(page.locator('#lightbox')).toBeHidden();
  });
});

test.describe('Casillas solo para quien edita', () => {
  test('el público no ve «+ Agregar imagen»; el editor sí', async ({ page }) => {
    await page.goto('/servicios/compuertas');
    const casillas = page.getByText(/Agregar imagen \d/);
    expect(await casillas.count()).toBeGreaterThan(0);
    for (const casilla of await casillas.all()) await expect(casilla).toBeHidden();

    await iniciarSesion(page);
    await abrirConEditor(page, '/servicios/compuertas');
    await expect(page.getByText(/Agregar imagen \d/).first()).toBeVisible();
  });
});

test.describe('Rótulos de plantilla, 404 y menú', () => {
  test('el pie, la ficha de servicio y la 404 sacan sus rótulos del CMS', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/servicios/compuertas');
    for (const [entry, field] of [
      ['layout.footer', 'tituloServicios'],
      ['layout.footer', 'enlaceQuienesSomos'],
      ['layout.footer', 'derechos'],
      ['plantilla.servicio', 'tituloTipos'],
      ['plantilla.servicio', 'obrasPrefijo'],
      ['plantilla.tarjetas', 'verServicio'],
    ]) {
      // `verServicio` está en las tarjetas de /servicios, no en la ficha.
      if (field === 'verServicio') await abrirConEditor(page, '/servicios');
      await expect(
        page.locator(`[data-cms-entry="${entry}"][data-cms-field="${field}"]`).first(),
        `${entry}.${field}`
      ).toBeAttached();
    }

    await page.goto('/pagina-que-no-existe?cms=1');
    await expect(
      page.locator('[data-cms-entry="page.404"][data-cms-field="titulo"]')
    ).toBeVisible();
  });

  test('el submenú de Servicios lleva a todos los servicios que existen', async ({ page }) => {
    const slugs = readdirSync('src/content/servicios')
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''));
    await page.goto('/');
    const hrefs = await page
      .locator('nav[aria-label="Navegación principal"] a[href^="/servicios/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect([...new Set(hrefs)].sort()).toEqual(slugs.map((s) => `/servicios/${s}`).sort());
  });
});

test.describe('Campos sin efecto', () => {
  test('los campos sueltos que ninguna página lee ya no están en el CMS', async ({ page }) => {
    await iniciarSesion(page);
    const empresa = await entrada(page, 'site.company');
    expect(empresa.fields.casillaPostal).toBeUndefined();
    expect(empresa.fields.nombre).toBeDefined();
    const cabecera = await entrada(page, 'layout.header');
    expect(cabecera.fields.navCalidad).toBeUndefined();
  });
});
