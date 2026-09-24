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
 * páginas. Ahora el editor vive en su propio archivo y solo se pide en el
 * subdominio `editor.*`; `?cms=1` queda disponible únicamente en desarrollo.
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

/**
 * Determina si el hostname actual corresponde a la interfaz de edición
 * (ej: `editor.hidromontchile.cl`, `editor.localhost`).
 */
export function isEditorHost(hostname: string): boolean {
  return hostname.startsWith('editor.');
}

/**
 * Lógica pura de decisión para activar el overlay:
 * 1. Si el host es un subdominio de edición (ej. `editor.hidromontchile.cl`), se activa siempre.
 * 2. En desarrollo, `?cms=1` o la marca local persistida permiten activar el overlay.
 * En builds de producción, ni la URL ni localStorage activan el CMS en el host público.
 */
export function shouldActivateOverlay(
  hostname: string,
  search: string,
  storedFlag: string | null,
  allowQueryActivation = false
): boolean {
  if (isEditorHost(hostname)) return true;
  if (!allowQueryActivation) return false;
  const params = new URLSearchParams(search);
  return params.get('cms') === '1' || storedFlag === '1';
}

export function startOverlay(): void {
  if (!CMS_EN_ESTE_BUILD) return;

  const hostname = window.location.hostname;
  const isEditor = isEditorHost(hostname);
  const allowQueryActivation = import.meta.env.DEV;
  const enabled = shouldActivateOverlay(
    hostname,
    window.location.search,
    allowQueryActivation && !isEditor ? window.localStorage.getItem('hidromont:cms') : null,
    allowQueryActivation
  );
  if (!enabled) return;

  // La persistencia solo existe en desarrollo. En producción el host editor.*
  // es la única condición que activa el overlay y no deja marcas en el dominio público.
  if (!isEditor && allowQueryActivation) {
    window.localStorage.setItem('hidromont:cms', '1');
  }

  void import('./mount').then(({ mount }) => mount());
}
