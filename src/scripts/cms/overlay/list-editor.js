/**
 * Editor de listas del panel: listas de textos (normas, aplicaciones) y
 * listas de grupos (los procesos de un servicio: título + descripción).
 *
 * El estado vive en un `<input type="hidden">` con el JSON de la lista, que es
 * lo que envía el formulario. Los controles visibles se vuelcan en él a cada
 * tecla (`syncListValue`) y se repintan desde él cuando algo lo escribe desde
 * fuera, como recuperar un borrador (`repintarLista`).
 *
 * La forma se decide en `listas.ts`. Lo importante es que nunca se convierte un
 * grupo en texto: lo que no se sabe editar se muestra fijo y no se envía.
 */

import { escapeHtml } from './html';
import { icon } from './icons';
import {
  clavesDeGrupos,
  convertirValor,
  esClaveLarga,
  etiquetaDeClave,
  formaDeLista,
  grupoVacio,
  tiposDeClaves,
} from './listas';

function botonQuitar(i) {
  return `<button type="button" class="icon ghost destructive" data-action="remove-list-item" data-index="${i}" aria-label="Quitar el elemento ${i + 1}" title="Quitar">${icon('x')}</button>`;
}

function filaDeTexto(valor, i) {
  return `
    <li class="hm-cms-list-row">
      <input type="text" data-list-item="${i}" value="${escapeHtml(String(valor ?? ''))}" aria-label="Elemento ${i + 1} de la lista" />
      ${botonQuitar(i)}
    </li>`;
}

function tituloDeGrupo(grupo, claves, i) {
  const primero = claves.find((k) => typeof grupo[k] === 'string' && grupo[k].trim());
  return primero ? `${i + 1}. ${grupo[primero]}` : `Elemento ${i + 1}`;
}

function filaDeGrupo(grupo, i, claves, tipos, largas) {
  const controles = claves
    .map((k) => {
      const valor = grupo[k];
      const atributos = `data-group-key="${escapeHtml(k)}" data-group-type="${tipos[k]}"`;
      let control;
      if (tipos[k] === 'boolean') {
        return `<label class="hm-cms-check"><input type="checkbox" ${atributos} ${valor ? 'checked' : ''} /> ${escapeHtml(etiquetaDeClave(k))}</label>`;
      }
      if (tipos[k] === 'number') {
        control = `<input type="number" step="any" ${atributos} value="${escapeHtml(valor ?? '')}" />`;
      } else if (largas.includes(k)) {
        control = `<textarea rows="3" ${atributos}>${escapeHtml(valor ?? '')}</textarea>`;
      } else {
        control = `<input type="text" ${atributos} value="${escapeHtml(valor ?? '')}" />`;
      }
      return `<label>${escapeHtml(etiquetaDeClave(k))}${control}</label>`;
    })
    .join('');
  return `
    <li class="hm-cms-group" data-list-group>
      <div class="hm-cms-group-head">
        <span class="hm-cms-group-title" data-group-title>${escapeHtml(tituloDeGrupo(grupo, claves, i))}</span>
        ${botonQuitar(i)}
      </div>
      ${controles}
    </li>`;
}

function contextoDeGrupos(editor) {
  try {
    return {
      claves: JSON.parse(editor.dataset.listKeys || '[]'),
      tipos: JSON.parse(editor.dataset.listTypes || '{}'),
      largas: JSON.parse(editor.dataset.listLong || '[]'),
    };
  } catch {
    return { claves: [], tipos: {}, largas: [] };
  }
}

function filasMarkup(editor, items) {
  if (editor.dataset.listShape === 'grupos') {
    const { claves, tipos, largas } = contextoDeGrupos(editor);
    return items.map((g, i) => filaDeGrupo(g, i, claves, tipos, largas)).join('');
  }
  return items.map((v, i) => filaDeTexto(v, i)).join('');
}

/**
 * @param {unknown[]} items
 * @param {string} inputName El `name` del hidden: `value` en el editor de
 *   campo, `field:<clave>` en el formulario de colección.
 * @param {{ clave?: string }} [opciones] La clave del campo, para reconocer
 *   una lista de grupos todavía vacía.
 */
export function listEditorMarkup(items, inputName, { clave = '' } = {}) {
  const forma = formaDeLista(items, clave);

  if (forma === 'fija') {
    return `
      <div class="hm-cms-notice is-info">
        ${icon('info')}
        <p>Esta lista tiene un formato especial y no se puede editar desde el panel. Se conserva tal cual.</p>
      </div>`;
  }

  // El mismo `dataset` que llevará el editor en el DOM: `filasMarkup` lo lee
  // igual al pintar ahora que al repintar o agregar un elemento después.
  const dataset = { listShape: forma };
  if (forma === 'grupos') {
    const claves = clavesDeGrupos(items, clave);
    Object.assign(dataset, {
      listKeys: JSON.stringify(claves),
      listTypes: JSON.stringify(tiposDeClaves(items, claves)),
      listLong: JSON.stringify(claves.filter((k) => esClaveLarga(items, k))),
    });
  }
  const editor = { dataset };
  const atributos = [
    `data-list-shape="${forma}"`,
    dataset.listKeys ? `data-list-keys="${escapeHtml(dataset.listKeys)}"` : '',
    dataset.listTypes ? `data-list-types="${escapeHtml(dataset.listTypes)}"` : '',
    dataset.listLong ? `data-list-long="${escapeHtml(dataset.listLong)}"` : '',
  ].join(' ');

  return `
    <div class="hm-cms-list" data-list-editor ${atributos}>
      <ol class="hm-cms-list-items" data-list-items>${filasMarkup(editor, items)}</ol>
      <button type="button" class="hm-cms-add-item" data-action="add-list-item">${icon('plus')}Agregar elemento</button>
      <input name="${escapeHtml(inputName)}" type="hidden" data-field-type="list" value="${escapeHtml(JSON.stringify(items))}" />
    </div>`;
}

function leerGrupo(fila, tipos) {
  const grupo = {};
  for (const control of fila.querySelectorAll('[data-group-key]')) {
    const k = control.dataset.groupKey;
    const tipo = tipos[k] || 'text';
    grupo[k] = convertirValor(tipo, control.type === 'checkbox' ? control.checked : control.value);
  }
  return grupo;
}

/** Vuelca los controles visibles en el hidden de su editor. */
export function syncListValue(scope) {
  const editor = scope?.closest?.('[data-list-editor]') ?? scope;
  if (!editor?.querySelector) return;
  const hidden = editor.querySelector('input[type="hidden"][data-field-type="list"]');
  if (!hidden) return;

  let items;
  if (editor.dataset.listShape === 'grupos') {
    const { claves, tipos } = contextoDeGrupos(editor);
    items = [...editor.querySelectorAll('[data-list-group]')].map((fila, i) => {
      const grupo = leerGrupo(fila, tipos);
      const titulo = fila.querySelector('[data-group-title]');
      if (titulo) titulo.textContent = tituloDeGrupo(grupo, claves, i);
      return grupo;
    });
  } else {
    items = [...editor.querySelectorAll('[data-list-item]')].map((input) => input.value);
  }
  hidden.value = JSON.stringify(items);
}

/** Repinta los controles desde el hidden, tras escribirlo desde fuera. */
export function repintarLista(editor) {
  const hidden = editor?.querySelector('input[type="hidden"][data-field-type="list"]');
  const contenedor = editor?.querySelector('[data-list-items]');
  if (!hidden || !contenedor) return;
  let items;
  try {
    items = JSON.parse(hidden.value || '[]');
  } catch {
    return;
  }
  if (!Array.isArray(items)) return;
  contenedor.innerHTML = filasMarkup(editor, items);
}

/** Añade un elemento vacío al final y lo enfoca. */
export function agregarElemento(editor) {
  const contenedor = editor?.querySelector('[data-list-items]');
  if (!contenedor) return;
  if (editor.dataset.listShape === 'grupos') {
    const { claves, tipos, largas } = contextoDeGrupos(editor);
    const i = contenedor.querySelectorAll('[data-list-group]').length;
    contenedor.insertAdjacentHTML(
      'beforeend',
      filaDeGrupo(grupoVacio(claves, tipos), i, claves, tipos, largas)
    );
  } else {
    const i = contenedor.querySelectorAll('[data-list-item]').length;
    contenedor.insertAdjacentHTML('beforeend', filaDeTexto('', i));
  }
  contenedor.lastElementChild?.querySelector('input, textarea')?.focus();
  syncListValue(editor);
}

/** Quita el elemento del botón pulsado y renumera los que quedan. */
export function quitarElemento(boton) {
  const editor = boton.closest('[data-list-editor]');
  const fila = boton.closest('[data-list-group], .hm-cms-list-row');
  if (!editor || !fila) return;
  const contenedor = fila.parentElement;
  fila.remove();

  [...contenedor.children].forEach((hijo, i) => {
    hijo.querySelector('[data-list-item]')?.setAttribute('data-list-item', String(i));
    hijo
      .querySelector('[data-list-item]')
      ?.setAttribute('aria-label', `Elemento ${i + 1} de la lista`);
    const quitar = hijo.querySelector('[data-action="remove-list-item"]');
    quitar?.setAttribute('data-index', String(i));
    quitar?.setAttribute('aria-label', `Quitar el elemento ${i + 1}`);
  });
  syncListValue(editor);

  // El foco no puede quedarse en un botón que ya no existe.
  const destino =
    contenedor.children[Math.min(Number(boton.dataset.index) || 0, contenedor.children.length - 1)];
  (
    destino?.querySelector('input, textarea') ||
    editor.querySelector('[data-action="add-list-item"]')
  )?.focus();
}
