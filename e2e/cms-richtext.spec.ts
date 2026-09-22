/**
 * E2E del editor de texto con formato.
 *
 * Cubre dos cosas distintas:
 *
 *  1. Que el cuerpo de las fichas sea alcanzable. Los 48 campos `richtext`
 *     —la prosa de cada servicio y proyecto— existían en la base desde el
 *     principio, pero el formulario de colección filtraba el tipo y ningún
 *     componente lo exponía con `data-cms-type`, así que no había ninguna
 *     ruta desde el panel hasta ellos.
 *  2. Que lo que se guarda siga siendo Markdown. Es la propiedad de la que
 *     depende el viaje de ida y vuelta a `src/content/<coleccion>/<slug>.md`: el CMS lee esos
 *     archivos con `matter.read` y los reescribe con `matter.stringify`, así
 *     que si el editor guardara HTML, cada guardado degradaría la ficha.
 *
 * Requiere los dos servidores en marcha, igual que el resto de specs del CMS.
 */
import { test, expect } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

async function apiLogin(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
}

/** Abre el formulario de la primera ficha de servicios. */
async function abrirPrimerServicio(page: import('@playwright/test').Page) {
  await page.goto('/?cms=1');
  await page.locator('.hm-cms-bar [data-action="collections"]').click();
  const panel = page.locator('.hm-cms-panel.open');
  await expect(panel).toBeVisible();
  await panel.locator('[data-action="edit-entry"]').first().click();
  return panel;
}

/**
 * Envía el formulario y espera a que el guardado termine.
 *
 * `saveEntryForm` hace un PATCH por campo y en serie —a propósito: en paralelo
 * se conflictuarían entre sí—, así que son nueve peticiones. Navegar antes de
 * que acaben las aborta a media lista y el campo parece no haberse guardado.
 * La señal de que terminó es que el panel vuelve a la lista de entradas.
 */
async function guardarYEsperar(panel: import('@playwright/test').Locator) {
  await panel.locator('button[type="submit"]').click();
  await expect(panel.locator('[data-action="edit-entry"]').first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('Editor de texto con formato', () => {
  test('el cuerpo de una ficha es alcanzable desde el panel', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);

    const editor = panel.locator('[data-richtext]');
    await expect(editor).toBeVisible();

    // El control que se envía es un textarea con el tipo declarado: es lo que
    // `saveEntryForm` usa para decidir cómo serializar el valor.
    const area = editor.locator('[data-richtext-input]');
    await expect(area).toHaveAttribute('data-field-type', 'richtext');
    await expect(area).toHaveAttribute('name', 'field:body');

    // Y trae contenido real, no un campo vacío.
    expect((await area.inputValue()).length).toBeGreaterThan(0);
  });

  test('la barra aplica formato Markdown sobre la selección', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);
    const editor = panel.locator('[data-richtext]');
    const area = editor.locator('[data-richtext-input]');

    await area.fill('Montaje de tubería forzada');
    // Selecciona «tubería» (posiciones 11-18).
    await area.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(11, 18));
    await editor.locator('[data-format="bold"]').click();
    expect(await area.inputValue()).toBe('Montaje de **tubería** forzada');

    // Pulsar de nuevo sobre la misma selección lo quita, en vez de acumular
    // marcas hasta dejar `****texto****`, que Markdown no interpreta.
    await editor.locator('[data-format="bold"]').click();
    expect(await area.inputValue()).toBe('Montaje de tubería forzada');
  });

  test('los prefijos de línea actúan sobre la línea entera', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);
    const editor = panel.locator('[data-richtext]');
    const area = editor.locator('[data-richtext-input]');

    await area.fill('Alcance del montaje');
    // Cursor a media palabra: el prefijo debe ir al principio de la línea.
    await area.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(4, 4));
    await editor.locator('[data-format="h2"]').click();
    expect(await area.inputValue()).toBe('## Alcance del montaje');
  });

  test('la vista previa muestra el resultado sin tocar lo guardado', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);
    const editor = panel.locator('[data-richtext]');
    const area = editor.locator('[data-richtext-input]');

    const markdown = '## Alcance\n\nMontaje de **tubería forzada**.\n\n- Soldadura ASME IX';
    await area.fill(markdown);
    await editor.locator('[data-action="rt-preview"]').click();

    const vista = editor.locator('[data-richtext-preview]');
    await expect(vista).toBeVisible();
    await expect(vista.locator('h2')).toHaveText('Alcance');
    await expect(vista.locator('strong')).toHaveText('tubería forzada');
    await expect(vista.locator('li')).toHaveText('Soldadura ASME IX');

    // Al volver a escribir, el valor es exactamente el que se tecleó: la vista
    // previa no reescribe el contenido.
    await editor.locator('[data-action="rt-preview"]').click();
    await expect(area).toBeVisible();
    expect(await area.inputValue()).toBe(markdown);
  });

  test('la vista previa no ejecuta lo que el operador escriba', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);
    const editor = panel.locator('[data-richtext]');
    const area = editor.locator('[data-richtext-input]');

    // El panel se pinta con la sesión de administración abierta, así que la
    // vista previa es una superficie de inyección si no escapa.
    await area.fill('<img src=x onerror="window.__xss=1"> y [pulsa](javascript:window.__xss=2)');
    await editor.locator('[data-action="rt-preview"]').click();
    await expect(editor.locator('[data-richtext-preview]')).toBeVisible();

    expect(
      await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)
    ).toBeUndefined();
    expect(await editor.locator('[data-richtext-preview] a').count()).toBe(0);
  });

  test('la barra se recorre con flechas, no con once tabulaciones', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);
    const barra = panel.locator('.hm-cms-rt-bar');

    // `role="toolbar"` promete navegación por flechas: un solo punto de entrada
    // con el tabulador y movimiento interno con las teclas de dirección.
    await expect(barra).toHaveAttribute('role', 'toolbar');
    expect(await barra.locator('.hm-cms-rt-btn[tabindex="0"]').count()).toBe(1);

    await barra.locator('[data-format="bold"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(barra.locator('[data-format="italic"]')).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(barra.locator('[data-format="bold"]')).toBeFocused();

    // Se envuelve por los extremos, y sigue habiendo un único punto de entrada.
    await page.keyboard.press('ArrowLeft');
    await expect(barra.locator('[data-action="rt-preview"]')).toBeFocused();
    expect(await barra.locator('.hm-cms-rt-btn[tabindex="0"]').count()).toBe(1);

    await page.keyboard.press('Home');
    await expect(barra.locator('[data-format="bold"]')).toBeFocused();
  });

  test('lo escrito se guarda como Markdown y sobrevive a reabrir el formulario', async ({
    page,
  }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);
    const area = panel.locator('[data-richtext-input]');

    const original = await area.inputValue();
    expect(original.length, 'la ficha debe traer cuerpo para poder restaurarlo').toBeGreaterThan(0);

    const marca = `\n\nNota de prueba **${Date.now()}**.`;

    try {
      await area.fill(original + marca);
      await guardarYEsperar(panel);

      // Se relee desde el servidor, no desde la pantalla.
      await abrirPrimerServicio(page);
      const recargado = await panel.locator('[data-richtext-input]').inputValue();
      expect(recargado).toBe(original + marca);
      // Markdown, no HTML: si el editor convirtiera, aquí habría <strong>.
      expect(recargado).toContain('**');
      expect(recargado).not.toContain('<strong>');
    } finally {
      // La ficha es contenido real del sitio: se deja como estaba pase lo que
      // pase, también si una aserción falla a mitad.
      await abrirPrimerServicio(page);
      await panel.locator('[data-richtext-input]').fill(original);
      await guardarYEsperar(panel);
      await abrirPrimerServicio(page);
      expect(await panel.locator('[data-richtext-input]').inputValue()).toBe(original);
    }
  });
});
