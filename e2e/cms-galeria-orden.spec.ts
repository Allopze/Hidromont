/**
 * P2-25 (auditoría 2026-09): la API reordenaba fotos, álbumes y categorías,
 * pero el panel no lo ofrecía.
 */
import { test, expect, type Page } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';

async function entrar(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const csrf = (await res.json()).csrfToken as string;
  await page.goto('/?cms=1');
  await page.waitForSelector('body[data-cms-listo]', { state: 'attached' });
  return csrf;
}

const api = (page: Page, csrf: string) => ({
  get: async (ruta: string) => (await page.request.get(`${CMS_URL}${ruta}`)).json(),
  post: (ruta: string, data: unknown) =>
    page.request.post(`${CMS_URL}${ruta}`, {
      headers: { 'x-csrf-token': csrf, 'content-type': 'application/json' },
      data,
    }),
});

test('las categorías se ordenan con subir y bajar', async ({ page }) => {
  const csrf = await entrar(page);
  const a = api(page, csrf);
  const creadas: string[] = [];
  for (const nombre of ['Orden E2E Uno', 'Orden E2E Dos']) {
    const r = await a.post('/api/cms/gallery/categories', {
      name: nombre,
      slug: nombre.toLowerCase().replace(/\s+/g, '-'),
    });
    expect(r.ok()).toBeTruthy();
    creadas.push((await r.json()).id);
  }
  try {
    await page.locator('.hm-cms-bar [data-action="gallery"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('.hm-cms-tab[data-action="gallery-cats"]').click();
    await panel.getByRole('button', { name: 'Subir la categoría: Orden E2E Dos' }).click();
    await expect
      .poll(async () => {
        const ids = ((await a.get('/api/cms/gallery/categories')).items as { id: string }[]).map(
          (c) => c.id
        );
        return ids.indexOf(creadas[1]) < ids.indexOf(creadas[0]);
      })
      .toBe(true);
    // El foco sigue en el elemento movido.
    await expect(page.locator(':focus')).toHaveAttribute('data-clave', creadas[1]);
  } finally {
    for (const id of creadas) {
      await page.request.delete(`${CMS_URL}/api/cms/gallery/categories/${id}?confirm=1`, {
        headers: { 'x-csrf-token': csrf },
      });
    }
  }
});

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test('una foto se puede llevar al principio de la galería', async ({ page }) => {
  const csrf = await entrar(page);
  const a = api(page, csrf);
  const creadas: string[] = [];
  for (const n of [1, 2]) {
    const subida = await page.request.post(`${CMS_URL}/api/cms/media`, {
      headers: { 'x-csrf-token': csrf },
      multipart: {
        file: { name: `orden-e2e-${n}.png`, mimeType: 'image/png', buffer: PNG },
        alt: `Orden e2e ${n}`,
      },
    });
    expect(subida.ok()).toBeTruthy();
    const media = await subida.json();
    const item = await a.post('/api/cms/gallery/items', {
      mediaId: media.id ?? media.media?.id,
      alt: `Orden e2e ${n}`,
    });
    expect(item.ok()).toBeTruthy();
    creadas.push((await item.json()).id);
  }
  const antes = (await a.get('/api/cms/gallery/items')).items as { id: string }[];
  const ultima = antes.at(-1)!.id;
  try {
    await page.locator('.hm-cms-bar [data-action="gallery"]').click();
    const panel = page.locator('.hm-cms-panel.open');
    await panel.locator('.hm-cms-tab[data-action="gallery-items"]').click();
    const miniatura = panel.locator(`[data-action="gallery-edit-item"][data-item-id="${ultima}"]`);
    const ultimaAlt = (antes.at(-1) as { alt?: string }).alt ?? '';
    await panel.locator('[data-gallery-filter-q]').fill(ultimaAlt);
    await miniatura.click();
    const orden = panel.locator('[data-gallery-orden]');
    await expect(orden).toContainText(`Es la foto ${antes.length} de ${antes.length}`);
    await orden.getByRole('button', { name: 'Al principio' }).click();
    await expect(orden).toContainText(`Es la foto 1 de ${antes.length}`);
    const despues = (await a.get('/api/cms/gallery/items')).items as { id: string }[];
    expect(despues[0].id).toBe(ultima);
  } finally {
    for (const id of creadas) {
      await page.request.delete(`${CMS_URL}/api/cms/gallery/items/${id}`, {
        headers: { 'x-csrf-token': csrf },
      });
    }
  }
});
