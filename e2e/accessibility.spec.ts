import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Tiene que coincidir con PUBLIC_CMS_API_BASE (localhost:8787), que es a donde
// el overlay pide la sesión desde el navegador. Con 127.0.0.1 el login sí
// devuelve 200, pero la cookie queda asociada a otro host: para el navegador
// 127.0.0.1 y localhost son sitios distintos, así que no se envía y el overlay
// se queda sin autenticar con los botones en hidden.
const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

/**
 * Espera a que la página esté pintada de verdad antes de medir.
 *
 * `page.goto` resuelve con el evento `load`, que no garantiza que las imágenes
 * decodificadas ya estén compuestas ni que las tipografías web hayan
 * reemplazado a la de respaldo. axe calcula el contraste muestreando lo que hay
 * detrás del elemento, así que el botón sobre el hero salía marcado como
 * violación seria de `color-contrast` de forma intermitente —según si la foto
 * había pintado o no— y el mismo test pasaba al repetirlo. Es la misma causa
 * que ya obligó a acotar las escenas del CMS con `include`, y aquí no se puede
 * acotar porque lo que se quiere medir es la página entera.
 *
 * No se espera imagen por imagen: las de `loading="lazy"` bajo el pliegue no
 * disparan `load` hasta que se hace scroll, así que hacerlo colgaba el test
 * hasta el timeout. `networkidle` cubre las que sí carga la página de entrada,
 * que son las que están detrás de lo que axe mide, y su fallo no es motivo
 * para tumbar el test.
 */
async function esperarPintado(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Dos cuadros: el primero aplica el layout con las tipografías reales, el
    // segundo garantiza que ya se compuso.
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  });
}

async function expectNoSeriousViolations(page: Page, label: string, include?: string) {
  await esperarPintado(page);
  const builder = new AxeBuilder({ page });
  // Las escenas del CMS se acotan al overlay. Analizar la página entera hacía
  // que el resultado dependiera de cómo hubiera compuesto el navegador el hero
  // detrás de la barra flotante, y el botón del hero salía marcado por
  // contraste de forma intermitente. La página pública ya tiene sus propios
  // casos más abajo, así que acotar no pierde cobertura.
  if (include) builder.include(include);
  const results = await builder.analyze();
  const violations = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical'
  );
  expect(
    violations.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      targets: nodes.map((node) => node.target),
    })),
    `${label} has serious or critical accessibility violations`
  ).toEqual([]);
}

for (const path of [
  '/',
  '/clientes',
  '/contacto',
  '/galeria',
  '/servicios',
  '/proyectos',
  '/proyectos/ch-los-condores',
  '/404.html',
  '/contacto/gracias',
]) {
  test(`axe public ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoSeriousViolations(page, path);
  });
}

test('axe CMS login scene', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/?cms=1');
  await expect(page.locator('form[data-login]')).toBeVisible();
  await expectNoSeriousViolations(page, 'CMS login', '.hm-cms-shell');
});

test('axe CMS collections, gallery and history scenes', async ({ page }) => {
  const login = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  await page.goto('/?cms=1');

  for (const [action, label] of [
    ['collections', 'CMS collections'],
    ['gallery', 'CMS gallery'],
    ['publish', 'CMS publish summary'],
  ] as const) {
    await page.locator(`.hm-cms-bar [data-action="${action}"]`).click();
    await expect(page.locator('.hm-cms-panel.open')).toBeVisible();
    await expectNoSeriousViolations(page, label, '.hm-cms-shell');
  }

  // Historial vive en el menú «Más»: se revisa también el menú abierto.
  await page.locator('.hm-cms-panel-head [data-action="close"]').click();
  await page.locator('.hm-cms-bar [data-action="bar-menu"]').click();
  await expect(page.locator('#hm-cms-bar-menu')).toBeVisible();
  await expectNoSeriousViolations(page, 'CMS bar menu', '.hm-cms-shell');
  await page.locator('.hm-cms-bar [data-action="jobs"]').click();
  await expect(page.locator('.hm-cms-panel.open')).toBeVisible();
  await expectNoSeriousViolations(page, 'CMS history', '.hm-cms-shell');
});

/**
 * WCAG 2.2 SC 2.5.8 — tamaño del objetivo (AA): 24×24 px como mínimo.
 *
 * axe no cubre esta regla en su conjunto por defecto, así que era el último
 * incumplimiento AA que quedaba en el sitio y nada lo detectaba: los enlaces
 * del pie medían 17 px de alto y en móvil ese pie es la navegación
 * secundaria principal.
 */
const RUTAS_OBJETIVO = [
  '/',
  '/servicios',
  '/proyectos',
  '/galeria',
  '/contacto',
  '/clientes',
  '/empresa',
];

for (const width of [375, 1440]) {
  test(`todos los controles miden al menos 24x24 px a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const pequenos: string[] = [];

    for (const ruta of RUTAS_OBJETIVO) {
      await page.goto(ruta);
      // El pie es un acordeón cerrado en móvil: sin abrirlo no se miden sus
      // enlaces, que son justo los que incumplían.
      await page.evaluate(() =>
        document.querySelectorAll<HTMLDetailsElement>('.footer-section').forEach((d) => {
          d.open = true;
        })
      );
      await page.waitForTimeout(150);

      const encontrados = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll('a,button,input,select,[role=button]')) {
          const box = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (box.width === 0 || box.height === 0) continue;
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          // El skip-link es sr-only hasta recibir el foco: su caja de 1×1 no
          // es un objetivo real.
          if (String(el.className).includes('sr-only')) continue;
          if (box.width < 24 || box.height < 24) {
            const etiqueta = (el.textContent || el.getAttribute('aria-label') || '').trim();
            out.push(
              `${el.tagName.toLowerCase()} "${etiqueta.slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`
            );
          }
        }
        return out;
      });
      pequenos.push(...encontrados.map((e) => `${ruta}: ${e}`));
    }

    expect([...new Set(pequenos)]).toEqual([]);
  });
}
