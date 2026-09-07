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

async function expectNoSeriousViolations(page: Page, label: string, include?: string) {
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
    ['jobs', 'CMS history'],
  ] as const) {
    await page.locator(`.hm-cms-bar [data-action="${action}"]`).click();
    await expect(page.locator('.hm-cms-panel.open')).toBeVisible();
    await expectNoSeriousViolations(page, label, '.hm-cms-shell');
  }
});
