/**
 * Fase 2 del plan de mejora (auditoría 2026-09-28).
 *
 * - M-02: si la respuesta de «Publicar» no llega (se cortó la conexión), la
 *   compilación sigue en el servidor. El panel consulta el historial y enseña
 *   el resultado real en vez de «No se pudo publicar». Al abrir el editor con
 *   una publicación en marcha, la enseña. El historial se simula: en el
 *   sandbox publicar de verdad compilaría el sitio entero.
 * - M-05: guardar una ficha que otra pestaña o persona cambió después de
 *   abrirla no pisa sus cambios.
 */
import { test, expect, type Page, type Route } from '@playwright/test';

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

const trabajo = (id: string, status: string) => ({
  id,
  action: 'publish',
  status,
  logs: [`${id} ${status}`],
  createdAt: new Date().toISOString(),
});

/** El historial devuelve `respuestas[n]` en la llamada n (y la última después). */
function historial(respuestas: unknown[][]) {
  let n = 0;
  return (route: Route) => {
    const items = respuestas[Math.min(n, respuestas.length - 1)];
    n += 1;
    return route.fulfill({ json: { items } });
  };
}

test.describe('M-02: el resultado real de la publicación', () => {
  test('si se corta la conexión, espera al servidor y enseña que sí se publicó', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await iniciarSesion(page);
    const viejo = trabajo('job-viejo', 'succeeded');
    await page.route(
      '**/api/cms/publish/jobs',
      historial([
        [viejo],
        [viejo],
        [trabajo('job-nuevo', 'running'), viejo],
        [trabajo('job-nuevo', 'succeeded'), viejo],
      ])
    );
    await page.route('**/api/cms/publish', (route) =>
      route.request().method() === 'POST' ? route.abort('connectionreset') : route.continue()
    );

    await page.goto('/?cms=1');
    await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
    await page.locator('.hm-cms-bar [data-action="publish"]').click();
    await page.locator('[data-publish-summary] [data-action="confirm-publish"]').click();

    await expect(page.locator('[data-publish-progress]')).toContainText(
      'Se perdió la conexión con el servidor'
    );
    const resultado = page.locator('[data-publish-result]');
    await expect(resultado).toHaveAttribute('data-publish-result', 'ok', { timeout: 30_000 });
    await expect(resultado).not.toContainText('No se pudo publicar');
  });

  test('si la publicación no llegó a empezar, lo dice como un fallo', async ({ page }) => {
    test.setTimeout(60_000);
    await iniciarSesion(page);
    const viejo = trabajo('job-viejo', 'succeeded');
    await page.route('**/api/cms/publish/jobs', historial([[viejo]]));
    await page.route('**/api/cms/publish', (route) =>
      route.request().method() === 'POST' ? route.abort('connectionreset') : route.continue()
    );

    await page.goto('/?cms=1');
    await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
    await page.locator('.hm-cms-bar [data-action="publish"]').click();
    await page.locator('[data-publish-summary] [data-action="confirm-publish"]').click();

    await expect(page.locator('[data-publish-result]')).toHaveAttribute(
      'data-publish-result',
      'error',
      { timeout: 30_000 }
    );
  });

  test('al abrir el editor con una publicación en marcha, la enseña hasta que termina', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await iniciarSesion(page);
    const enCurso = trabajo('job-otra-pestana', 'running');
    await page.route(
      '**/api/cms/publish/jobs',
      historial([[enCurso], [enCurso], [{ ...enCurso, status: 'succeeded' }]])
    );

    await page.goto('/?cms=1');
    await expect(page.locator('[data-publish-progress]')).toContainText(
      'Hay una publicación en marcha'
    );
    await expect(page.locator('[data-publish-result]')).toHaveAttribute(
      'data-publish-result',
      'ok',
      { timeout: 30_000 }
    );
  });
});

test('M-05: guardar una ficha que otro cambió después de abrirla no pisa sus cambios', async ({
  page,
}) => {
  const csrf = await iniciarSesion(page);
  const url = `${CMS_URL}/api/cms/entries/servicios.compuertas`;
  const original = (await (await page.request.get(url)).json()).fields.resumen.value as string;
  const delOtro = `${original} (cambio de otra pestaña)`;

  try {
    await page.goto('/?cms=1');
    await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
    await page.locator('.hm-cms-bar [data-action="collections"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('.hm-cms-tab[data-action="tab-kind"][data-kind="servicio"]').click();
    await panel
      .locator('[data-action="edit-entry"][data-entry-id="servicios.compuertas"]')
      .first()
      .click();
    const ficha = panel.locator('form[data-entry-form]');
    await expect(ficha).toBeVisible();

    // Otra pestaña guarda la misma ficha mientras esta sigue abierta.
    const otro = await page.request.patch(`${url}/fields/resumen`, {
      headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
      data: { value: delOtro },
    });
    expect(otro.ok()).toBeTruthy();

    await ficha.locator('[name="field:resumen"]').fill(`${original} (cambio de esta pestaña)`);
    await ficha.locator('button[type="submit"]').click();

    await expect(panel.locator('[data-status]')).toContainText('cambió desde que la abriste');
    await expect(panel.getByRole('button', { name: 'Volver a abrir la ficha' })).toBeVisible();
    const guardado = (await (await page.request.get(url)).json()).fields.resumen.value;
    expect(guardado).toBe(delOtro);
  } finally {
    await page.request.patch(`${url}/fields/resumen`, {
      headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
      data: { value: original },
    });
  }
});
