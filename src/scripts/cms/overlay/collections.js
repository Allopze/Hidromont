/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo (`?cms=1`), de modo que un visitante normal no descarga nada.
 */

import { asList, escapeHtml } from './html';
import { panelBody, setGlobalState } from './shell';
import { clearDraft } from './drafts';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';
import { ensureSession } from './auth';
import { richtextMarkup } from './richtext';
import { fieldLabelMarkup, listEditorMarkup } from './fields';

// ─── CRUD de colecciones ─────────────────────────────────────────────────
const COLLECTION_KINDS = [
  { id: 'servicio', label: 'Servicios' },
  { id: 'proyecto', label: 'Proyectos' },
  { id: 'page', label: 'Páginas' },
];

export let activeCollectionKind = 'servicio';

// M-1: la búsqueda va contra el servidor y el panel conserva lo escrito
// entre recargas de la lista. Antes se pintaban las 40 entradas de golpe en
// un panel de 420 px, sin buscador ni recuento, y con el límite de 100 del
// servidor truncando en silencio cualquier colección más grande.
let collectionQuery = '';

let collectionSearchTimer;

/** Limpia el filtro sin repintar. Lo usa el cambio de pestaña. */
export function resetCollectionQuery() {
  collectionQuery = '';
}

/**
 * Filtra la lista de entradas tras una pausa.
 *
 * El temporizador y la consulta viven aquí y no en el manejador de `input`
 * porque son estado de este módulo: mientras estuvo todo en el mismo archivo
 * daba igual, pero al separarlos reasignarlos desde fuera exigiría exportar
 * un `let` mutable.
 *
 * Repintar el panel destruye el input, así que al terminar se le devuelve el
 * foco y el cursor al final de lo escrito.
 */
export function scheduleCollectionSearch(texto) {
  collectionQuery = texto.trim();
  clearTimeout(collectionSearchTimer);
  collectionSearchTimer = setTimeout(async () => {
    await loadCollections(activeCollectionKind, { mantenerFoco: true });
    const nuevo = panelBody.querySelector('[data-collection-search]');
    if (nuevo) {
      nuevo.focus();
      nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
    }
  }, 250);
}

export async function loadCollections(kind = activeCollectionKind, { mantenerFoco = false } = {}) {
  const opcionesPanel = { autofocus: !mantenerFoco };
  if (!(await ensureSession())) return;
  activeCollectionKind = kind;
  setPanelTitle('Colecciones');
  if (!mantenerFoco) openPanel('<p class="hm-cms-muted">Cargando...</p>');
  try {
    const params = new URLSearchParams({ kind, limit: '100' });
    if (collectionQuery) params.set('q', collectionQuery);
    const data = await api(`/api/cms/entries?${params}`);
    const entries = data.entries || [];
    const tabs = COLLECTION_KINDS.map(
      (k) =>
        `<button type="button" class="hm-cms-tab${k.id === kind ? ' active' : ''}" data-action="tab-kind" data-kind="${escapeHtml(k.id)}">${escapeHtml(k.label)}</button>`
    ).join('');

    openPanel(
      `
      <div class="hm-cms-tabs">${tabs}</div>
      <label style="margin-bottom:8px">Buscar
        <input name="collectionSearch" type="search" data-collection-search
          placeholder="Título, slug o id" value="${escapeHtml(collectionQuery)}" />
      </label>
      <p class="hm-cms-muted" style="margin:0 0 8px">
        ${entries.length === data.total ? `${data.total} entrada${data.total === 1 ? '' : 's'}` : `Mostrando ${entries.length} de ${data.total}`}
        ${data.pages > 1 ? ' · acota la búsqueda para ver el resto' : ''}
      </p>
      <div class="hm-cms-actions" style="margin-bottom:12px">
        <button type="button" data-action="new-entry" data-kind="${escapeHtml(kind)}">+ Nueva entrada</button>
      </div>
      ${
        entries.length === 0
          ? collectionQuery
            ? `<p class="hm-cms-muted">Ninguna entrada de tipo «${escapeHtml(kind)}» coincide con «${escapeHtml(collectionQuery)}».</p>`
            : `<p class="hm-cms-muted">No hay entradas de tipo «${escapeHtml(kind)}».</p>`
          : `<div class="hm-cms-collection-list">
            ${entries
              .map(
                (e) => `
              <div class="hm-cms-collection-item">
                <div class="hm-cms-collection-info">
                  <span class="hm-cms-collection-title">${escapeHtml(e.title)}</span>
                  <span class="hm-cms-collection-meta">${escapeHtml(e.slug)} · <span class="hm-cms-badge ${escapeHtml(e.status)}">${escapeHtml({ draft: 'Borrador', published: 'Publicado' }[e.status] || e.status)}</span></span>
                </div>
                <div class="hm-cms-collection-actions">
                  <button type="button" class="secondary" data-action="edit-entry" data-entry-id="${escapeHtml(e.id)}">Editar</button>
                  <button type="button" class="secondary destructive" data-action="delete-entry" data-entry-id="${escapeHtml(e.id)}" data-entry-title="${escapeHtml(e.title)}">Borrar</button>
                </div>
              </div>
            `
              )
              .join('')}
          </div>`
      }
    `,
      opcionesPanel
    );
  } catch (error) {
    openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
  }
}

/**
 * A-7/A-9: el vocabulario de enumeraciones y los efectos de «Borrador»
 * vienen del servidor (`/api/cms/schema`), que los lee del módulo
 * compartido con el schema de Astro. Se pide una vez por sesión.
 */
let schemaCache = null;

function slugDesdeTitulo(titulo) {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function mostrarRutaSugerida(kind, slug) {
  const ruta = panelBody.querySelector('[data-suggested-path]');
  if (!ruta) return;
  const coleccion = { servicio: 'servicios', proyecto: 'proyectos' }[kind];
  ruta.hidden = !coleccion || !slug;
  ruta.textContent = coleccion && slug ? `Ruta sugerida: /${coleccion}/${slug}` : '';
}

function sugerirIdentificadores(kind) {
  const form = panelBody.querySelector('[data-entry-form]');
  const titulo = form?.elements.title;
  const id = form?.elements.id;
  const slug = form?.elements.slug;
  if (!titulo || !id || !slug) return;

  const prefijo = { servicio: 'servicio', proyecto: 'proyecto', page: 'page' }[kind] || kind;
  let mantenerSugerencia = true;
  const actualizar = () => {
    if (!mantenerSugerencia) return;
    slug.value = slugDesdeTitulo(titulo.value);
    id.value = slug.value ? `${prefijo}.${slug.value}` : '';
    mostrarRutaSugerida(kind, slug.value);
  };

  titulo.addEventListener('input', actualizar);
  id.addEventListener('input', () => (mantenerSugerencia = false));
  slug.addEventListener('input', () => {
    mantenerSugerencia = false;
    mostrarRutaSugerida(kind, slug.value);
  });
  actualizar();
}

async function getSchema() {
  if (schemaCache) return schemaCache;
  try {
    schemaCache = await api('/api/cms/schema');
  } catch {
    schemaCache = { enumFields: {}, draftEffect: {} };
  }
  return schemaCache;
}

export async function showEntryForm(entryId = null, kind = activeCollectionKind) {
  if (!(await ensureSession())) return;
  const schema = await getSchema();
  const enums = schema.enumFields?.[kind] || {};
  const draftGroup = kind === 'servicio' || kind === 'proyecto' ? 'collection' : 'page';
  const draft = schema.draftEffect?.[draftGroup] || {
    label: 'Borrador',
    warning: '',
  };
  let entry = null;
  if (entryId) {
    try {
      entry = await api(`/api/cms/entries/${encodeURIComponent(entryId)}`);
    } catch (error) {
      openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
      return;
    }
  }

  setPanelTitle(entry ? 'Editar entrada' : 'Nueva entrada');
  openPanel(`
    <form class="hm-cms-entry-form" data-entry-form data-entry-id="${escapeHtml(entryId || '')}" data-kind="${escapeHtml(kind)}">
      <label>Título
        <input name="title" value="${escapeHtml(entry?.title || '')}" required />
      </label>
      <details>
        <summary>URL y publicación</summary>
      ${
        !entryId
          ? `<label>ID interno
        <input name="id" value="" required pattern="[a-z0-9._-]+" title="Minúsculas, números, puntos, guiones" />
        <span class="hm-cms-muted">Se sugiere según el título y el tipo de entrada.</span>
      </label>`
          : `<p class="hm-cms-muted">ID: <strong>${escapeHtml(entryId)}</strong></p>`
      }
      <label>URL corta
        <input name="slug" value="${escapeHtml(entry?.slug || '')}" required />
      </label>
      <p class="hm-cms-muted" data-suggested-path hidden></p>
      <label>Estado de publicación
        <select name="status" data-initial-status="${escapeHtml(entry?.status || 'published')}">
          <option value="published" ${!entry || entry.status === 'published' ? 'selected' : ''}>Publicado</option>
          <option value="draft" ${entry?.status === 'draft' ? 'selected' : ''}>${escapeHtml(draft.label)}</option>
        </select>
      </label>
      <p class="hm-cms-muted" data-draft-warning hidden style="background:var(--hm-cms-warn-bg);border:1px solid var(--hm-cms-warn-line);border-radius:0px;padding:8px 10px">${escapeHtml(draft.warning)}</p>
      </details>
      ${
        !entryId && (kind === 'servicio' || kind === 'proyecto')
          ? `
        <p class="hm-cms-muted" style="background:var(--hm-cms-warn-bg);border:1px solid var(--hm-cms-warn-line);border-radius:0px;padding:8px 10px">
          Al crearla, se abrirá aquí el formulario con campos de ejemplo (${kind === 'servicio' ? 'resumen, icono, orden' : 'alcance, categoría, orden'}). Complétalos y guarda antes de «Publicar cambios».
        </p>`
          : ''
      }
      ${
        entry
          ? Object.entries(entry.fields || {})
              // A-8: `number` y `list` estaban excluidos, así que `orden` no
              // era editable en ninguna parte del CMS y no había forma de
              // reordenar servicios ni proyectos, que es justo por lo que la
              // home y /servicios ordenan sus tarjetas.
              //
              // `richtext` estaba excluido por el mismo descuido, y era peor:
              // es el cuerpo en Markdown de la ficha —el texto que el visitante
              // lee— y ningún componente lo expone con `data-cms-type`, así que
              // los 48 cuerpos de servicios y proyectos no se podían editar
              // desde ninguna parte del panel.
              .filter(([, f]) =>
                ['text', 'textarea', 'richtext', 'number', 'list'].includes(f.type)
              )
              .map(([key, f]) => {
                const name = `field:${escapeHtml(key)}`;
                // A-7: los campos de enumeración eran texto libre, y un
                // valor mal escrito hacía que el export omitiera la entrada
                // en silencio mientras el job se cerraba como correcto.
                if (enums[key]) {
                  const actual = String(f.value ?? '');
                  const conocido = enums[key].some((o) => o.value === actual);
                  return `<label>${fieldLabelMarkup(key, f, false)}
                    <select name="${name}" data-field-type="text">
                      ${
                        !conocido && actual
                          ? `<option value="${escapeHtml(actual)}" selected>⚠ ${escapeHtml(actual)} (valor inválido)</option>`
                          : ''
                      }
                      ${enums[key]
                        .map(
                          (o) =>
                            `<option value="${escapeHtml(o.value)}"${o.value === actual ? ' selected' : ''}>${escapeHtml(o.label)}</option>`
                        )
                        .join('')}
                    </select>
                  </label>`;
                }
                if (f.type === 'list') {
                  return `<label>${fieldLabelMarkup(key, f, false)}</label>${listEditorMarkup(asList(f.value), name)}`;
                }
                // El cuerpo va a ancho completo y con su propia barra, no
                // dentro de un <label> como el resto: es el campo donde se
                // escriben párrafos, no un dato de una línea.
                if (f.type === 'richtext') {
                  return richtextMarkup(f.value, name, fieldLabelMarkup(key, f, false));
                }
                const control =
                  f.type === 'textarea'
                    ? `<textarea name="${name}" data-field-type="textarea">${escapeHtml(String(f.value ?? ''))}</textarea>`
                    : f.type === 'number'
                      ? `<input name="${name}" type="number" step="any" data-field-type="number" value="${escapeHtml(String(f.value ?? ''))}" />`
                      : `<input name="${name}" data-field-type="text" value="${escapeHtml(String(f.value ?? ''))}" />`;
                return `<label>${fieldLabelMarkup(key, f, false)}${control}</label>`;
              })
              .join('')
          : ''
      }
      <div class="hm-cms-actions">
        <button type="submit">${entry ? 'Guardar cambios' : 'Crear entrada'}</button>
        <button type="button" class="secondary" data-action="back-to-collections">← Volver</button>
        ${entry ? `<button type="button" class="secondary" data-action="revisions" data-entry-id="${escapeHtml(entryId)}">Revisiones</button>` : ''}
      </div>
      <p class="hm-cms-muted" role="status" aria-live="polite" data-status></p>
    </form>
  `);
  const slug = panelBody.querySelector('[data-entry-form] [name="slug"]');
  if (slug) {
    slug.addEventListener('input', () => mostrarRutaSugerida(kind, slug.value));
    mostrarRutaSugerida(kind, slug.value);
  }
  if (!entry) sugerirIdentificadores(kind);
}

export async function saveEntryForm(form) {
  const entryId = form.dataset.entryId;
  const kind = form.dataset.kind;
  const status = form.querySelector('[data-status]');
  if (status) status.textContent = 'Guardando...';

  const title = form.elements.title.value.trim();
  const slug = form.elements.slug.value.trim();
  const entryStatus = form.elements.status.value;

  // A-9: despublicar tiene efectos opuestos según el tipo y ninguno es
  // reversible con un clic, así que se confirma con el efecto a la vista.
  const estadoPrevio = form.elements.status.dataset?.initialStatus;
  if (entryStatus === 'draft' && estadoPrevio === 'published') {
    const aviso = form.querySelector('[data-draft-warning]')?.textContent?.trim();
    if (!window.confirm(`${aviso}\n\n¿Continuar?`)) {
      if (status) status.textContent = '';
      return;
    }
  }

  try {
    if (!entryId) {
      const id = form.elements.id?.value.trim();
      await api('/api/cms/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, kind, slug, title, status: entryStatus }),
      });
      setGlobalState('unsaved');
      await showEntryForm(id, kind);
      const nuevoEstado = panelBody.querySelector('[data-status]');
      if (nuevoEstado)
        nuevoEstado.textContent =
          'Entrada creada. Completa estos detalles y guarda antes de publicar.';
      clearDraft(form);
      return;
    } else {
      await api(`/api/cms/entries/${encodeURIComponent(entryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug, status: entryStatus }),
      });
      // Los metadatos ya quedaron guardados aunque un PATCH de campo posterior
      // falle. Reflejarlo en la barra evita dejar un estado «publicado» falso.
      setGlobalState('unsaved');

      // A-3: secuencial y SIN `expectedVersion`, a diferencia de saveEdit.
      // Cada PATCH incrementa la versión de la misma entrada, así que en
      // paralelo y con control de concurrencia estos guardados se
      // conflictuarían entre sí. En serie el orden es además determinista:
      // con Promise.all se generaban N revisiones en orden indeterminado.
      // El bucle ya sabe cuántos campos va a mandar, así que puede decirlo.
      // Antes eran hasta nueve peticiones en serie bajo un único «Guardando...»
      // que no cambiaba nunca: sin señal de avance y sin forma de saber si
      // seguía vivo. Es el único flujo largo del panel que no informaba.
      const campos = Object.entries(form.elements).filter(
        ([name]) => typeof name === 'string' && name.startsWith('field:')
      );
      let hechos = 0;

      for (const [name, input] of campos) {
        {
          const key = name.slice(6);
          // A-8: el servidor valida que el valor case con el tipo declarado
          // del campo, así que un número no puede viajar como cadena.
          const fieldType = input.dataset?.fieldType;
          let value = input.value;
          if (fieldType === 'number') {
            value = input.value === '' ? null : Number(input.value);
          } else if (fieldType === 'list') {
            try {
              value = JSON.parse(input.value || '[]');
            } catch {
              value = [];
            }
          }
          await api(
            `/api/cms/entries/${encodeURIComponent(entryId)}/fields/${encodeURIComponent(key)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value }),
            }
          );
          hechos += 1;
          if (status) status.textContent = `Guardando campo ${hechos} de ${campos.length}...`;
        }
      }
    }

    if (status) status.textContent = 'Guardado. Cambios pendientes de publicar.';
    setGlobalState('unsaved');
    clearDraft(form);
  } catch (error) {
    if (status) status.innerHTML = `<span class="hm-cms-error">${escapeHtml(error.message)}</span>`;
  }
}
