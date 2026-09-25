/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo en `editor.*` (o por `?cms=1` en desarrollo), de modo que un visitante normal no descarga nada.
 */

import { apiBase, state } from './context';
import { asList, escapeHtml } from './html';
import { icon } from './icons';
import { setFormDirty, setGlobalState } from './shell';
import { clearDraft } from './drafts';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';
import { ensureSession } from './auth';
import { applyMediaSelection, loadMediaPicker } from './media';
import { richtextMarkup } from './richtext';
import { publishEnvironment } from './publish';
import { dropzoneMarkup } from './dropzone';
import { listEditorMarkup } from './list-editor';

export { listEditorMarkup, syncListValue } from './list-editor';

/**
 * E-3: rótulo del campo. El servidor manda `label` junto al campo.
 *
 * La clave cruda (`orden`, `layout.header.logoSrc`) ya no va al lado: quien
 * edita no la necesita y la leía como parte del nombre. Se conserva en
 * `data-field-key` y en «Detalles técnicos», que es donde la busca quien da
 * soporte por teléfono.
 */
export function fieldLabelMarkup(key, field) {
  return escapeHtml(field?.label || key);
}

/**
 * Los estados del editor de un campo, en palabras de quien edita.
 *
 * Antes cada mensaje explicaba el circuito completo («Guardado en CMS.
 * «Publicar cambios» compila aquí; falta desplegar para actualizar
 * producción.»): cierto, pero ilegible junto a un botón.
 */
export const ESTADOS_DE_CAMPO = {
  limpio: 'Todo guardado.',
  sucio: 'Cambios sin guardar.',
  guardando: 'Guardando…',
};

export function mensajeGuardado() {
  const entorno = publishEnvironment();
  if (entorno === 'production') return 'Guardado. Se verá en el sitio cuando publiques.';
  if (entorno === 'local') return 'Guardado. Se verá al publicar y desplegar.';
  return 'Guardado. Pendiente de publicar.';
}

/**
 * Pinta el estado del editor de campo. `nivel` colorea el texto y el punto
 * que lo acompaña: idle, dirty, saving, success o error.
 */
export function setEditStatus(form, nivel, texto, { html = false } = {}) {
  const status = form?.querySelector('[data-edit-status]');
  if (!status) return;
  status.dataset.level = nivel;
  if (html) status.innerHTML = texto;
  else status.textContent = texto;
}

function fieldEditor(element, entry, field) {
  const cmsType = element.dataset.cmsType || 'text';
  const current = entry.fields[field]?.value ?? '';
  const altField = element.dataset.cmsAltField;
  const altValue = altField
    ? (entry.fields[altField]?.value ?? element.getAttribute('alt') ?? '')
    : '';

  if (cmsType === 'image') {
    const imagenPredeterminada = !current;
    const vistaPrevia = current || element.currentSrc || element.src;
    // Orden de la tarea: ver la foto, cambiarla (subir o elegir), describirla.
    // La ruta y el punto de enfoque numérico quedan en «Opciones avanzadas»:
    // funcionan igual, pero no son lo primero que alguien debería tocar.
    return `
      <div class="hm-cms-image-preview">
        <img src="${escapeHtml(String(vistaPrevia))}" alt="${escapeHtml(String(altValue))}" data-image-preview />
        <p class="hm-cms-hint" data-selected-media-label>${imagenPredeterminada ? 'Imagen predeterminada del sitio' : 'Imagen actual'}</p>
      </div>
      ${dropzoneMarkup({ texto: 'Subir una imagen nueva' })}
      <div class="hm-cms-field-group">
        <label>Elegir de la biblioteca
          <input name="mediaSearch" type="search" placeholder="Buscar por nombre o descripción" data-media-search />
        </label>
        <div data-media-grid class="hm-cms-media-grid">
          <p class="hm-cms-hint">Cargando imágenes…</p>
        </div>
      </div>
      ${
        altField
          ? `<label>Descripción de la imagen
        <input name="alt" value="${escapeHtml(String(altValue))}" aria-describedby="hm-cms-alt-hint" />
      </label>
      <p class="hm-cms-hint" id="hm-cms-alt-hint">La leen quienes no pueden ver la foto y los buscadores.</p>`
          : ''
      }
      <input name="mediaId" type="hidden" value="" />
      <details class="hm-cms-advanced">
        <summary>Opciones avanzadas</summary>
        <label>Ruta del archivo
          <input name="value" value="${escapeHtml(String(current))}" />
        </label>
        <div class="hm-cms-two">
          <label>Enfoque horizontal
            <input name="focalX" type="number" min="0" max="1" step="0.01" value="0.5" />
          </label>
          <label>Enfoque vertical
            <input name="focalY" type="number" min="0" max="1" step="0.01" value="0.5" />
          </label>
        </div>
        <p class="hm-cms-hint">El enfoque va de 0 a 1 e indica qué parte de la foto se conserva al recortarla.</p>
      </details>
    `;
  }

  if (cmsType === 'richtext') {
    return richtextMarkup(current, 'value', 'Texto');
  }

  if (cmsType === 'textarea') {
    return `
      <label>Texto
        <textarea name="value">${escapeHtml(String(current))}</textarea>
      </label>
    `;
  }

  if (cmsType === 'list') {
    return `
      <p class="hm-cms-label">Elementos de la lista</p>
      ${listEditorMarkup(asList(current), 'value', { clave: field })}
    `;
  }

  if (cmsType === 'number') {
    return `
      <label>Número
        <input name="value" type="number" value="${escapeHtml(String(current))}" step="any" />
      </label>
    `;
  }

  if (cmsType === 'link') {
    const link =
      typeof current === 'object' && current !== null
        ? current
        : { label: String(current), href: '' };
    return `
      <label>Texto del enlace
        <input name="link-label" value="${escapeHtml(String(link.label ?? ''))}" />
      </label>
      <label>Dirección (URL)
        <input name="link-href" value="${escapeHtml(String(link.href ?? ''))}" />
      </label>
      <input name="value" type="hidden" value="${escapeHtml(JSON.stringify(link))}" />
    `;
  }

  return `
    <label>Texto
      <input name="value" value="${escapeHtml(String(current))}" />
    </label>
  `;
}

export function syncLinkValue(form) {
  const label = form.querySelector('[name="link-label"]')?.value || '';
  const href = form.querySelector('[name="link-href"]')?.value || '';
  const hidden = form.querySelector('[name="value"]');
  if (hidden) hidden.value = JSON.stringify({ label, href });
}

export async function selectElement(element) {
  if (!(await ensureSession())) return;

  const entryId = element.dataset.cmsEntry;
  const field = element.dataset.cmsField;
  if (!entryId || !field) return;

  const entry = await api(`/api/cms/entries/${encodeURIComponent(entryId)}`);
  state.selected = element;
  state.entry = entry;
  const nombre = entry.fields[field]?.label || field;
  const esImagen = element.dataset.cmsType === 'image';
  setPanelTitle(esImagen ? 'Editar imagen' : 'Editar texto');

  // Guardar va en un pie fijo: en el editor de imagen quedaba debajo de la
  // biblioteca entera y había que desplazarse para encontrarlo. «Vaciar» se
  // aparta del pie a propósito: es la única acción destructiva y no debe
  // compartir grupo con la que se pulsa siempre.
  openPanel(`
    <form class="hm-cms-edit-form" data-edit data-entry-id="${escapeHtml(entryId)}" data-field="${escapeHtml(field)}">
      <p class="hm-cms-context">
        <span>${escapeHtml(entry.title || entryId)}</span>
        <span class="hm-cms-context-sep" aria-hidden="true">›</span>
        <strong>${escapeHtml(nombre)}</strong>
      </p>
      ${fieldEditor(element, entry, field)}
      <div class="hm-cms-edit-tools">
        <div class="hm-cms-edit-actions-secondary">
          <button type="button" class="ghost small" data-action="revisions" data-entry-id="${escapeHtml(entryId)}" data-entry-title="${escapeHtml(entry.title || '')}">${icon('history')}Revisiones</button>
          <button type="button" class="ghost small" data-action="export" title="Prepara los archivos del sitio sin publicarlo. Para que el cambio se vea, usa «Publicar cambios».">Exportar</button>
        </div>
        ${
          esImagen
            ? ''
            : `<div class="hm-cms-edit-actions-danger">
          <button type="button" class="ghost destructive small" data-action="clear-field">${icon('trash')}Vaciar este texto</button>
        </div>`
        }
      </div>
      <details class="hm-cms-tech">
        <summary>Detalles técnicos</summary>
        <p>Clave del campo: <code>${escapeHtml(entryId)}.${escapeHtml(field)}</code></p>
      </details>
      <div class="hm-cms-footer hm-cms-edit-actions">
        <div class="hm-cms-edit-actions-primary">
          <button type="submit">Guardar</button>
          <p class="hm-cms-save-state" role="status" aria-live="polite" data-status data-edit-status data-level="idle">${ESTADOS_DE_CAMPO.limpio}</p>
        </div>
      </div>
    </form>
  `);

  if (esImagen) {
    loadMediaPicker();
  }
}

/**
 * X-001: actualiza el contenido de texto editable de un elemento sin destruir
 * markup anidado (iconos, badges, spans hermanos).
 *
 * Estrategia:
 *   - Si el elemento tiene un unico child node de tipo texto, lo actualiza in place.
 *   - Si tiene varios nodos, busca el primer textNode directo y lo actualiza,
 *     preservando el resto. Si no hay textNode directo, inserta uno al inicio.
 *   - Solo recurre a `textContent` cuando el elemento no tiene hijos elemento
 *     (caso texto plano, el mas comun).
 */
function updateEditableText(element, newValue) {
  const children = Array.from(element.childNodes);
  const elementChildren = children.filter((node) => node.nodeType === Node.ELEMENT_NODE);

  // Caso simple: solo texto (o vacio). textNode seguro, no destruye nada.
  if (elementChildren.length === 0) {
    element.textContent = newValue;
    return;
  }

  // Hay markup anidado: preservarlo, actualizar solo el texto editable.
  const textNodes = children.filter(
    (node) => node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim().length > 0
  );
  if (textNodes.length > 0) {
    // Actualizar el primer textNode significativo.
    textNodes[0].nodeValue = newValue;
  } else {
    // No habia textNode directo: insertar uno antes del primer elemento hijo.
    element.insertBefore(document.createTextNode(newValue), elementChildren[0]);
  }
}

/**
 * A-3: pinta un conflicto de edición sin destruir lo que el editor escribió.
 * Ofrece ver el valor que hay ahora en el servidor y, si aun así quiere
 * imponer el suyo, reintentar contra la versión actual.
 */
function renderConflict(form, entryId, field, message) {
  setEditStatus(
    form,
    'error',
    `
    <span class="hm-cms-error">${escapeHtml(message)}</span>
    <span class="hm-cms-actions">
      <button type="button" class="secondary small" data-action="show-server-value"
        data-entry-id="${escapeHtml(entryId)}" data-field="${escapeHtml(field)}">Ver el valor guardado</button>
      <button type="button" class="secondary small" data-action="force-save">Guardar el mío de todos modos</button>
    </span>
    <span data-server-value></span>
  `,
    { html: true }
  );
}

export async function saveEdit(form) {
  const element = state.selected;
  if (!element || !state.entry) return;

  const entryId = element.dataset.cmsEntry;
  const field = element.dataset.cmsField;
  setEditStatus(form, 'saving', ESTADOS_DE_CAMPO.guardando);

  const file = form.elements.file?.files?.[0];
  let value = form.elements.value.value;
  // El editor de listas guarda JSON en su hidden; el servidor espera el array.
  if (form.elements.value.dataset?.fieldType === 'list') {
    try {
      value = JSON.parse(value || '[]');
    } catch {
      value = [];
    }
  }

  if (file) {
    const payload = new FormData();
    payload.append('file', file);
    payload.append('alt', form.elements.alt?.value || '');
    const uploaded = await fetch(`${apiBase}/api/cms/media`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': state.csrfToken },
      body: payload,
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo subir la imagen.');
      return data;
    });
    value = uploaded.path;
    form.elements.value.value = value;
    form.elements.mediaId.value = uploaded.id;
    state.mediaItems = [uploaded, ...state.mediaItems.filter((item) => item.id !== uploaded.id)];
    setGlobalState('unsaved');
    applyMediaSelection(uploaded);
    // Ya subida: si se vuelve a guardar no debe subirse otra vez.
    form.elements.file.value = '';
    form.elements.file.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (element.dataset.cmsType === 'image' && form.elements.mediaId?.value) {
    await api(`/api/cms/media/${encodeURIComponent(form.elements.mediaId.value)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alt: form.elements.alt?.value || undefined,
        focalX: Number.parseFloat(form.elements.focalX?.value || '0.5'),
        focalY: Number.parseFloat(form.elements.focalY?.value || '0.5'),
      }),
    });
    setGlobalState('unsaved');
  }

  // A-3: el servidor ya sabía detectar ediciones concurrentes
  // (ContentRepository.updateField compara `expectedVersion` contra la
  // versión actual y lanza un conflicto detallado), pero el overlay nunca
  // se la enviaba: con dos pestañas abiertas ganaba la última escritura,
  // en silencio y sin rastro visible.
  let updated;
  try {
    updated = await api(
      `/api/cms/entries/${encodeURIComponent(entryId)}/fields/${encodeURIComponent(field)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // A-4: `mediaId` alimenta media_usages, que es lo que permite
        // avisar de en qué páginas se usa una foto antes de borrarla.
        body: JSON.stringify({
          value,
          expectedVersion: state.entry.version,
          mediaId: form.elements.mediaId?.value || undefined,
        }),
      }
    );
  } catch (error) {
    if (error.status === 409) {
      // No se re-renderiza el formulario: lo que el editor escribió sigue
      // en pantalla y puede copiarlo antes de decidir.
      renderConflict(form, entryId, field, error.message);
      return;
    }
    throw error;
  }
  // Imprescindible: sin esto el segundo guardado del mismo panel mandaría
  // una versión rancia y el editor entraría en conflicto consigo mismo.
  state.entry = updated;
  setGlobalState('unsaved');

  if (element.dataset.cmsType === 'image') {
    if (value) element.setAttribute('src', value);
    const altField = element.dataset.cmsAltField;
    if (altField && form.elements.alt) {
      const altValue = form.elements.alt.value;
      state.entry = await api(
        `/api/cms/entries/${encodeURIComponent(entryId)}/fields/${encodeURIComponent(altField)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: altValue, expectedVersion: state.entry.version }),
        }
      );
      element.setAttribute('alt', altValue);
    }
  } else {
    // X-001: actualizar el contenido de texto sin destruir markup anidado.
    // Antes se hacia `element.textContent = value`, lo que borraba cualquier hijo
    // elemento (iconos, badges, spans) dentro de un <EditableText as="h1"> con slot
    // multi-nodo. Ahora editamos solo el textNode editable, preservando el resto.
    const newValue = updated.fields[field]?.value ?? value;
    updateEditableText(element, newValue);
  }

  setEditStatus(form, 'success', mensajeGuardado());
  setGlobalState('unsaved');
  // A-11: este es el único guardado que no reabre el panel (los formularios
  // de colección y galería vuelven a su listado, y openPanel ya lo limpia).
  setFormDirty(false);
  // E-2: guardado correcto, la copia local ya no hace falta.
  clearDraft(form);
}
