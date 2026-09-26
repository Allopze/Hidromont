// @ts-check
/**
 * Estado de los controles de escritura del panel: el spinner del botón y la
 * guarda contra el doble envío.
 *
 * Vive aparte de `api.js` a propósito. `api.js` lee `window.__HIDROMONT_CMS__`
 * al importarse (vía `context.js`), así que no se puede cargar en un test de
 * Node. Esto es lógica de estado y se prueba sin navegador, igual que
 * `markdown.ts` y `mobile-menu.ts`.
 */

import { escapeHtml } from './html';

/**
 * @param {any} button
 * @param {boolean} isLoading
 * @param {string} [loadingText]
 */
export function setButtonLoading(button, isLoading, loadingText = '') {
  // Se comprueba la capacidad, no `instanceof Element`: así el módulo se puede
  // cargar y probar en Node, donde `Element` no existe. El efecto en el
  // navegador es el mismo.
  if (!button || typeof button.closest !== 'function') return;
  const btn = button.closest('button');
  if (!btn) return;
  if (isLoading) {
    if (!btn.hasAttribute('data-orig-html')) {
      btn.setAttribute('data-orig-html', btn.innerHTML);
    }
    btn.setAttribute('data-loading', 'true');
    btn.disabled = true;
    const label = loadingText || btn.textContent.trim();
    btn.innerHTML = `<span class="hm-cms-spinner"></span>${escapeHtml(label)}`;
  } else {
    btn.removeAttribute('data-loading');
    btn.disabled = false;
    const orig = btn.getAttribute('data-orig-html');
    if (orig) {
      btn.innerHTML = orig;
      btn.removeAttribute('data-orig-html');
    }
  }
}

/**
 * Ejecuta una operación de escritura una sola vez, aunque se dispare dos
 * veces.
 *
 * La guarda va en el FLUJO, no en el estado del botón. Hasta ahora la única
 * protección era el `disabled` que pone `setButtonLoading`, y eso solo cubre
 * el clic: deja fuera el envío por Enter y cualquier camino que no pase por
 * ese botón. Un inventario del panel dio 4 de 7 formularios y 5 de 11 acciones
 * de escritura protegidos; el resto podía dispararse dos veces. En el
 * formulario de imagen eso duplicaba la subida del archivo.
 *
 * `ambito` es el elemento cuyo `dataset.busy` marca el trabajo en curso —el
 * `<form>`, o el contenedor de la acción. `boton` es opcional: si se pasa,
 * recibe el spinner.
 *
 * Restaura SIEMPRE en `finally`. Varias llamadas del panel lo hacían solo en
 * el `catch` y dependían de un repintado para el camino feliz: si ese
 * repintado fallaba, el botón se quedaba colgado en «Respaldando...» para
 * siempre.
 *
 * Devuelve `undefined` sin llegar a ejecutar si ya había una operación viva.
 *
 * @template T
 * @param {{ dataset: Record<string, string> } | null | undefined} ambito
 * @param {() => Promise<T>} tarea
 * @param {{ boton?: unknown, textoCarga?: string }} [opciones]
 * @returns {Promise<T | undefined>}
 */
export async function ejecutarUnaVez(ambito, tarea, { boton, textoCarga = '' } = {}) {
  if (!ambito || ambito.dataset.busy === 'true') return undefined;
  ambito.dataset.busy = 'true';
  if (boton) setButtonLoading(boton, true, textoCarga);
  try {
    return await tarea();
  } finally {
    delete ambito.dataset.busy;
    // El repintado puede haber destruido el botón; setButtonLoading ya lo
    // tolera (sale sin hacer nada si no encuentra el <button>).
    if (boton) setButtonLoading(boton, false);
  }
}

/**
 * ¿Hay una escritura en curso dentro de este ámbito?
 *
 * @param {{ dataset?: Record<string, string> } | null | undefined} ambito
 */
export function estaOcupado(ambito) {
  return ambito?.dataset?.busy === 'true';
}
