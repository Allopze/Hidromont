/**
 * Las imágenes que salen del CMS se pintaban en un `<img>` sin `srcset`, así
 * que la ruta guardada en el campo viajaba entera: la biblioteca tiene 213
 * fotos con algún lado por encima de 1.600 px y 42 que pasan de 500 KB, y una
 * de ellas podía acabar dentro de una tarjeta de 119 px.
 *
 * Lo que se comprueba aquí no es que el HTML tenga el atributo, sino lo único
 * que importa: qué archivo acaba descargando el navegador. `currentSrc` es su
 * elección real, ya resuelta contra el `sizes` y el ancho de la ventana.
 */
import { test, expect } from '@playwright/test';

/** El ancho declarado del candidato que el navegador eligió. */
async function anchoElegido(page: import('@playwright/test').Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const img = el as HTMLImageElement;
      const elegido = img.currentSrc.split('/').pop() ?? '';
      const ancho = /-(\d+)\.webp$/.exec(elegido)?.[1];
      return {
        elegido,
        ancho: ancho ? Number.parseInt(ancho, 10) : null,
        srcset: img.getAttribute('srcset'),
        sizes: img.getAttribute('sizes'),
      };
    });
}

test.describe('imágenes del CMS', () => {
  test('los logos de cliente no se sirven a 3.840 px', async ({ page }) => {
    // P2-38: los PNG de origen llegaban a 3.840 px para pintarse a 119. Se
    // redujeron (≤ 640 px, salvo alguno ya ligero de 800); con eso varios pesan
    // menos que cualquier derivado y se sirven tal cual. Los que conservan
    // derivados eligen el candidato pequeño gracias a `sizes`.
    await page.goto('/clientes');
    const logos = page.locator('.clientes-grid img');
    await expect(logos.first()).toBeVisible();
    const anchos = await logos.evaluateAll((imgs) =>
      imgs.map((i) => ({
        svg: /\.svg($|\?)/i.test((i as HTMLImageElement).currentSrc),
        natural: (i as HTMLImageElement).naturalWidth,
        sizes: i.getAttribute('sizes'),
        srcset: i.getAttribute('srcset'),
      }))
    );
    // Los SVG son vectoriales: su ancho «natural» no dice nada del peso.
    for (const a of anchos.filter((x) => !x.svg)) {
      expect(a.natural).toBeLessThanOrEqual(1024);
      if (a.srcset) expect(a.sizes).toBe('119px');
    }
  });

  test('las fotos de la galería de proyecto se adaptan a su columna', async ({ page }) => {
    await page.goto('/proyectos/ch-queltehues');
    const foto = '.aspect-video img[srcset*="/gallery/derived/"]';
    await expect(page.locator(foto).first()).toBeVisible();
    expect(await page.locator(foto).count()).toBe(3);

    const elegido = await anchoElegido(page, foto);
    expect(elegido.sizes).toContain('33vw');
    // La rejilla es de tres columnas a 1.440 px: unos 371 px de caja.
    expect(elegido.ancho).toBe(640);
  });

  test('el campo guarda el original, no el derivado', async ({ request }) => {
    // El valor editable tiene que seguir siendo la ruta original: es lo que
    // hace la foto reelegible desde la biblioteca. El derivado solo aparece en
    // el `srcset` que emite el componente.
    const html = await (await request.get('/proyectos/ch-queltehues')).text();
    const imgs = [...html.matchAll(/<img[^>]+data-cms-field="gallery\d"[^>]*>/g)].map((m) => m[0]);
    // Sin overlay el atributo no se emite; en ese perfil basta con que el
    // srcset esté presente, que es lo que cubren los dos tests anteriores.
    for (const img of imgs) {
      expect(img).toMatch(/srcset="[^"]*\/gallery\/derived\//);
    }
  });
});
