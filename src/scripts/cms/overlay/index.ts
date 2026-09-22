/**
 * Punto de entrada del overlay del CMS.
 *
 * Este archivo es lo único que `CmsOverlay.astro` importa, y a propósito es
 * diminuto: decide si el overlay corresponde y solo entonces carga el resto.
 *
 * El `import()` dinámico no es cosmético. Con `PUBLIC_ENABLE_CMS=1` —que es
 * como corre en el VPS, porque el sitio y el editor los sirve el mismo
 * proceso— antes TODO el overlay viajaba incrustado en el HTML de cada
 * página: un visitante cualquiera descargaba y parseaba el editor entero para
 * no usarlo nunca. El HTML del build pasó de 5,5 MB a 1,6 MB en las 27
 * páginas. Ahora el editor vive en su propio archivo y solo se pide cuando
 * alguien escribe `?cms=1`.
 */

/**
 * La misma condición que aplica `BaseLayout` al decidir si pinta el
 * componente, repetida aquí a propósito.
 *
 * Allí mantiene limpio el HTML; aquí mantiene limpio el JavaScript. Vite
 * sustituye estas dos expresiones por literales al compilar, así que en el
 * perfil público el `return` queda incondicional, el `import()` de abajo se
 * vuelve inalcanzable y Rollup no llega a emitir el fragmento del editor.
 *
 * Sin esto el chunk se emitía igualmente —sin que ninguna página lo
 * enlazara, pero descargable por URL—, porque Astro empaqueta los `<script>`
 * de un componente por análisis estático, antes de saber si va a renderizarse.
 */
const CMS_EN_ESTE_BUILD = import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_CMS === '1';

export function startOverlay(): void {
  if (!CMS_EN_ESTE_BUILD) return;

  const params = new URLSearchParams(window.location.search);
  const enabled = params.get('cms') === '1' || window.localStorage.getItem('hidromont:cms') === '1';
  if (!enabled) return;
  window.localStorage.setItem('hidromont:cms', '1');

  void import('./mount').then(({ mount }) => mount());
}
