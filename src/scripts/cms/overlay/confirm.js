/**
 * Confirmaciones con el aspecto del panel.
 *
 * Sustituyen a `window.confirm`, que había en seis sitios. La ventana nativa
 * rompía la experiencia en tres frentes: salía con el nombre del host como
 * título («localhost:4321 dice…»), no admitía jerarquía —la acción peligrosa y
 * la segura con el mismo peso— y en móvil tapaba la página con un cuadro del
 * sistema ajeno a la herramienta.
 *
 * Vive en el shell, no en el panel: `openPanel` reemplaza el cuerpo del panel
 * entero y un diálogo dentro moriría con él. El aviso del navegador al salir
 * con cambios (`beforeunload`) sigue siendo nativo: no se puede sustituir.
 */

import { escapeHtml } from './html';
import { icon } from './icons';
import { shell } from './shell';

let abierto = null;

/** ¿Hay una confirmación en pantalla? El Escape del panel la respeta. */
export function hayConfirmacionAbierta() {
  return abierto !== null;
}

/**
 * @param {{
 *   titulo: string,
 *   mensaje?: string,
 *   aceptar?: string,
 *   cancelar?: string,
 *   peligro?: boolean,
 * }} opciones
 * @returns {Promise<boolean>}
 */
export function confirmar({
  titulo,
  mensaje = '',
  aceptar = 'Aceptar',
  cancelar = 'Cancelar',
  peligro = false,
}) {
  // Una sola a la vez: la segunda cancela la primera en vez de apilarse.
  abierto?.resolver(false);

  const anterior = document.activeElement;
  const capa = document.createElement('div');
  capa.className = 'hm-cms-dialog-layer';
  capa.setAttribute('data-cms-dialog', '');
  const parrafos = String(mensaje)
    .split(/\n{2,}|\n/)
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
  capa.innerHTML = `
    <div class="hm-cms-dialog${peligro ? ' is-danger' : ''}" role="alertdialog" aria-modal="true"
      aria-labelledby="hm-cms-dialog-titulo" aria-describedby="hm-cms-dialog-mensaje">
      <div class="hm-cms-dialog-icon">${icon(peligro ? 'alert' : 'info', { size: 20 })}</div>
      <div class="hm-cms-dialog-body">
        <h2 id="hm-cms-dialog-titulo">${escapeHtml(titulo)}</h2>
        <div id="hm-cms-dialog-mensaje">${parrafos}</div>
      </div>
      <div class="hm-cms-dialog-actions">
        <button type="button" class="secondary" data-dialog-cancel>${escapeHtml(cancelar)}</button>
        <button type="button" class="${peligro ? 'destructive strong' : 'primary'}" data-dialog-ok>${escapeHtml(aceptar)}</button>
      </div>
    </div>
  `;
  shell.append(capa);

  const botones = [...capa.querySelectorAll('button')];

  return new Promise((resolve) => {
    const cerrar = (respuesta) => {
      if (abierto?.capa !== capa) return;
      abierto = null;
      capa.remove();
      if (anterior && typeof anterior.focus === 'function' && anterior.isConnected) {
        anterior.focus();
      }
      resolve(respuesta);
    };
    abierto = { capa, resolver: cerrar };

    capa.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-dialog-ok]')) cerrar(true);
      else if (target.closest('[data-dialog-cancel]') || target === capa) cerrar(false);
    });

    capa.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        // Que no llegue al Escape del panel: cerraría también el panel.
        event.preventDefault();
        event.stopPropagation();
        cerrar(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const actual = botones.indexOf(document.activeElement);
      const siguiente = event.shiftKey
        ? (actual - 1 + botones.length) % botones.length
        : (actual + 1) % botones.length;
      event.preventDefault();
      botones[siguiente].focus();
    });

    // Ante una acción peligrosa, el foco empieza en la salida segura.
    (peligro ? botones[0] : botones[1]).focus();
  });
}
