/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

export const config = window.__HIDROMONT_CMS__ || {};

export const apiBase = config.apiBase || `${location.protocol}//${location.hostname}:8787`;

export const state = {
  csrfToken: '',
  selected: null,
  entry: null,
  mediaItems: [],
};
