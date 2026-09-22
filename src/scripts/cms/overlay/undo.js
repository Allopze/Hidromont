/**
 * El aviso de «Deshacer» tras un borrado.
 *
 * Vive en el shell, no en el panel: los cuatro borradores llaman acto seguido
 * a un cargador que pasa por `openPanel`, que hace `panelBody.innerHTML = html`.
 * Un aviso dentro del panel se destruiría milisegundos después de nacer.
 */

import { api } from './api';
import { escapeHtml } from './html';
import { setGlobalState, shell } from './shell';

const host = () => shell.querySelector('[data-undo-host]');

/** Cuánto se ofrece deshacer. El servidor da 3 s más de gracia por la latencia. */
let temporizador;
let cuentaAtras;
let pendiente = null;

/**
 * Muestra la oferta de deshacer.
 *
 * Un segundo borrado reemplaza al primero en vez de apilarse: apilar avisos
 * multiplica los anuncios de la región viva y amontona cajas sobre un panel de
 * 420 px. El token reemplazado NO se pierde —el snapshot sigue vivo en el
 * servidor hasta caducar—, así que «reemplazar» no significa «perder».
 */
export function ofrecerDeshacer(oferta, alRestaurar) {
  if (!oferta?.token) return;
  const caja = host();
  if (!caja) return;

  limpiar();
  pendiente = { ...oferta, alRestaurar };

  const segundos = Math.ceil(oferta.expiresInMs / 1000);
  caja.innerHTML = `
    <span class="hm-cms-undo-texto">Se eliminó ${escapeHtml(oferta.etiqueta)}.</span>
    <span class="hm-cms-undo-cuenta" data-undo-cuenta aria-hidden="true">${segundos}s</span>
    <button type="button" class="hm-cms-undo-btn" data-action="undo">Deshacer</button>
  `;
  caja.hidden = false;

  // La cuenta atrás va en un <span aria-hidden>, nunca dentro del texto que
  // anuncia la región viva: doce actualizaciones seguidas dejarían un lector
  // de pantalla inservible.
  let restantes = segundos;
  cuentaAtras = setInterval(() => {
    restantes -= 1;
    const marcador = caja.querySelector('[data-undo-cuenta]');
    if (marcador) marcador.textContent = `${Math.max(0, restantes)}s`;
  }, 1000);

  // No se anuncia la caducidad: avisar de que ya no se puede deshacer, doce
  // segundos después, es ruido.
  temporizador = setTimeout(cerrar, oferta.expiresInMs);
}

/** Canjea el token. Lo llama la delegación de eventos. */
export async function deshacer() {
  if (!pendiente) return;
  const { token, alRestaurar } = pendiente;
  const caja = host();
  limpiar();

  try {
    const r = await api(`/api/cms/undo/${encodeURIComponent(token)}`, { method: 'POST' });
    if (caja) {
      const avisos = (r.avisos ?? []).join(' ');
      caja.innerHTML = `<span class="hm-cms-undo-texto">Restaurado.${
        avisos ? `<span class="hm-cms-undo-aviso">${escapeHtml(avisos)}</span>` : ''
      }</span>`;
      caja.hidden = false;
      temporizador = setTimeout(cerrar, avisos ? 8000 : 4000);
    }
    // Lo restaurado está en la base, no en los archivos del sitio: hay que
    // volver a exportar. El distintivo de la barra existe para esto.
    setGlobalState('unsaved');
    if (typeof alRestaurar === 'function') alRestaurar();
  } catch (error) {
    if (caja) {
      caja.innerHTML = `<span class="hm-cms-undo-texto">${escapeHtml(error.message)}</span>`;
      caja.hidden = false;
      temporizador = setTimeout(cerrar, 6000);
    }
  }
}

/** ¿Hay una oferta viva? Lo consulta la trampa de foco del panel. */
export function hayDeshacerPendiente() {
  return !!pendiente;
}

function limpiar() {
  clearTimeout(temporizador);
  clearInterval(cuentaAtras);
  pendiente = null;
}

function cerrar() {
  limpiar();
  const caja = host();
  if (caja) {
    caja.hidden = true;
    caja.innerHTML = '';
  }
}
