/**
 * Todo lo que el sitio muestra desde el CMS se edita pulsándolo.
 *
 * Auditoría del 25-09-2026: recorriendo las 27 páginas con el CMS activo, más
 * de 600 textos visibles salían de un campo del CMS sin marca de edición. Las
 * tarjetas de servicios y proyectos, las cifras de la home, los botones, la
 * tabla del banco de proyectos (30 obras sin página propia) y el pie solo se
 * podían cambiar buscando la ficha en el panel. Además la franja de logos de
 * la home ignoraba los logos cambiados en el CMS, y el panel ofrecía fichas
 * que ninguna página lee.
 *
 * Cada prueba devuelve lo que toca a su valor original: la base es una copia
 * desechable (scripts/e2e-cms-sandbox.mjs), pero las pruebas comparten sesión.
 */
import { readFileSync } from 'node:fs';
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

/** Abre la página con el editor y espera a que marque lo editable. */
async function abrirConEditor(page: Page, ruta: string) {
  await page.goto(`${ruta}${ruta.includes('?') ? '&' : '?'}cms=1`);
  await expect(page.locator('[data-cms-editable-ready]').first()).toBeAttached();
}

async function valorGuardado(page: Page, entrada: string, campo: string) {
  const res = await page.request.get(`${CMS_URL}/api/cms/entries/${entrada}`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).fields[campo]?.value;
}

async function restaurar(page: Page, csrf: string, entrada: string, campo: string, valor: unknown) {
  const res = await page.request.patch(`${CMS_URL}/api/cms/entries/${entrada}/fields/${campo}`, {
    headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
    data: { value: valor },
  });
  expect(res.ok()).toBeTruthy();
}

async function guardar(page: Page) {
  const form = page.locator('.hm-cms-panel.open form[data-edit]');
  await form.locator('button[type="submit"]').click();
  await expect(form.locator('[data-edit-status]')).toHaveText(/^Guardado\./, { timeout: 15_000 });
}

test.describe('Tarjetas del inicio', () => {
  test('el título de una tarjeta de servicio se edita pulsándolo', async ({ page }) => {
    const csrf = await iniciarSesion(page);
    const original = await valorGuardado(page, 'servicios.compuertas', 'titulo');
    await abrirConEditor(page, '/');

    const titulo = page.locator(
      '#servicios [data-cms-entry="servicios.compuertas"][data-cms-field="titulo"]'
    );
    await titulo.click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel.locator('form[data-edit]')).toBeVisible();
    // Vaciar el título dejaría una tarjeta en blanco: no se ofrece.
    await expect(panel.locator('[data-action="clear-field"]')).toHaveCount(0);

    await panel.locator('form[data-edit] [name="value"]').fill('Compuertas (E2E)');
    await expect(titulo).toHaveText('Compuertas (E2E)');
    await guardar(page);
    expect(await valorGuardado(page, 'servicios.compuertas', 'titulo')).toBe('Compuertas (E2E)');

    await restaurar(page, csrf, 'servicios.compuertas', 'titulo', original);
  });

  test('una tarjeta de proyecto abre el editor y no su ficha', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/');

    // El «Ver detalle» se estira sobre toda la tarjeta: sin subir el campo por
    // encima, este clic navegaba a /proyectos/…
    const nombre = page
      .locator('#proyectos [data-cms-entry^="proyectos."][data-cms-field="nombre"]')
      .first();
    await nombre.click();
    await expect(page.locator('.hm-cms-panel.open form[data-edit]')).toBeVisible();
    await expect(page).toHaveURL(/\/\?cms=1$/);
  });

  test('la foto de una tarjeta de proyecto se cambia desde la tarjeta', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/');
    const foto = page
      .locator('#proyectos img[data-cms-entry^="project-image."][data-cms-field="image"]')
      .first();
    await foto.click();
    await expect(page.locator('.hm-cms-panel.open [data-encuadre-marco]')).toBeVisible();
    await expect(page).toHaveURL(/\/\?cms=1$/);
  });

  test('una cifra se reemplaza entera al escribirla', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/');

    const cifra = page.locator(
      '[data-cms-entry="home.installations"][data-cms-field="card1Value"]'
    );
    await cifra.scrollIntoViewIfNeeded();
    // El contador anima la cifra al entrar en pantalla; se espera a que acabe.
    await page.waitForTimeout(1_500);
    await cifra.click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('form[data-edit] [name="value"]').fill('45+ años');
    // «40» iba en su propio <span>: antes quedaba delante del texto nuevo.
    await expect(cifra).toHaveText('45+ años');

    await panel.locator('[data-action="close"]').click();
    await page.locator('[data-cms-dialog] [data-dialog-ok]').click();
    await expect(cifra).not.toHaveText('45+ años');
  });

  test('pulsar el relleno de un botón abre su editor', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/');

    const boton = page.locator('a[data-cms-editable-host]', {
      has: page.locator('[data-cms-entry="home.hero"][data-cms-field="primaryLabel"]'),
    });
    // Una esquina del botón, fuera del texto.
    await boton.click({ position: { x: 4, y: 4 } });
    await expect(page.locator('.hm-cms-panel.open form[data-edit]')).toHaveAttribute(
      'data-field',
      'primaryLabel'
    );
    await expect(page).toHaveURL(/\/\?cms=1$/);
  });

  test('la franja de logos usa los mismos logos que /clientes', async ({ page }) => {
    const logos = async () =>
      page
        .locator('img[src^="/logos-clientes/"]')
        .evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src') ?? ''))
        .then((srcs) => new Set(srcs));

    await page.goto('/clientes');
    const enClientes = await logos();
    await page.goto('/');
    const enInicio = await logos();

    expect(enInicio.size).toBeGreaterThan(0);
    expect([...enInicio].filter((src) => !enClientes.has(src))).toEqual([]);
  });
});

test.describe('Fichas de servicio y proyecto', () => {
  test('una lista guardada desde la página se pinta como lista', async ({ page }) => {
    const csrf = await iniciarSesion(page);
    const original = (await valorGuardado(page, 'servicios.compuertas', 'tipos')) as string[];
    await abrirConEditor(page, '/servicios/compuertas');

    const lista = page.locator(
      'aside [data-cms-entry="servicios.compuertas"][data-cms-field="tipos"]'
    );
    await lista.click();
    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel.locator('[data-action="clear-field"]')).toHaveCount(0);
    await panel.locator('[data-list-item]').first().fill('Compuerta vagón (E2E)');
    await guardar(page);

    // Antes se escribía «Compuerta vagón (E2E),Compuerta Taintor…» como texto.
    await expect(lista.locator('li')).toHaveCount(original.length);
    await expect(lista.locator('li').first()).toHaveText('Compuerta vagón (E2E)');
    expect(await valorGuardado(page, 'servicios.compuertas', 'tipos')).toEqual([
      'Compuerta vagón (E2E)',
      ...original.slice(1),
    ]);

    await restaurar(page, csrf, 'servicios.compuertas', 'tipos', original);
  });

  test('un cuerpo con formato guardado se pinta con formato', async ({ page }) => {
    const entrada = 'proyectos.tanques-glp-coyhaique';
    const csrf = await iniciarSesion(page);
    const original = String(await valorGuardado(page, entrada, 'body'));
    await abrirConEditor(page, '/proyectos/tanques-glp-coyhaique');

    const cuerpo = page.locator(`[data-cms-entry="${entrada}"][data-cms-field="body"]`);
    await cuerpo.click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('textarea[name="value"]').fill(`${original}\n\n## Revisión E2E`);
    await guardar(page);
    await expect(panel.locator('[data-edit-status]')).toContainText('vista aproximada');

    // Ni Markdown crudo ni las barras de la tabla como texto.
    await expect(cuerpo.locator('h2', { hasText: 'Revisión E2E' })).toBeVisible();
    await expect(cuerpo.locator('table')).toBeVisible();
    await expect(cuerpo).not.toContainText('## Revisión');
    await expect(cuerpo).not.toContainText('| ---');

    await restaurar(page, csrf, entrada, 'body', original);
  });

  test('el recuadro de contacto de las fichas sale del CMS', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/servicios/compuertas');
    await page
      .locator('[data-cms-entry="servicios.detalle.contacto"][data-cms-field="title"]')
      .click();
    await expect(page.locator('.hm-cms-panel.open form[data-edit]')).toHaveAttribute(
      'data-entry-id',
      'servicios.detalle.contacto'
    );
  });

  test('los proyectos del banco se editan desde la tabla de /proyectos', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/proyectos');
    const nombre = page
      .locator('table [data-cms-entry="proyectos.embalse-ancoa"][data-cms-field="nombre"]')
      .first();
    await nombre.click();
    await expect(page.locator('.hm-cms-panel.open form[data-edit]')).toHaveAttribute(
      'data-entry-id',
      'proyectos.embalse-ancoa'
    );
  });
});

test.describe('Textos que estaban fijos en el código', () => {
  test('las cifras del taller de /servicios y la dirección del pie se editan', async ({ page }) => {
    await iniciarSesion(page);
    await abrirConEditor(page, '/servicios');
    await expect(
      page.locator('[data-cms-entry="servicios.index.banner"][data-cms-field="stat1Value"]')
    ).toHaveText('3.000 m²');
    await expect(
      page.locator('footer [data-cms-entry="site.company"][data-cms-field="domicilio"]')
    ).toBeVisible();
    // Los servicios del pie usan los mismos campos que el menú de la cabecera.
    await expect(
      page.locator(
        'footer [data-cms-entry="layout.header"][data-cms-field="navServiciosCompuertas"]'
      )
    ).toBeAttached();
  });
});

test.describe('Fichas sin efecto en el sitio', () => {
  test('ya no están en el CMS', async ({ page }) => {
    await iniciarSesion(page);
    for (const id of ['calidad.hero', 'calidad.cta', 'contacto.hero', 'galeria.hero']) {
      const res = await page.request.get(`${CMS_URL}/api/cms/entries/${id}`);
      expect(res.status(), id).toBe(404);
    }
  });
});

test.describe('Contador de cifras de la portada', () => {
  // Los valores tal como están en el contenido exportado, que es lo que pinta
  // el sitio.
  const cms = JSON.parse(readFileSync('src/data/cms-content.json', 'utf8'));
  const esperadas = [1, 2, 3].map(
    (n) => cms.entries['home.installations'].fields[`card${n}Value`].value as string
  );

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`termina en el mismo texto que el valor (${reducedMotion})`, async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion });
      const page = await context.newPage();
      await page.goto('/');
      const cifras = page.locator('[data-count]');
      await cifras.first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(1_800);
      // Pintaba «40 + años» y «1.997».
      expect(await cifras.allTextContents()).toEqual(esperadas);
      await context.close();
    });
  }
});
