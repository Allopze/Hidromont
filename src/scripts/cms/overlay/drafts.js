/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

import { escapeHtml } from './html';
import { setFormDirty } from './shell';

/**
 * E-2 — Recuperación de lo escrito sin guardar.
 *
 * A-11 dejó el aviso al cerrar y el punto ámbar de la barra, que advierten,
 * pero no salvan nada: quien acepta el aviso, cierra la pestaña por error o
 * pierde el navegador se queda sin el texto. Y son formularios donde se
 * escribe un párrafo entero, no un dato corto.
 *
 * Se guarda una copia en `localStorage` mientras se escribe, y al volver a
 * abrir ese mismo formulario se ofrece recuperarla. La copia se borra en
 * cuanto el guardado va bien, así que en condiciones normales no queda nada.
 *
 * Deliberadamente NO cubre el formulario de acceso ni el de contraseña: son
 * los dos que no deben dejar rastro en el navegador.
 */
const DRAFT_PREFIX = 'hidromont:cms:draft:';

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DRAFT_DEBOUNCE_MS = 800;

let draftTimer;

/**
 * Programa el autoguardado de `form`, cancelando el anterior.
 *
 * El temporizador vive aquí y no en el manejador de `input` porque es estado
 * de este módulo: mientras todo estuvo en el mismo archivo daba igual, pero al
 * separarlo reasignarlo desde fuera exigiría exportar un `let` mutable.
 *
 * La espera existe porque escribir un párrafo dispararía un `setItem` por
 * pulsación, y localStorage es sincrónico.
 */
export function scheduleDraftSave(form) {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => saveDraft(form), DRAFT_DEBOUNCE_MS);
}

/** Los formularios que se autoguardan, y de dónde sale su identidad. */
function draftKeyFor(form) {
  if (!(form instanceof HTMLFormElement)) return '';
  if (form.matches('[data-edit]')) {
    const entryId = form.dataset.entryId;
    const field = form.dataset.field;
    return entryId && field ? `campo:${entryId}.${field}` : '';
  }
  if (form.matches('[data-entry-form]')) {
    // Una entrada nueva todavía no tiene id: se guarda bajo su tipo, que es
    // lo único estable hasta que se cree.
    return form.dataset.entryId
      ? `entrada:${form.dataset.entryId}`
      : `entrada-nueva:${form.dataset.kind || 'sin-tipo'}`;
  }
  if (form.matches('[data-gallery-item-form]')) {
    return form.dataset.itemId ? `imagen:${form.dataset.itemId}` : 'imagen-nueva';
  }
  return '';
}

/** Los valores del formulario, sin archivos ni contraseñas. */
function draftValues(form) {
  const valores = {};
  for (const el of form.elements) {
    if (!el.name || el.type === 'file' || el.type === 'password' || el.type === 'submit') continue;
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked) valores[el.name] = el.value;
      continue;
    }
    valores[el.name] = el.value;
  }
  return valores;
}

export function saveDraft(form) {
  const key = draftKeyFor(form);
  if (!key) return;
  try {
    localStorage.setItem(
      DRAFT_PREFIX + key,
      JSON.stringify({ at: Date.now(), values: draftValues(form) })
    );
  } catch {
    // Modo privado, cuota llena o almacenamiento bloqueado. El aviso al
    // cerrar sigue en pie; no hay nada que decirle al editor aquí.
  }
}

export function clearDraft(form) {
  const key = draftKeyFor(form);
  if (!key) return;
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    /* ver saveDraft */
  }
}

function readDraft(form) {
  const key = draftKeyFor(form);
  if (!key) return null;
  try {
    const bruto = localStorage.getItem(DRAFT_PREFIX + key);
    if (!bruto) return null;
    const copia = JSON.parse(bruto);
    if (!copia?.values || typeof copia.at !== 'number') return null;
    if (Date.now() - copia.at > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }
    return copia;
  } catch {
    return null;
  }
}

/** Elimina las copias caducadas. Corre una vez, al arrancar el overlay. */
export function pruneDrafts() {
  try {
    const caducadas = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(DRAFT_PREFIX)) continue;
      try {
        const copia = JSON.parse(localStorage.getItem(key) || '{}');
        if (typeof copia.at !== 'number' || Date.now() - copia.at > DRAFT_TTL_MS) {
          caducadas.push(key);
        }
      } catch {
        caducadas.push(key);
      }
    }
    for (const key of caducadas) localStorage.removeItem(key);
  } catch {
    /* ver saveDraft */
  }
}

function formatDraftAge(at) {
  const minutos = Math.round((Date.now() - at) / 60000);
  if (minutos < 1) return 'hace menos de un minuto';
  if (minutos < 60) return `hace ${minutos} minuto${minutos === 1 ? '' : 's'}`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} hora${horas === 1 ? '' : 's'}`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} día${dias === 1 ? '' : 's'}`;
}

/**
 * Si hay una copia local que difiere de lo que muestra el formulario, lo
 * anuncia y ofrece recuperarla. Solo si difiere: una copia idéntica a lo que
 * ya hay en pantalla no es información, es ruido.
 */
export function offerDraft(form) {
  const copia = readDraft(form);
  if (!copia) return;

  const actuales = draftValues(form);
  const distintos = Object.entries(copia.values).filter(
    ([name, value]) => (actuales[name] ?? '') !== value
  );
  if (!distintos.length) {
    clearDraft(form);
    return;
  }

  form.insertAdjacentHTML(
    'afterbegin',
    `<div class="hm-cms-draft-notice" data-draft-notice>
      <p style="margin:0 0 6px">
        Hay cambios sin guardar de este formulario, escritos ${escapeHtml(formatDraftAge(copia.at))}.
      </p>
      <span class="hm-cms-actions">
        <button type="button" class="secondary" data-action="restore-draft">Recuperar lo escrito</button>
        <button type="button" class="secondary" data-action="discard-draft">Descartar</button>
      </span>
    </div>`
  );
}

export function applyDraft(form) {
  const copia = readDraft(form);
  if (!copia) return;
  for (const [name, value] of Object.entries(copia.values)) {
    const campo = form.elements[name];
    if (!campo || campo instanceof RadioNodeList) continue;
    if (campo.type === 'checkbox' || campo.type === 'radio') campo.checked = campo.value === value;
    else campo.value = value;
    // Los editores de lista guardan su estado en un hidden y repintan desde
    // él: sin este evento la copia entraría en el hidden y no en pantalla.
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }
  form.querySelector('[data-draft-notice]')?.remove();
  setFormDirty(true);
}
