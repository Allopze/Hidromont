/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

import { apiBase, state } from './context';
// Reexportado por comodidad: el estado de los botones vive en `submit.js`,
// que no depende de `window` y por eso sí se puede probar en Node.
export { ejecutarUnaVez, estaOcupado, setButtonLoading } from './submit';

export async function api(path, options = {}) {
  const headers = options.headers || {};
  if (state.csrfToken && options.method && options.method !== 'GET') {
    headers['X-CSRF-Token'] = state.csrfToken;
  }
  const response = await fetch(`${apiBase}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // P0-D: el status y el detalle estructurado se pierden si solo se
    // propaga el mensaje. Los necesitan A-1 (campos inválidos), A-3
    // (distinguir el 409 de conflicto de edición) y B-1.
    throw Object.assign(new Error(data.error || 'Error CMS'), {
      status: response.status,
      details: data.details,
      // M-2: el servidor manda Retry-After en el 429 del rate-limit y
      // nadie lo leía, así que el aviso decía «espere» sin decir cuánto.
      retryAfter: Number(response.headers.get('Retry-After')) || undefined,
    });
  }
  return data;
}
