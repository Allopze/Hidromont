// @ts-check
/**
 * El contador de la barra: «3 cambios sin publicar».
 *
 * Antes el distintivo solo sabía de los cambios hechos en esa pestaña: al
 * recargar desaparecía aunque nada se hubiera publicado, y quien volvía al día
 * siguiente no tenía forma de saber que faltaba publicar. Ahora lo pregunta al
 * servidor al entrar y cada vez que algo se guarda.
 */

import { api } from './api';
import { estadoGlobal, setGlobalState } from './shell';

let iniciado = false;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let espera;

export async function refrescarPendientes() {
  let datos;
  try {
    datos = await api('/api/cms/publish/pending');
  } catch {
    return; // Sin respuesta no se toca el distintivo: mejor viejo que falso.
  }
  mostrarGuardadoSinPublicar(datos).catch(() => {});
  if (datos.total > 0) {
    setGlobalState('pending', { total: datos.total });
  } else if (['pending', 'unsaved'].includes(estadoGlobal())) {
    // Solo se apaga lo que decía «pendiente»; «Sitio actualizado» se queda.
    setGlobalState(null);
  }
}

/** Se llama al confirmar la sesión. La primera vez, cuenta y se suscribe. */
export function iniciarPendientes() {
  if (iniciado) return;
  iniciado = true;
  refrescarPendientes();
  // shell.js avisa cada vez que algo se guarda (setGlobalState('unsaved')).
  document.addEventListener('hm-cms:cambio', () => {
    clearTimeout(espera);
    espera = setTimeout(refrescarPendientes, 400);
  });
}

/**
 * P2-17 (auditoría 2026-09): la página es el sitio publicado, así que al
 * recargar lo guardado «desaparecía» (el título volvía al publicado mientras
 * el editor mostraba el guardado) y la persona creía que se había perdido.
 * Con sesión, los textos guardados y sin publicar de las fichas que aparecen
 * en esta página se pintan con su valor guardado y una marca «Guardado, sin
 * publicar». Solo textos de una línea o de párrafo: las fotos y el cuerpo con
 * formato se siguen viendo al publicar.
 */
const yaPintadas = new Set();
/** @param {{ cambios?: Array<{ entryId?: string }> } | undefined} datos */
async function mostrarGuardadoSinPublicar(datos) {
  for (const cambio of datos?.cambios ?? []) {
    const id = cambio.entryId;
    if (!id) continue;
    const selector = `[data-cms-entry="${CSS.escape(id)}"][data-cms-field]`;
    const nodos = [
      .../** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(selector)),
    ].filter((el) => ['text', 'textarea'].includes(el.dataset.cmsType || 'text'));
    if (!nodos.length) continue;
    let entry;
    try {
      entry = await api(`/api/cms/entries/${encodeURIComponent(id)}`);
    } catch {
      continue;
    }
    for (const el of nodos) {
      const campo = el.dataset.cmsField;
      if (!campo) continue;
      const valor = entry.fields?.[campo]?.value;
      if (typeof valor !== 'string' || !valor.trim()) continue;
      if (el.textContent.trim() === valor.trim()) continue;
      el.textContent = valor;
      el.classList.add('hm-cms-sin-publicar');
      el.setAttribute('title', 'Guardado, sin publicar: así se verá al publicar');
      yaPintadas.add(el);
    }
  }
}

/** Tras publicar, las marcas sobran: la página ya es la publicada. */
export function limpiarMarcasSinPublicar() {
  for (const el of yaPintadas) {
    el.classList.remove('hm-cms-sin-publicar');
    el.removeAttribute('title');
  }
  yaPintadas.clear();
}
