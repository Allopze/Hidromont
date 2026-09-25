/**
 * «Editar esta ficha»: enlaza el botón de la barra con la entrada de la
 * página, si la página es la de un servicio o un proyecto; en las páginas
 * índice, con la ficha de sus datos para buscadores.
 *
 * Corre una vez por carga, en cuanto hay sesión. Si la búsqueda falla, el
 * botón sigue oculto: nunca ofrece una acción que no puede cumplir.
 */

import { api } from './api';
import { escapeHtml } from './html';
import { icon } from './icons';
import { fichaDePagina, fichaDeRuta } from './rutas';
import { shell } from './shell';

let estado = 'pendiente';

function mostrarBoton(entryId, kind, etiqueta) {
  shell.querySelectorAll('[data-page-entry]').forEach((boton) => {
    boton.dataset.entryId = entryId;
    boton.dataset.kind = kind;
    boton.innerHTML = `${icon('pencil')}${escapeHtml(etiqueta)}`;
    boton.hidden = false;
  });
}

export async function detectarFicha() {
  if (estado !== 'pendiente') return;
  const pagina = fichaDePagina(window.location.pathname);
  if (pagina) {
    estado = 'buscando';
    try {
      const entrada = await api(`/api/cms/entries/${encodeURIComponent(pagina.entryId)}`);
      mostrarBoton(entrada.id, entrada.kind, pagina.etiqueta);
      estado = 'lista';
    } catch (error) {
      // Sin la ficha en la base no se ofrece nada; si fue la red, se reintenta.
      estado = error?.status === 404 ? 'sin-ficha' : 'pendiente';
    }
    return;
  }
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
    mostrarBoton(entrada.id, ficha.kind, ficha.etiqueta);
    estado = 'lista';
  } catch {
    // Se reintentará en la próxima comprobación de sesión.
    estado = 'pendiente';
  }
}
