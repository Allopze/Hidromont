import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Route } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';
const ADMIN_EMAIL = process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local';
const ADMIN_PASSWORD = process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe';
const SELECT_ALL = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

async function iniciarSesion(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  const response = await page.request.post(`${CMS_URL}/api/cms/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto('/?cms=1');
  if ((page.viewportSize()?.width ?? 1280) <= 640) {
    await expect(
      page.getByRole('button', { name: 'Abrir menú para editar el sitio' })
    ).toBeVisible();
  } else {
    await expect(page.locator('.hm-cms-bar [data-action="collections"]')).toBeVisible();
  }
}

test.describe('CMS UI/UX de edición', () => {
  test('estado del editor y jerarquía de acciones en paneles de 420 y 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    await iniciarSesion(page);

    const editable = page
      .locator('[data-cms-entry][data-cms-field][data-cms-type="text"]:visible')
      .first();
    await expect(editable).toBeVisible();
    await editable.click();

    const panel = page.locator('.hm-cms-panel.open');
    await expect(panel).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    const form = panel.locator('form[data-edit]');
    const input = form.locator('[name="value"]');
    const status = form.locator('[data-edit-status]');
    const save = form.getByRole('button', { name: 'Guardar' });
    const revisions = form.getByRole('button', { name: 'Revisiones' });
    const clear = form.getByRole('button', { name: 'Vaciar este texto' });
    const original = await input.inputValue();
    const updated = `${original} · revisión E2E ${Date.now()}`;

    await expect(status).toHaveText('Todo guardado.');
    // Una sola acción principal; las herramientas son discretas y «Vaciar» se
    // distingue como destructiva.
    await expect(save).not.toHaveClass(/secondary|ghost/);
    // «Exportar» se fue a Administración: en el editor de un campo solo
    // confundía con «Publicar cambios».
    await expect(form.getByRole('button', { name: 'Exportar' })).toHaveCount(0);
    await expect(revisions).toHaveClass(/ghost/);
    await expect(clear).toHaveClass(/destructive/);
    // «Vaciar» no comparte grupo con «Guardar».
    await expect(form.locator('.hm-cms-footer [data-action="clear-field"]')).toHaveCount(0);

    for (const width of [420, 390]) {
      await page.setViewportSize({ width, height: width === 420 ? 900 : 844 });
      const panelBox = await panel.boundingBox();
      expect(panelBox?.width).toBeCloseTo(width, 1);

      const saveBox = await save.boundingBox();
      const revisionBox = await revisions.boundingBox();
      const clearBox = await clear.boundingBox();
      expect(saveBox && revisionBox && clearBox).toBeTruthy();
      for (const box of [saveBox!, revisionBox!, clearBox!]) {
        expect(box.x).toBeGreaterThanOrEqual(panelBox!.x);
        expect(box.x + box.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
      }
      // Revisiones y Vaciar comparten la fila de herramientas; Guardar va
      // aparte, en el pie fijo, y se ve sin desplazarse.
      expect(clearBox!.y).toBe(revisionBox!.y);
      expect(saveBox!.y).toBeGreaterThan(revisionBox!.y);
      expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(panelBox!.y + panelBox!.height);
    }

    await input.fill(updated);
    await expect(status).toHaveText('Cambios sin guardar.');

    let releaseSave!: () => void;
    let resolvePausedRoute!: (route: Route) => void;
    let pausedOnce = false;
    const pauseSave = new Promise<Route>((resolve) => {
      resolvePausedRoute = resolve;
    });
    const continueSave = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const routeHandler = async (route: Route) => {
      if (route.request().method() === 'PATCH' && !pausedOnce) {
        pausedOnce = true;
        resolvePausedRoute(route);
        await continueSave;
      }
      await route.continue();
    };
    await page.route('**/api/cms/entries/*/fields/*', routeHandler);

    let saved = false;
    try {
      await save.click();
      await pauseSave;
      await expect(status).toHaveText('Guardando…');
      releaseSave();
      await expect(status).toContainText('Guardado.');
      saved = true;
    } finally {
      releaseSave();
      await page.unroute('**/api/cms/entries/*/fields/*', routeHandler);
      if (saved) {
        await input.fill(original);
        await save.click();
        await expect(status).toContainText('Guardado.');
      }
    }
  });
});

test.describe('CMS móvil táctil UI/UX', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('guías táctiles apagadas por defecto, alternables y accesibles', async ({ page }) => {
    await iniciarSesion(page);

    const editable = page.locator('[data-cms-editable-ready]').first();
    await expect(editable).toBeVisible();
    await expect(page.locator('body')).not.toHaveClass(/hm-cms-guides-visible/);
    expect(await editable.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe(
      'none'
    );

    await page.getByRole('button', { name: 'Abrir menú para editar el sitio' }).click();
    const menu = page.locator('#hm-cms-mobile-sheet');
    await expect(menu).toHaveAttribute('aria-hidden', 'false');
    const toggle = menu.getByRole('button', { name: 'Guías editables' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    for (let tab = 0; tab < 4; tab++) await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();

    const axe = await new AxeBuilder({ page }).include('.hm-cms-shell').analyze();
    expect(
      axe.violations
        .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        .map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))
    ).toEqual([]);

    await toggle.click();
    await expect(page.locator('body')).toHaveClass(/hm-cms-guides-visible/);
    await expect(menu.locator('[data-action="toggle-edit-guides"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(await editable.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe(
      'dashed'
    );

    await page.getByRole('button', { name: 'Abrir menú para editar el sitio' }).click();
    await menu.getByRole('button', { name: 'Guías editables' }).click();
    await expect(page.locator('body')).not.toHaveClass(/hm-cms-guides-visible/);
  });

  test('la búsqueda de categorías responde al teclado por nombre, slug y sin coincidencias', async ({
    page,
  }) => {
    await iniciarSesion(page);
    const categoriesResponse = await page.request.get(`${CMS_URL}/api/cms/gallery/categories`);
    expect(categoriesResponse.ok()).toBeTruthy();
    const categories = (await categoriesResponse.json()).items as Array<{
      name: string;
      slug: string;
    }>;
    expect(categories.length).toBeGreaterThan(0);
    const category = categories[0];

    await page.getByRole('button', { name: 'Abrir menú para editar el sitio' }).click();
    const menu = page.locator('#hm-cms-mobile-sheet');
    await expect(menu).toHaveAttribute('aria-hidden', 'false');
    await menu.getByRole('button', { name: 'Galería' }).click();
    await page
      .locator('.hm-cms-panel.open')
      .locator('.hm-cms-tab[data-action="gallery-cats"]')
      .click();

    const panel = page.locator('.hm-cms-panel.open');
    const search = panel.getByRole('searchbox', { name: 'Buscar categoría' });
    const count = panel.locator('[data-gallery-category-count]');
    // Desde la última pestaña, un Tab lleva al buscador.
    await panel.locator('.hm-cms-tab[data-action="gallery-cats"]').focus();
    await page.keyboard.press('Tab');
    await expect(search).toBeFocused();
    await page.keyboard.type(category.name);
    await expect(
      panel.locator('[data-gallery-category-row]', { hasText: category.name })
    ).toBeVisible();
    await expect(search).toBeFocused();
    await expect(count).toHaveText(/\d+ de \d+ categorías/);

    await search.press(SELECT_ALL);
    await page.keyboard.type(category.slug);
    await expect(
      panel.locator(
        '[data-gallery-category-row][data-gallery-search-text*="' + category.slug + '"]'
      )
    ).toBeVisible();

    await search.press(SELECT_ALL);
    await page.keyboard.type('sin-coincidencias-xyz');
    await expect(count).toHaveText(`0 de ${categories.length} categorías`);
    await expect(panel.locator('[data-gallery-category-empty]')).toContainText(
      'Ninguna categoría coincide'
    );

    await panel.locator('.hm-cms-tab[data-action="gallery-albums"]').click();
    const albumsResponse = await page.request.get(`${CMS_URL}/api/cms/gallery/albums`);
    expect(albumsResponse.ok()).toBeTruthy();
    const albums = (await albumsResponse.json()).items as Array<{ name: string; slug: string }>;
    expect(albums.length).toBeGreaterThan(0);
    const album = albums[0];
    const albumSearch = panel.getByRole('searchbox', { name: 'Buscar álbum' });
    const albumCount = panel.locator('[data-gallery-album-count]');

    // Desde la última pestaña, un Tab lleva al buscador.
    await panel.locator('.hm-cms-tab[data-action="gallery-cats"]').focus();
    await page.keyboard.press('Tab');
    await expect(albumSearch).toBeFocused();
    await page.keyboard.type(album.name);
    await expect(panel.locator('[data-gallery-album-row]', { hasText: album.name })).toBeVisible();
    await expect(albumSearch).toBeFocused();
    await expect(albumCount).toHaveText(/\d+ de \d+ álbumes/);

    await albumSearch.press(SELECT_ALL);
    await page.keyboard.type(album.slug);
    // El identificador ya no se muestra en la fila, pero sigue sirviendo para buscar.
    await expect(
      panel.locator('[data-gallery-album-row][data-gallery-search-text*="' + album.slug + '"]')
    ).toBeVisible();

    await albumSearch.press(SELECT_ALL);
    await page.keyboard.type('sin-coincidencias-xyz');
    await expect(albumCount).toHaveText(`0 de ${albums.length} álbumes`);
    await expect(panel.locator('[data-gallery-album-empty]')).toContainText(
      'Ningún álbum coincide'
    );
  });
});
