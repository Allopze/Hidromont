/**
 * «Editar esta ficha»: enlaza el botón de la barra con la entrada de la
 * página, si la página es la de un servicio o un proyecto.
 *
 * Corre una vez por carga, en cuanto hay sesión. Si la búsqueda falla, el
 * botón sigue oculto: nunca ofrece una acción que no puede cumplir.
 */

import { api } from './api';
import { escapeHtml } from './html';
import { icon } from './icons';
import { fichaDeRuta } from './rutas';
import { shell } from './shell';

let estado = 'pendiente';

export async function detectarFicha() {
  if (estado !== 'pendiente') return;
  const ficha = fichaDeRuta(window.location.pathname);
  if (!ficha) {
    estado = 'sin-ficha';
    return;
  }
  estado = 'buscando';
  try {
    const params = new URLSearchParams({ kind: ficha.kind, q: ficha.slug, limit: '100' });
    const data = await api(`/api/cms/entries?${params}`);
    const entrada = (data.entries || []).find((e) => e.slug === ficha.slug);
    if (!entrada) {
      estado = 'sin-ficha';
      return;
    }
    shell.querySelectorAll('[data-page-entry]').forEach((boton) => {
      boton.dataset.entryId = entrada.id;
      boton.dataset.kind = ficha.kind;
      boton.innerHTML = `${icon('pencil')}${escapeHtml(ficha.etiqueta)}`;
      boton.hidden = false;
    });
    estado = 'lista';
  } catch {
    // Se reintentará en la próxima comprobación de sesión.
    estado = 'pendiente';
  }
}
