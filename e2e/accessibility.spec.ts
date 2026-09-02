import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://127.0.0.1:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

async function expectNoSeriousViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
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
  await expectNoSeriousViolations(page, 'CMS login');
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
    await expectNoSeriousViolations(page, label);
  }
});
