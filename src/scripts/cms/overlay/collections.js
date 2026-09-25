/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo en `editor.*` (o por `?cms=1` en desarrollo), de modo que un visitante normal no descarga nada.
 */

import { asList, escapeHtml } from './html';
import { panelBody, setGlobalState } from './shell';
import { clearDraft } from './drafts';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';
import { ensureSession } from './auth';
import { richtextMarkup } from './richtext';
import { fieldLabelMarkup, listEditorMarkup, mensajeGuardado } from './fields';
import { confirmar } from './confirm';
import { icon } from './icons';
import { campoTituloDe, seccionesDeFicha } from './secciones';

// ─── CRUD de colecciones ─────────────────────────────────────────────────
const COLLECTION_KINDS = [
  { id: 'servicio', label: 'Servicios', nueva: 'Nuevo servicio' },
  { id: 'proyecto', label: 'Proyectos', nueva: 'Nuevo proyecto' },
  { id: 'page', label: 'Páginas', nueva: 'Nueva página' },
];

/** Un rótulo por cada estado que acepta el servidor (lo vigila un test). */
const ROTULOS_DE_ESTADO = { draft: 'Borrador', published: 'Publicado' };

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
      <div class="hm-cms-toolbar">
        <label class="hm-cms-grow">Buscar
          <input name="collectionSearch" type="search" data-collection-search
            placeholder="Buscar por título" value="${escapeHtml(collectionQuery)}" />
        </label>
        <button type="button" class="primary" data-action="new-entry" data-kind="${escapeHtml(kind)}">${icon('plus')}${escapeHtml(COLLECTION_KINDS.find((k) => k.id === kind)?.nueva || 'Nueva entrada')}</button>
      </div>
      <p class="hm-cms-count">
        ${entries.length === data.total ? `${data.total} ${data.total === 1 ? 'entrada' : 'entradas'}` : `Mostrando ${entries.length} de ${data.total}`}
        ${data.pages > 1 ? ' · acota la búsqueda para ver el resto' : ''}
      </p>
      ${
        entries.length === 0
          ? `<p class="hm-cms-empty">${
              collectionQuery
                ? `Ninguna entrada coincide con «${escapeHtml(collectionQuery)}».`
                : 'Todavía no hay entradas aquí.'
            }</p>`
          : `<div class="hm-cms-collection-list">
            ${entries
              .map(
                (e) => `
              <div class="hm-cms-collection-item">
                <div class="hm-cms-collection-info">
                  <span class="hm-cms-collection-title">${escapeHtml(e.title)}</span>
                  <span class="hm-cms-collection-meta">
                    ${
                      // Solo se marca la excepción: con todas en «Publicado»,
                      // la etiqueta en cada fila era ruido.
                      e.status === 'published'
                        ? ''
                        : `<span class="hm-cms-badge ${escapeHtml(e.status)}">${escapeHtml(ROTULOS_DE_ESTADO[e.status] || e.status)}</span>`
                    }
                    <span>/${escapeHtml(String(e.slug).replace(/^\//, ''))}</span>
                  </span>
                </div>
                <div class="hm-cms-collection-actions">
                  <button type="button" class="secondary small" data-action="edit-entry" data-entry-id="${escapeHtml(e.id)}">${icon('pencil')}Editar</button>
                  <button type="button" class="icon ghost destructive" data-action="delete-entry" data-entry-id="${escapeHtml(e.id)}" data-entry-title="${escapeHtml(e.title)}" aria-label="Eliminar: ${escapeHtml(e.title)}" title="Eliminar">${icon('trash')}</button>
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

/**
 * Un campo del formulario de ficha.
 *
 * @param esTitulo El campo que el sitio usa como título: arrastra el nombre de
 *   la entrada en la lista del panel (`data-sync-title`).
 */
function campoMarkup(key, f, enums, esTitulo = false) {
  const name = `field:${escapeHtml(key)}`;
  const rotulo = fieldLabelMarkup(key, f);
  // A-7: los campos de enumeración eran texto libre, y un valor mal escrito
  // hacía que el export omitiera la entrada en silencio.
  if (enums[key]) {
    const actual = String(f.value ?? '');
    const conocido = enums[key].some((o) => o.value === actual);
    return `<label data-field-key="${escapeHtml(key)}">${rotulo}
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
  // Una lista no cabe dentro de un <label>: son varios controles. Su nombre va
  // en un <fieldset>, que es lo que un lector de pantalla anuncia al entrar.
  if (f.type === 'list') {
    return `<fieldset class="hm-cms-fieldset" data-field-key="${escapeHtml(key)}">
      <legend>${rotulo}</legend>
      ${listEditorMarkup(asList(f.value), name, { clave: key })}
    </fieldset>`;
  }
  // El cuerpo va a ancho completo y con su propia barra de formato.
  if (f.type === 'richtext') {
    return richtextMarkup(f.value, name, rotulo);
  }
  const valor = escapeHtml(String(f.value ?? ''));
  const control =
    f.type === 'textarea'
      ? `<textarea name="${name}" data-field-type="textarea">${valor}</textarea>`
      : f.type === 'number'
        ? `<input name="${name}" type="number" step="any" data-field-type="number" value="${valor}" />`
        : `<input name="${name}" data-field-type="text" value="${valor}"${esTitulo ? ' data-sync-title required' : ''} />`;
  return `<label data-field-key="${escapeHtml(key)}">${rotulo}${control}</label>${
    esTitulo
      ? '<p class="hm-cms-hint">Es el título que se ve en el sitio y en la lista del panel.</p>'
      : ''
  }`;
}

export async function showEntryForm(entryId = null, kind = activeCollectionKind) {
  if (!(await ensureSession())) return;
  const schema = await getSchema();
  let entry = null;
  if (entryId) {
    try {
      entry = await api(`/api/cms/entries/${encodeURIComponent(entryId)}`);
    } catch (error) {
      openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
      return;
    }
    // Manda el tipo de la entrada, no el de la pestaña activa: desde «Editar
    // esta ficha» o desde el resumen de publicación puede ser otro.
    kind = entry.kind || kind;
  }
  const enums = schema.enumFields?.[kind] || {};
  const draftGroup = kind === 'servicio' || kind === 'proyecto' ? 'collection' : 'page';
  const draft = schema.draftEffect?.[draftGroup] || {
    label: 'Borrador',
    warning: '',
  };

  setPanelTitle(entry ? 'Editar entrada' : 'Nueva entrada');

  // A-8: `number` y `list` estaban excluidos, así que `orden` no era editable
  // en ninguna parte del CMS. `richtext` estaba excluido por el mismo
  // descuido, y era peor: es el cuerpo de la ficha, el texto que el visitante
  // lee, y los 48 cuerpos no se podían editar desde ninguna parte del panel.
  const campos = Object.fromEntries(
    Object.entries(entry?.fields || {}).filter(([, f]) =>
      ['text', 'textarea', 'richtext', 'number', 'list'].includes(f.type)
    )
  );
  const campoTitulo = entry ? campoTituloDe(kind, Object.keys(campos)) : null;
  const secciones = entry ? seccionesDeFicha(kind, Object.keys(campos)) : [];

  openPanel(
    `
    <form class="hm-cms-entry-form" data-entry-form data-entry-id="${escapeHtml(entryId || '')}" data-kind="${escapeHtml(kind)}">
      ${
        // Un solo título: el que muestra el sitio. El de la entrada es el
        // nombre en la lista del panel y lo sigue en silencio (events.js).
        campoTitulo
          ? `<input type="hidden" name="title" value="${escapeHtml(entry.title || '')}" data-anterior="${escapeHtml(entry.title || '')}" />`
          : `<label>Título
        <input name="title" value="${escapeHtml(entry?.title || '')}" required />
      </label>`
      }
      ${
        !entryId && (kind === 'servicio' || kind === 'proyecto')
          ? `
        <p class="hm-cms-notice is-info">
          Al crearla, se abrirá aquí el formulario con campos de ejemplo (${kind === 'servicio' ? 'resumen, icono, orden' : 'alcance, categoría, orden'}). Complétalos y guarda antes de «Publicar cambios».
        </p>`
          : ''
      }
      ${secciones
        .map(
          (seccion) => `
        <section class="hm-cms-form-section">
          ${seccion.titulo ? `<h3 class="hm-cms-form-section-title">${escapeHtml(seccion.titulo)}</h3>` : ''}
          ${seccion.claves
            .map((key) => campoMarkup(key, campos[key], enums, key === campoTitulo))
            .join('')}
        </section>`
        )
        .join('')}
      <details class="hm-cms-advanced" ${!entryId ? 'open' : ''}>
        <summary>Dirección y publicación</summary>
      ${
        !entryId
          ? `<label>ID interno
        <input name="id" value="" required pattern="[a-z0-9._-]+" title="Minúsculas, números, puntos, guiones" />
      </label>
      <p class="hm-cms-hint">Se sugiere según el título y el tipo de entrada.</p>`
          : `<p class="hm-cms-hint">Identificador interno: <code>${escapeHtml(entryId)}</code></p>`
      }
      <label>Dirección en el sitio
        <input name="slug" value="${escapeHtml(entry?.slug || '')}" required />
      </label>
      <p class="hm-cms-hint" data-suggested-path hidden></p>
      <label>Estado de publicación
        <select name="status" data-initial-status="${escapeHtml(entry?.status || 'published')}">
          <option value="published" ${!entry || entry.status === 'published' ? 'selected' : ''}>Publicado</option>
          <option value="draft" ${entry?.status === 'draft' ? 'selected' : ''}>${escapeHtml(draft.label)}</option>
        </select>
      </label>
      <p class="hm-cms-notice is-warn" data-draft-warning hidden>${escapeHtml(draft.warning)}</p>
      </details>
      <div class="hm-cms-actions hm-cms-footer">
        <button type="submit">${entry ? 'Guardar cambios' : 'Crear entrada'}</button>
        <button type="button" class="ghost" data-action="back-to-collections">${icon('arrowLeft')}Volver</button>
        ${entry ? `<button type="button" class="ghost" data-action="revisions" data-entry-id="${escapeHtml(entryId)}" data-entry-title="${escapeHtml(entry.title || '')}">${icon('history')}Revisiones</button>` : ''}
        <p class="hm-cms-save-state" role="status" aria-live="polite" data-status></p>
      </div>
    </form>
  `,
    { wide: true }
  );
  const formulario = panelBody.querySelector('[data-entry-form]');
  if (formulario) recordarValoresIniciales(formulario);
  const slug = panelBody.querySelector('[data-entry-form] [name="slug"]');
  if (slug) {
    slug.addEventListener('input', () => mostrarRutaSugerida(kind, slug.value));
    mostrarRutaSugerida(kind, slug.value);
  }
  if (!entry) sugerirIdentificadores(kind);
}

/**
 * El valor con que se abrió cada control, para mandar solo lo que cambió.
 *
 * No sirve `defaultValue`: en un `<input type="hidden">` —el de las listas—
 * asignar `value` reescribe también el atributo, así que el valor «por
 * defecto» cambia con cada tecla y nunca habría diferencia que detectar.
 */
function recordarValoresIniciales(form) {
  for (const el of form.elements) {
    if (el.name) el.dataset.inicial = el.value;
  }
}

function cambio(input) {
  return (
    Boolean(input) && input.dataset.inicial !== undefined && input.value !== input.dataset.inicial
  );
}

function marcarGuardado(input) {
  if (input) input.dataset.inicial = input.value;
}

/** El nombre visible de un control del formulario, para los mensajes de error. */
function rotuloDeCampo(input, key) {
  const leyenda = input.closest?.('fieldset')?.querySelector('legend');
  if (leyenda) return leyenda.textContent.trim();
  const label =
    input.closest?.('label') ||
    (input.id ? input.form?.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null);
  return label?.firstChild?.textContent?.trim() || key;
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
    const seguir = await confirmar({
      titulo: '¿Pasar a borrador?',
      mensaje: aviso,
      aceptar: 'Pasar a borrador',
      peligro: true,
    });
    if (!seguir) {
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
      // Solo viaja lo que cambió. Antes cada guardado reenviaba los nueve
      // campos y los datos de la entrada aunque se hubiera tocado uno: nueve
      // revisiones idénticas por guardado, y el resumen de «qué se va a
      // publicar» decía que había cambiado todo.
      const meta = [form.elements.title, form.elements.slug, form.elements.status];
      const campos = Object.entries(form.elements).filter(
        ([name, input]) => typeof name === 'string' && name.startsWith('field:') && cambio(input)
      );
      if (!meta.some(cambio) && campos.length === 0) {
        if (status) status.textContent = 'No hay cambios que guardar.';
        clearDraft(form);
        return;
      }

      if (meta.some(cambio)) {
        await api(`/api/cms/entries/${encodeURIComponent(entryId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, slug, status: entryStatus }),
        });
        meta.forEach(marcarGuardado);
        // Los metadatos ya quedaron guardados aunque un PATCH de campo
        // posterior falle: la barra no debe seguir diciendo «publicado».
        setGlobalState('unsaved');
      }

      // A-3: secuencial y SIN `expectedVersion`, a diferencia de saveEdit.
      // Cada PATCH incrementa la versión de la misma entrada, así que en
      // paralelo y con control de concurrencia estos guardados se
      // conflictuarían entre sí. En serie el orden es además determinista.
      // El bucle ya sabe cuántos campos va a mandar, así que puede decirlo.
      let hechos = 0;

      for (const [name, input] of campos) {
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
        try {
          await api(
            `/api/cms/entries/${encodeURIComponent(entryId)}/fields/${encodeURIComponent(key)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value }),
            }
          );
        } catch (error) {
          // El servidor nombra la clave («orden»); quien edita ve el rótulo
          // («Orden de aparición»). Se dice cuál falló y cuántos sí entraron.
          const rotulo = rotuloDeCampo(input, key);
          throw new Error(
            `No se pudo guardar «${rotulo}»: ${error.message}${hechos ? ` (los ${hechos} campos anteriores sí se guardaron)` : ''}`
          );
        }
        marcarGuardado(input);
        hechos += 1;
        if (status) status.textContent = `Guardando campo ${hechos} de ${campos.length}...`;
      }
    }

    if (status) status.textContent = mensajeGuardado();
    setGlobalState('unsaved');
    clearDraft(form);
  } catch (error) {
    if (status)
      status.innerHTML = `<span class="hm-cms-error" role="alert">${escapeHtml(error.message)}</span>`;
  }
}
