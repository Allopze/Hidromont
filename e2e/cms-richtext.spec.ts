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
 * P2-23 (auditoría 2026-09): se escribe en un editor visual, sin ver
 * Markdown, y lo que se guarda sigue siendo Markdown. Si un cuerpo trae algo
 * que el editor visual no sabe reproducir, se abre el de texto.
 *
 * Requiere los dos servidores en marcha, igual que el resto de specs del CMS.
 */
import { test, expect, type Page, type Locator } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

async function apiLogin(page: import('@playwright/test').Page) {
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).csrfToken as string;
}

/** Abre el formulario de la primera ficha de servicios. */
async function abrirPrimerServicio(page: import('@playwright/test').Page) {
  await page.goto('/?cms=1');
  await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
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
 * La señal de que terminó es el estado de guardado del formulario, que
 * permanece abierto para conservar el contexto de edición.
 */
async function guardarYEsperar(panel: import('@playwright/test').Locator) {
  await panel.locator('button[type="submit"]').click();
  await expect(panel.locator('[data-entry-form] [data-status]')).toHaveText(/^Guardado\./, {
    timeout: 15_000,
  });
}

/** Selecciona `texto` dentro del editor visual, como haría el ratón. */
async function seleccionar(visual: Locator, texto: string) {
  await visual.evaluate((el, buscado) => {
    const recorrido = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let nodo: Node | null;
    while ((nodo = recorrido.nextNode())) {
      const i = nodo.textContent!.indexOf(buscado);
      if (i >= 0) {
        const rango = document.createRange();
        rango.setStart(nodo, i);
        rango.setEnd(nodo, i + buscado.length);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(rango);
        return;
      }
    }
    throw new Error(`No está «${buscado}»`);
  }, texto);
}

/** Vacía el editor visual y escribe `texto`. */
async function escribir(page: Page, visual: Locator, texto: string) {
  await visual.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type(texto);
}

async function cuerpoDelPrimerServicio(page: Page) {
  const panel = await abrirPrimerServicio(page);
  const id = (await panel.locator('[data-entry-form]').getAttribute('data-entry-id'))!;
  const entrada = await (await page.request.get(`${CMS_URL}/api/cms/entries/${id}`)).json();
  return { id, body: entrada.fields.body.value as string };
}

test.describe('Editor de texto con formato', () => {
  test('el cuerpo de una ficha se edita en un editor visual', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);

    const editor = panel.locator('[data-richtext]');
    await expect(editor).toHaveAttribute('data-richtext-modo', 'visual');
    const visual = editor.locator('[data-richtext-visual]');
    await expect(visual).toBeVisible();
    await expect(visual).toHaveAttribute('role', 'textbox');
    await expect(visual).toHaveAccessibleName(/Cuerpo|Texto|Contenido/);

    // Lo que se envía sigue siendo el textarea, con el tipo declarado.
    const area = editor.locator('[data-richtext-input]');
    await expect(area).toBeHidden();
    await expect(area).toHaveAttribute('data-field-type', 'richtext');
    await expect(area).toHaveAttribute('name', 'field:body');
    expect((await area.inputValue()).length).toBeGreaterThan(0);

    // Sin símbolos de Markdown a la vista, ni jerga en la barra.
    expect(await visual.innerText()).not.toMatch(/^#{2,3} |\*\*/m);
    await expect(editor.locator('[data-format="code"]')).toHaveCount(0);
    await expect(editor.locator('[data-format="h2"]')).toHaveText('Título');
    await expect(editor.locator('[data-format="h3"]')).toHaveText('Subtítulo');
  });

  test('negrita y títulos se aplican sin ver símbolos y se guardan como Markdown', async ({
    page,
  }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);
    const editor = panel.locator('[data-richtext]');
    const visual = editor.locator('[data-richtext-visual]');
    const area = editor.locator('[data-richtext-input]');

    await escribir(page, visual, 'Montaje de tubería forzada');
    await seleccionar(visual, 'tubería');
    await editor.locator('[data-format="bold"]').click();
    await expect(visual.locator('b, strong')).toHaveText('tubería');
    expect(await area.inputValue()).toBe('Montaje de **tubería** forzada');

    await seleccionar(visual, 'tubería');
    await editor.locator('[data-format="bold"]').click();
    expect(await area.inputValue()).toBe('Montaje de tubería forzada');

    await editor.locator('[data-format="h2"]').click();
    await expect(visual.locator('h2')).toHaveText('Montaje de tubería forzada');
    expect(await area.inputValue()).toBe('## Montaje de tubería forzada');
    // Pulsarlo otra vez lo devuelve a párrafo.
    await editor.locator('[data-format="h2"]').click();
    expect(await area.inputValue()).toBe('Montaje de tubería forzada');
  });

  test('el enlace se pone con un diálogo de texto y dirección', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);
    const editor = panel.locator('[data-richtext]');
    const visual = editor.locator('[data-richtext-visual]');
    const area = editor.locator('[data-richtext-input]');

    await escribir(page, visual, 'Escríbanos para cotizar');
    await seleccionar(visual, 'Escríbanos');
    await editor.locator('[data-format="link"]').click();
    const dialogo = editor.locator('[data-rt-enlace]');
    await expect(dialogo.locator('[data-rt-enlace-texto]')).toHaveValue('Escríbanos');

    await dialogo.locator('[data-rt-enlace-href]').fill('javascript:alert(1)');
    await dialogo.getByRole('button', { name: 'Poner enlace' }).click();
    await expect(dialogo).toContainText('La dirección debe empezar por');

    await dialogo.locator('[data-rt-enlace-href]').fill('/contacto');
    await dialogo.locator('[data-rt-enlace-href]').press('Enter');
    await expect(dialogo).toHaveCount(0);
    // Intro puso el enlace; no envió el formulario de la ficha.
    await expect(panel.locator('[data-entry-form] [data-status]')).not.toHaveText(/Guardado/);
    expect(await area.inputValue()).toBe('[Escríbanos](/contacto) para cotizar');
  });

  test('lo que no sabe reproducir se abre en el editor de texto', async ({ page }) => {
    const csrf = await apiLogin(page);
    const { id, body } = await cuerpoDelPrimerServicio(page);
    const patch = (value: string) =>
      page.request.patch(`${CMS_URL}/api/cms/entries/${id}/fields/body`, {
        headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
        data: { value },
      });
    try {
      expect((await patch(`${body}\n\n![foto](/x.jpg)\n\n***`)).ok()).toBeTruthy();
      const panel = await abrirPrimerServicio(page);
      const editor = panel.locator('[data-richtext]');
      await expect(editor).toHaveAttribute('data-richtext-modo', 'texto');
      await expect(editor.locator('textarea[data-richtext-input]')).toBeVisible();
    } finally {
      await patch(body);
    }
  });

  test('la vista previa del editor de texto no ejecuta lo que se escriba', async ({ page }) => {
    const csrf = await apiLogin(page);
    const { id, body } = await cuerpoDelPrimerServicio(page);
    const patch = (value: string) =>
      page.request.patch(`${CMS_URL}/api/cms/entries/${id}/fields/body`, {
        headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
        data: { value },
      });
    try {
      await patch('<img src=x onerror="window.__xss=1"> y [pulsa](javascript:window.__xss=2)');
      const panel = await abrirPrimerServicio(page);
      const editor = panel.locator('[data-richtext]');
      const zona = editor.locator('[data-richtext-visual], [data-richtext-preview]').first();
      if ((await editor.getAttribute('data-richtext-modo')) === 'texto') {
        await editor.locator('[data-action="rt-preview"]').click();
      }
      await expect(zona).toBeVisible();
      expect(
        await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)
      ).toBeUndefined();
      expect(await zona.locator('a, img').count()).toBe(0);
    } finally {
      await patch(body);
    }
  });

  test('la barra se recorre con flechas, no con una tabulación por botón', async ({ page }) => {
    await apiLogin(page);
    const panel = await abrirPrimerServicio(page);
    const barra = panel.locator('.hm-cms-rt-bar');

    await expect(barra).toHaveAttribute('role', 'toolbar');
    expect(await barra.locator('.hm-cms-rt-btn[tabindex="0"]').count()).toBe(1);

    await barra.locator('[data-format="bold"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(barra.locator('[data-format="italic"]')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(barra.locator('[data-format="bold"]')).toBeFocused();

    // Se envuelve por los extremos, y sigue habiendo un único punto de entrada.
    await page.keyboard.press('ArrowLeft');
    await expect(barra.locator('[data-format="link"]')).toBeFocused();
    expect(await barra.locator('.hm-cms-rt-btn[tabindex="0"]').count()).toBe(1);

    await page.keyboard.press('Home');
    await expect(barra.locator('[data-format="bold"]')).toBeFocused();
  });

  test('lo escrito se guarda como Markdown y sobrevive a reabrir el formulario', async ({
    page,
  }) => {
    const csrf = await apiLogin(page);
    const { id, body: original } = await cuerpoDelPrimerServicio(page);
    const panel = await abrirPrimerServicio(page);
    const visual = panel.locator('[data-richtext-visual]');
    const marca = String(Date.now());

    try {
      // El cursor al final del texto (Ctrl+Fin no existe en macOS).
      await visual.evaluate((el) => {
        el.focus();
        const rango = document.createRange();
        rango.selectNodeContents(el);
        rango.collapse(false);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(rango);
      });
      await page.keyboard.press('Enter');
      await page.keyboard.type('Nota de prueba ');
      await page.keyboard.press('ControlOrMeta+B');
      await page.keyboard.type(marca);
      await guardarYEsperar(panel);

      // Se relee desde el servidor, no desde la pantalla.
      const guardado = await (await page.request.get(`${CMS_URL}/api/cms/entries/${id}`)).json();
      const valor = guardado.fields.body.value as string;
      expect(valor.endsWith(`\n\nNota de prueba **${marca}**`)).toBe(true);
      expect(valor).not.toContain('<strong>');
      expect(valor).not.toContain('<b>');

      await abrirPrimerServicio(page);
      await expect(
        panel.locator('[data-richtext-visual] b, [data-richtext-visual] strong').last()
      ).toHaveText(marca);
    } finally {
      // La ficha es contenido real del sitio: se deja como estaba.
      await page.request.patch(`${CMS_URL}/api/cms/entries/${id}/fields/body`, {
        headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
        data: { value: original },
      });
    }
  });
});
