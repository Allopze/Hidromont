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
let espera;

export async function refrescarPendientes() {
  let datos;
  try {
    datos = await api('/api/cms/publish/pending');
  } catch {
    return; // Sin respuesta no se toca el distintivo: mejor viejo que falso.
  }
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
