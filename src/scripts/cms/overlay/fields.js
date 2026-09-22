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
import { asList, escapeHtml } from './html';
import { setFormDirty, setGlobalState } from './shell';
import { clearDraft } from './drafts';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';
import { ensureSession } from './auth';
import { applyMediaSelection, loadMediaPicker } from './media';
import { richtextMarkup } from './richtext';

/**
 * E-3: rótulo del campo. El servidor manda `label` junto al campo; la clave
 * cruda se conserva en pequeño porque es la que aparece en los mensajes de
 * error y la que nombra un desarrollador por teléfono.
 */
export function fieldLabelMarkup(key, field) {
  const legible = field?.label || key;
  // Cuando la etiqueta es la clave capitalizada o acentuada («Aplicaciones»
  // de `aplicaciones`, «Título» de `titulo`), repetirla al lado solo añade
  // ruido: la pista solo aparece cuando de verdad dice algo distinto.
  const normalizar = (t) =>
    t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  if (normalizar(legible) === normalizar(key)) return escapeHtml(legible);
  return `${escapeHtml(legible)} <span class="hm-cms-field-key">${escapeHtml(key)}</span>`;
}

function fieldEditor(element, entry, field) {
  setPanelTitle('Editor');
  const cmsType = element.dataset.cmsType || 'text';
  const current = entry.fields[field]?.value ?? '';
  const altField = element.dataset.cmsAltField;
  const altValue = altField
    ? (entry.fields[altField]?.value ?? element.getAttribute('alt') ?? '')
    : '';

  if (cmsType === 'image') {
    return `
      <div class="hm-cms-image-preview">
        <img src="${escapeHtml(String(current))}" alt="${escapeHtml(String(altValue))}" data-image-preview />
        <p class="hm-cms-muted" data-selected-media-label>Imagen actual</p>
      </div>
      <label>Ruta de imagen
        <input name="value" value="${escapeHtml(String(current))}" />
      </label>
      ${
        altField
          ? `<label>Texto alternativo
        <input name="alt" value="${escapeHtml(String(altValue))}" />
      </label>`
          : ''
      }
      <input name="mediaId" type="hidden" value="" />
      <div class="hm-cms-two">
        <label>Foco X
          <input name="focalX" type="number" min="0" max="1" step="0.01" value="0.5" />
        </label>
        <label>Foco Y
          <input name="focalY" type="number" min="0" max="1" step="0.01" value="0.5" />
        </label>
      </div>
      <label>Subir imagen
        <input name="file" type="file" accept="image/png,image/jpeg,image/webp" />
      </label>
      <label>Biblioteca de medios
        <input name="mediaSearch" type="search" placeholder="Buscar por nombre o alt" data-media-search />
      </label>
      <div data-media-grid class="hm-cms-media-grid">
        <p class="hm-cms-muted">Cargando medios...</p>
      </div>
    `;
  }

  if (cmsType === 'richtext') {
    return richtextMarkup(current, 'value', 'Contenido');
  }

  if (cmsType === 'textarea') {
    return `
      <label>Contenido
        <textarea name="value">${escapeHtml(String(current))}</textarea>
      </label>
    `;
  }

  if (cmsType === 'list') {
    return `
      <p class="hm-cms-muted" style="margin:0 0 8px">Items de la lista:</p>
      ${listEditorMarkup(asList(current), 'value')}
    `;
  }

  if (cmsType === 'number') {
    return `
      <label>Valor numérico
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
      <label>URL
        <input name="link-href" value="${escapeHtml(String(link.href ?? ''))}" />
      </label>
      <input name="value" type="hidden" value="${escapeHtml(JSON.stringify(link))}" />
    `;
  }

  return `
    <label>Contenido
      <input name="value" value="${escapeHtml(String(current))}" />
    </label>
  `;
}

/**
 * A-8: markup del editor de listas, reutilizado por el editor de campo
 * suelto y por el formulario de colección. `inputName` existe porque el
 * formulario de colección puede tener varias listas a la vez (tipos,
 * aplicaciones, normas) y cada una necesita su propio hidden.
 */
export function listEditorMarkup(items, inputName) {
  return `
      <div data-list-editor>
        <div data-list-items style="display:grid;gap:6px;margin-bottom:8px">
          ${items
            .map(
              (item, i) => `
            <div style="display:flex;gap:6px;align-items:center">
              <input type="text" data-list-item="${i}" value="${escapeHtml(String(item))}" aria-label="Elemento ${i + 1} de la lista" style="flex:1;border:1px solid var(--hm-cms-line-soft);border-radius:0px;padding:8px 10px;font:inherit" />
              <button type="button" class="secondary destructive" data-action="remove-list-item" data-index="${i}" aria-label="Quitar el elemento ${i + 1}" style="font-weight:700">×</button>
            </div>
          `
            )
            .join('')}
        </div>
        <button type="button" data-action="add-list-item" style="border:1px dashed var(--hm-cms-line-soft);background:white;color:var(--hm-cms-ink-soft);border-radius:0px;padding:8px 12px;cursor:pointer;font:inherit;width:100%;text-align:left">+ Agregar item</button>
        <input name="${escapeHtml(inputName)}" type="hidden" data-field-type="list" value="${escapeHtml(JSON.stringify(items))}" />
      </div>
    `;
}

/**
 * A-8: se acota al `[data-list-editor]` que contiene el input tocado. Antes
 * buscaba en todo el formulario y el hidden fijo `[name="value"]`, lo que
 * bastaba con un solo editor por formulario pero colisiona en cuanto hay
 * varias listas, como en el formulario de colección.
 */
export function syncListValue(scope) {
  const editor = scope?.closest?.('[data-list-editor]') ?? scope;
  if (!editor) return;
  const items = Array.from(editor.querySelectorAll('[data-list-item]')).map((input) => input.value);
  const hidden = editor.querySelector('input[type="hidden"]');
  if (hidden) hidden.value = JSON.stringify(items);
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

  openPanel(`
    <form data-edit data-entry-id="${escapeHtml(entryId)}" data-field="${escapeHtml(field)}">
      <!-- E-3: antes esta línea era la única pista de qué se estaba editando y
           decía \`home.hero.eyebrow\`. Ahora encabeza el nombre legible y la
           clave queda debajo, que es la que aparece en los errores. También
           se escapa: venía de atributos data del HTML sin pasar por
           escapeHtml. -->
      <h3 style="margin:0;font-size:15px">${escapeHtml(entry.fields[field]?.label || field)}</h3>
      <p class="hm-cms-muted">${escapeHtml(entry.title || entryId)} <span class="hm-cms-field-key">${escapeHtml(entryId)}.${escapeHtml(field)}</span></p>
      ${fieldEditor(element, entry, field)}
      <div class="hm-cms-actions">
        <button type="submit">Guardar</button>
        ${
          element.dataset.cmsType === 'image'
            ? ''
            : `<button type="button" class="secondary destructive" data-action="clear-field">Vaciar este texto</button>`
        }
        <button type="button" class="secondary" data-action="export">Exportar</button>
        <button type="button" class="secondary" data-action="revisions" data-entry-id="${escapeHtml(entryId)}">Revisiones</button>
      </div>
      <p class="hm-cms-muted" role="status" aria-live="polite" data-status>Sin cambios guardados.</p>
    </form>
  `);

  if (element.dataset.cmsType === 'image') {
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
  const status = form.querySelector('[data-status]');
  if (!status) return;
  status.innerHTML = `
    <span class="hm-cms-error">${escapeHtml(message)}</span>
    <span class="hm-cms-actions" style="margin-top:8px">
      <button type="button" class="secondary" data-action="show-server-value"
        data-entry-id="${escapeHtml(entryId)}" data-field="${escapeHtml(field)}">Ver valor del servidor</button>
      <button type="button" class="secondary" data-action="force-save">Guardar de todos modos</button>
    </span>
    <span data-server-value></span>
  `;
}

export async function saveEdit(form) {
  const element = state.selected;
  if (!element || !state.entry) return;

  const entryId = element.dataset.cmsEntry;
  const field = element.dataset.cmsField;
  const status = form.querySelector('[data-status]');
  status.textContent = 'Guardando...';

  const file = form.elements.file?.files?.[0];
  let value = form.elements.value.value;

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
      if (!response.ok) throw new Error(data.error || 'Error al subir imagen');
      return data;
    });
    value = uploaded.path;
    form.elements.value.value = value;
    form.elements.mediaId.value = uploaded.id;
    state.mediaItems = [uploaded, ...state.mediaItems.filter((item) => item.id !== uploaded.id)];
    applyMediaSelection(uploaded);
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

  if (element.dataset.cmsType === 'image') {
    element.setAttribute('src', value);
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

  status.textContent =
    'Guardado en la base de datos. Usa «Exportar y validar» para escribir los archivos del sitio.';
  setGlobalState('unsaved');
  // A-11: este es el único guardado que no reabre el panel (los formularios
  // de colección y galería vuelven a su listado, y openPanel ya lo limpia).
  setFormDirty(false);
  // E-2: guardado correcto, la copia local ya no hace falta.
  clearDraft(form);
}
