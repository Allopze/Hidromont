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
import { panelBody, setFormDirty, setGlobalState } from './shell';
import { clearDraft } from './drafts';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';
import { ensureSession } from './auth';
import { applyMediaSelection, loadMediaPicker } from './media';
import { richtextMarkup } from './richtext';
import { publishEnvironment } from './publish';
import { dropzoneMarkup } from './dropzone';
import { listEditorMarkup } from './list-editor';
import {
  confirmarEdicion,
  empezarEdicion,
  escribirFormato,
  escribirIcono,
  escribirLista,
  escribirTexto,
  mostrarImagen,
  mostrarVideo,
} from './edicion';
import { ICONO_SERVICIO, ICONO_SERVICIO_LABEL } from '../../../data/content-vocabulary';
import { ICONOS_SERVICIO_SVG } from '../../../data/iconos-servicio';
import { fieldLabel } from '../../../data/field-labels';
import { nombreDeFicha } from '../../../data/entry-names';
import { sePuedeVaciar } from './secciones';
import { prepararEncuadre } from './encuadre-ui';

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
    // Orden de la tarea: ver la foto y su encuadre, cambiarla (subir o
    // elegir), describirla. La ruta queda en «Opciones avanzadas»: funciona
    // igual, pero no es lo primero que alguien debería tocar.
    //
    // El marco toma la forma del hueco de la página (encuadre-ui.js). Donde
    // la foto se ve entera, como un logo, es una vista previa normal.
    return `
      <div class="hm-cms-image-preview">
        <div class="hm-cms-encuadre-marco" data-encuadre-marco role="group" aria-label="Encuadre de la foto" aria-describedby="hm-cms-encuadre-ayuda">
          <img src="${escapeHtml(String(vistaPrevia))}" alt="${escapeHtml(String(altValue))}" data-image-preview draggable="false" />
        </div>
        <p class="hm-cms-hint" data-selected-media-label>${imagenPredeterminada ? 'Imagen predeterminada del sitio' : 'Imagen actual'}</p>
        <div class="hm-cms-encuadre-ayuda" data-encuadre-ayuda hidden>
          <p class="hm-cms-hint" id="hm-cms-encuadre-ayuda">Arrastra la foto para elegir qué parte se ve en este lugar del sitio.<span class="hm-cms-sr"> También con las flechas del teclado.</span></p>
          <button type="button" class="ghost small" data-action="encuadre-centrar">Centrar</button>
        </div>
        <p class="hm-cms-hint" data-encuadre-bloqueado hidden>Esta foto no está en la biblioteca, así que su encuadre no se puede ajustar.</p>
      </div>
      <input name="focalX" type="hidden" value="" />
      <input name="focalY" type="hidden" value="" />
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
      ${
        // Una cabecera que puede llevar video: se ofrece cambiar la foto por
        // uno. La foto queda de respaldo (se ve mientras carga el video).
        element.dataset.cmsVideoField
          ? `<div class="hm-cms-field-group">
        <button type="button" class="secondary small" data-action="poner-video">${icon('upload')}Poner un video en lugar de la foto</button>
        <p class="hm-cms-hint">La foto queda de respaldo: se ve mientras carga el video.</p>
      </div>`
          : ''
      }
      <details class="hm-cms-advanced">
        <summary>Opciones avanzadas</summary>
        <label>Ruta del archivo
          <input name="value" value="${escapeHtml(String(current))}" />
        </label>
      </details>
    `;
  }

  if (cmsType === 'video') {
    const hayVideo = Boolean(current);
    const src = hayVideo ? ` src="${escapeHtml(String(current))}"` : '';
    // Lo mismo que el editor de foto: ver el video recortado como en la
    // página y arrastrarlo para encuadrarlo, cambiarlo, describirlo.
    return `
      <div class="hm-cms-image-preview">
        <div class="hm-cms-encuadre-marco" data-encuadre-marco role="group" aria-label="Encuadre del video" aria-describedby="hm-cms-encuadre-ayuda">
          <video${src} data-video-preview muted loop autoplay playsinline draggable="false"></video>
        </div>
        <p class="hm-cms-hint" data-selected-media-label>${hayVideo ? 'Video actual' : 'Todavía no hay video: súbelo o elígelo de la biblioteca.'}</p>
        <div class="hm-cms-encuadre-ayuda" data-encuadre-ayuda hidden>
          <p class="hm-cms-hint" id="hm-cms-encuadre-ayuda">Arrastra el video para elegir qué parte se ve en este lugar del sitio.<span class="hm-cms-sr"> También con las flechas del teclado.</span></p>
          <button type="button" class="ghost small" data-action="encuadre-centrar">Centrar</button>
        </div>
        <p class="hm-cms-hint" data-encuadre-bloqueado hidden>Este video no está en la biblioteca, así que su encuadre no se puede ajustar.</p>
      </div>
      <input name="focalX" type="hidden" value="" />
      <input name="focalY" type="hidden" value="" />
      ${dropzoneMarkup({ texto: hayVideo ? 'Subir otro video' : 'Subir un video', tipo: 'video' })}
      <div class="hm-cms-field-group">
        <label>Elegir de la biblioteca
          <input name="mediaSearch" type="search" placeholder="Buscar videos por nombre" data-media-search />
        </label>
        <div data-media-grid class="hm-cms-media-grid">
          <p class="hm-cms-hint">Cargando videos…</p>
        </div>
      </div>
      ${
        altField
          ? `<label>Descripción del video
        <input name="alt" value="${escapeHtml(String(altValue))}" aria-describedby="hm-cms-alt-hint" />
      </label>
      <p class="hm-cms-hint" id="hm-cms-alt-hint">La leen quienes no pueden verlo. Se reproduce sin sonido y en bucle.</p>`
          : ''
      }
      <input name="mediaId" type="hidden" value="" />
      ${
        element.dataset.cmsPosterField
          ? `<div class="hm-cms-field-group">
        <button type="button" class="secondary small" data-action="editar-respaldo">${icon('image')}Cambiar la foto de respaldo</button>
        <p class="hm-cms-hint">Se ve mientras carga el video y para quien prefiere menos movimiento.</p>
      </div>`
          : ''
      }
      ${
        hayVideo
          ? `<div class="hm-cms-edit-actions-danger">
        <button type="button" class="ghost destructive small" data-action="quitar-video">${icon('trash')}Quitar el video y dejar la foto</button>
      </div>`
          : ''
      }
      <details class="hm-cms-advanced">
        <summary>Opciones avanzadas</summary>
        <label>Ruta del archivo
          <input name="value" value="${escapeHtml(String(current))}" />
        </label>
      </details>
    `;
  }

  if (cmsType === 'icono') {
    const propio = String(current || '');
    const deLaLista = String(entry.fields.icono?.value || element.dataset.cmsIcono || 'pipe');
    const indiceEnfocable = Math.max(
      0,
      ICONO_SERVICIO.findIndex((c) => !propio && c === deLaLista)
    );
    // Primero los de la lista, que son los que casan con el resto del sitio;
    // después, subir uno propio.
    return `
      <p class="hm-cms-label" id="hm-cms-iconos-titulo">Iconos del sitio</p>
      <div class="hm-cms-iconos" role="radiogroup" aria-labelledby="hm-cms-iconos-titulo" data-iconos>
        ${ICONO_SERVICIO.map((codigo, i) => {
          const elegido = !propio && codigo === deLaLista;
          const rotulo = ICONO_SERVICIO_LABEL[codigo] || codigo;
          // P3-11: un solo punto de tabulación (el elegido, o el primero); las
          // flechas se mueven entre iconos.
          const enfocable = i === indiceEnfocable;
          return `<button type="button" role="radio" aria-checked="${elegido}" tabindex="${enfocable ? '0' : '-1'}" class="hm-cms-icono" data-action="elegir-icono" data-icono="${escapeHtml(codigo)}" title="${escapeHtml(rotulo)}">
            <span class="hm-cms-icono-dibujo" aria-hidden="true">${ICONOS_SERVICIO_SVG[codigo]}</span>
            <span class="hm-cms-sr">${escapeHtml(rotulo)}</span>
          </button>`;
        }).join('')}
      </div>
      <p class="hm-cms-label">O un icono propio</p>
      <div class="hm-cms-icono-propio" data-icono-propio ${propio ? '' : 'hidden'}>
        <span class="icono-propio" ${propio ? `style="--icono: url('${escapeHtml(propio)}')"` : ''}></span>
      </div>
      ${dropzoneMarkup({ texto: propio ? 'Subir otro icono' : 'Subir un icono', tipo: 'icono' })}
      <p class="hm-cms-hint">Se pinta del color del sitio, como los de la lista: sirve un dibujo de un solo color con fondo transparente.</p>
      <input name="value" type="hidden" value="${escapeHtml(propio)}" />
      <input name="icono" type="hidden" value="${escapeHtml(deLaLista)}" />
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

/**
 * P1-07 (auditoría 2026-09): el texto de un enlace (menú, botón, tarjeta) se
 * edita al pulsarlo, así que no había forma de seguir el enlace. El editor
 * ofrece ir a su destino cuando es una página interna distinta de esta.
 */
function irALaPagina(element) {
  const enlace = element.closest('a[href]');
  const href = enlace?.getAttribute('href') || '';
  if (!href.startsWith('/') || href.startsWith('//')) return '';
  const destino = href.split('#')[0].replace(/\/+$/, '') || '/';
  const aqui = window.location.pathname.replace(/\/+$/, '') || '/';
  if (destino === aqui) return '';
  return `<a class="ghost small hm-cms-go-link" href="${escapeHtml(href)}">Ir a esta página →</a>`;
}

/**
 * P2-07 (auditoría 2026-09): `selectElement` pintaba tras un `await` sin
 * mirar si seguía siendo la última selección. Pulsar dos elementos seguidos
 * con la red lenta podía acabar mostrando el editor del primero con el
 * segundo resaltado. Cada llamada toma un turno y solo pinta la última.
 */
let turnoDeSeleccion = 0;

export async function selectElement(element) {
  const turno = ++turnoDeSeleccion;
  if (!(await ensureSession())) return;

  const entryId = element.dataset.cmsEntry;
  const field = element.dataset.cmsField;
  if (!entryId || !field) return;

  const entry = await api(`/api/cms/entries/${encodeURIComponent(entryId)}`);
  if (turno !== turnoDeSeleccion) return;
  state.selected = element;
  state.entry = entry;
  // El icono son dos campos (el de la lista y el propio): se nombra el conjunto.
  // Un campo que todavía no existe no trae `label` del servidor.
  const nombre =
    element.dataset.cmsType === 'icono' ? 'Icono' : entry.fields[field]?.label || fieldLabel(field);
  const tipo = element.dataset.cmsType || 'text';
  const esMedio = tipo === 'image' || tipo === 'video';
  const titulos = { image: 'Editar imagen', video: 'Editar video', icono: 'Cambiar icono' };
  setPanelTitle(titulos[tipo] ?? 'Editar texto');

  // Guardar va en un pie fijo: en el editor de imagen quedaba debajo de la
  // biblioteca entera y había que desplazarse para encontrarlo. «Vaciar» se
  // aparta del pie a propósito: es la única acción destructiva y no debe
  // compartir grupo con la que se pulsa siempre.
  openPanel(
    `
    <form class="hm-cms-edit-form" data-edit data-entry-id="${escapeHtml(entryId)}" data-field="${escapeHtml(field)}" data-tipo-medio="${tipo === 'video' ? 'video' : 'imagen'}">
      <p class="hm-cms-context">
        <span>${escapeHtml(nombreDeFicha(entryId, entry.title))}</span>
        <span class="hm-cms-context-sep" aria-hidden="true">›</span>
        <strong>${escapeHtml(nombre)}</strong>
      </p>
      ${fieldEditor(element, entry, field)}
      <div class="hm-cms-edit-tools">
        <div class="hm-cms-edit-actions-secondary">
          <button type="button" class="ghost small" data-action="revisions" data-entry-id="${escapeHtml(entryId)}" data-entry-title="${escapeHtml(nombreDeFicha(entryId, entry.title))}" data-field="${escapeHtml(field)}" data-field-name="${escapeHtml(nombre)}">${icon('history')}Revisiones</button>
          ${irALaPagina(element)}
        </div>
        ${
          !sePuedeVaciar(entry.kind, field, element.dataset.cmsType || 'text')
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
  `,
    // Sin fondo oscuro: la página se sigue viendo, con el elemento resaltado y
    // mostrando lo que se escribe.
    { modal: false }
  );
  empezarEdicion(element);

  const form = panelBody.querySelector('form[data-edit]');
  if (form?.elements.alt) form.elements.alt.dataset.inicial = form.elements.alt.value;
  state.encuadre = null;
  if (esMedio && form) {
    loadMediaPicker();
    iniciarEncuadre(form, element, entry.fields[field]?.value ?? '');
  }
}

/**
 * El marco de encuadre necesita saber qué foto de la biblioteca es la que se
 * ve: el punto de enfoque se guarda en la foto. Si el campo usa la imagen
 * predeterminada del sitio, se busca por la ruta que muestra la página.
 */
function iniciarEncuadre(form, element, valor) {
  const encuadre = prepararEncuadre(form, element);
  if (!encuadre) return;
  state.encuadre = encuadre;
  const ruta = String(valor || element.getAttribute('src') || '');
  form.dataset.rutaActual = ruta;
  buscarMedioPorRuta(ruta).then((asset) => {
    if (!form.isConnected || state.encuadre !== encuadre) return;
    if (asset) {
      if (!form.elements.mediaId.value) form.elements.mediaId.value = asset.id;
      encuadre.fijar({ x: asset.focalX ?? 0.5, y: asset.focalY ?? 0.5 }, { inicial: true });
    }
    encuadre.habilitar(Boolean(asset));
  });
}

async function buscarMedioPorRuta(ruta) {
  if (!/^\/[^?#]+\.(webp|jpe?g|png|avif|mp4|webm)$/i.test(ruta)) return null;
  try {
    const nombre = ruta.split('/').pop();
    const data = await api(`/api/cms/media?${new URLSearchParams({ q: nombre, limit: '20' })}`);
    return (data.items || []).find((item) => item.path === ruta) || null;
  } catch {
    return null;
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

/** Sube un archivo a la biblioteca y devuelve el asset. */
/**
 * Sube un archivo a la biblioteca. P2-19 (auditoría 2026-09): con `fetch` no
 * hay progreso de subida y un video de 60 MB dejaba «Guardando…» minutos sin
 * ninguna señal; con XHR se informa el porcentaje.
 */
function subirArchivo(file, alt = '', alProgresar) {
  const payload = new FormData();
  payload.append('file', file);
  payload.append('alt', alt);
  return new Promise((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBase}/api/cms/media`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('X-CSRF-Token', state.csrfToken);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && alProgresar) alProgresar(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) resolver(data);
      else
        rechazar(
          Object.assign(new Error(data.error || 'No se pudo subir el archivo.'), {
            status: xhr.status,
          })
        );
    };
    xhr.onerror = () =>
      rechazar(
        Object.assign(
          new Error(
            'No se pudo conectar con el servidor. Revisa tu conexión y vuelve a intentarlo.'
          ),
          { status: 0 }
        )
      );
    xhr.send(payload);
  });
}

async function patchCampo(entryId, key, body) {
  return api(`/api/cms/entries/${encodeURIComponent(entryId)}/fields/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * El icono de un servicio son dos campos: `icono`, uno de la lista, e
 * `iconoPropio`, la ruta de uno subido, que manda si está. Elegir uno de la
 * lista vacía el propio; subir uno lo pone.
 */
async function guardarIcono(form, element) {
  const entryId = element.dataset.cmsEntry;
  setEditStatus(form, 'saving', ESTADOS_DE_CAMPO.guardando);
  const file = form.elements.file?.files?.[0];
  let propio = form.elements.value.value;
  const deLaLista = form.elements.icono.value;
  if (file) {
    const subido = await subirArchivo(file, `Icono de ${state.entry.title || 'servicio'}`);
    propio = subido.path;
    form.elements.value.value = propio;
    form.elements.file.value = '';
    form.elements.file.dispatchEvent(new Event('change', { bubbles: true }));
    setGlobalState('unsaved');
  }
  let guardo = false;
  if (propio !== (state.entry.fields.iconoPropio?.value ?? '')) {
    state.entry = await patchCampo(entryId, 'iconoPropio', {
      value: propio,
      expectedVersion: state.entry.version,
    });
    guardo = true;
  }
  if (!propio && deLaLista !== (state.entry.fields.icono?.value ?? '')) {
    state.entry = await patchCampo(entryId, 'icono', {
      value: deLaLista,
      expectedVersion: state.entry.version,
    });
    guardo = true;
  }
  escribirIcono(element, propio ? { url: propio } : { svg: ICONOS_SERVICIO_SVG[deLaLista] });
  element.dataset.cmsIcono = deLaLista;
  confirmarEdicion();
  setFormDirty(false);
  clearDraft(form);
  if (!guardo) {
    setEditStatus(form, 'idle', 'No hay cambios que guardar.');
    return;
  }
  setGlobalState('unsaved');
  setEditStatus(form, 'success', mensajeGuardado());
}

/**
 * Quitar el video de una cabecera: la página vuelve a enseñar la foto que
 * quedaba de respaldo, como la pintará el sitio al publicar.
 */
function quitarVideoDeLaPagina(video) {
  const respaldo =
    video.parentElement?.querySelector('img[data-hero-video-poster]') ??
    (video.previousElementSibling instanceof HTMLImageElement
      ? video.previousElementSibling
      : null);
  if (respaldo) {
    respaldo.hidden = false;
    respaldo.style.display = 'block';
  }
  video.pause?.();
  video.hidden = true;
  video.closest('[data-reveal-cinematic]')?.querySelector('[data-hero-video-control]')?.remove();
}

export async function saveEdit(form) {
  const element = state.selected;
  if (!element || !state.entry) return;
  if (element.dataset.cmsType === 'icono') return guardarIcono(form, element);

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

  const esVideo = element.dataset.cmsType === 'video';
  // Foto o video: los dos se suben, se eligen de la biblioteca, se encuadran
  // y se describen igual.
  const esImagen = element.dataset.cmsType === 'image' || esVideo;
  const valorOriginal = state.entry.fields[field]?.value ?? '';
  // P2-13: una foto se describe. La descripción la leen los lectores de
  // pantalla y los buscadores; sin ella se guardaba vacía sin ningún aviso.
  if (
    element.dataset.cmsType === 'image' &&
    element.dataset.cmsAltField &&
    form.elements.alt &&
    (file || String(value || '').trim()) &&
    !form.elements.alt.value.trim()
  ) {
    form.elements.alt.focus();
    throw new Error(
      'Describe la foto antes de guardar: la leen quienes no pueden verla y los buscadores.'
    );
  }
  // El encuadre elegido antes de subir una foto nueva: la subida la registra
  // con el centro y hay que devolverle el que la persona dejó.
  const encuadreElegido = state.encuadre?.actual();
  let guardoAlgo = false;

  if (file) {
    const uploaded = await subirArchivo(file, form.elements.alt?.value || '', (pct) =>
      setEditStatus(form, 'saving', `Subiendo el archivo… ${pct} %`)
    );
    value = uploaded.path;
    form.elements.value.value = value;
    form.elements.mediaId.value = uploaded.id;
    state.mediaItems = [uploaded, ...state.mediaItems.filter((item) => item.id !== uploaded.id)];
    setGlobalState('unsaved');
    applyMediaSelection(uploaded);
    if (encuadreElegido) state.encuadre?.fijar(encuadreElegido);
    // Ya subida: si se vuelve a guardar no debe subirse otra vez.
    form.elements.file.value = '';
    form.elements.file.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // La foto de la biblioteca guarda su descripción y su encuadre. Solo viaja
  // lo que cambió: mandar siempre el centro habría pisado el encuadre guardado.
  const mediaId = form.elements.mediaId?.value;
  const [focalX, focalY] = [form.elements.focalX, form.elements.focalY];
  const encuadreCambiado =
    Boolean(focalX?.value) &&
    (focalX.value !== focalX.dataset.inicial || focalY.value !== focalY.dataset.inicial);
  if (esImagen && mediaId) {
    const cambios = {};
    const alt = form.elements.alt;
    if (
      alt?.value.trim() &&
      (form.dataset.medioNuevo === '1' || alt.value !== alt.dataset.inicial)
    ) {
      cambios.alt = alt.value.trim();
    }
    if (encuadreCambiado) {
      cambios.focalX = Number(focalX.value);
      cambios.focalY = Number(focalY.value);
    }
    if (Object.keys(cambios).length) {
      await api(`/api/cms/media/${encodeURIComponent(mediaId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      if (focalX) focalX.dataset.inicial = focalX.value;
      if (focalY) focalY.dataset.inicial = focalY.value;
      guardoAlgo = true;
      setGlobalState('unsaved');
    }
  }

  // Un campo con la imagen predeterminada del sitio no tiene ruta propia: al
  // ajustarle el encuadre se le da la que ya mostraba, para que el sitio sepa
  // a qué foto aplicarlo.
  if (esImagen && !value && encuadreCambiado && form.dataset.rutaActual) {
    value = form.dataset.rutaActual;
    form.elements.value.value = value;
  }

  // A-3: el servidor ya sabía detectar ediciones concurrentes
  // (ContentRepository.updateField compara `expectedVersion` contra la
  // versión actual y lanza un conflicto detallado), pero el overlay nunca
  // se la enviaba: con dos pestañas abiertas ganaba la última escritura,
  // en silencio y sin rastro visible.
  // En una imagen, cambiar solo el encuadre o la descripción no toca el
  // campo: reenviarlo creaba una revisión idéntica y el resumen de
  // publicación lo contaba como un cambio más.
  let updated = state.entry;
  const cambiaCampo = !esImagen || Boolean(file) || value !== valorOriginal;
  if (cambiaCampo) {
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
    guardoAlgo = true;
  }
  // Imprescindible: sin esto el segundo guardado del mismo panel mandaría
  // una versión rancia y el editor entraría en conflicto consigo mismo.
  state.entry = updated;
  setGlobalState('unsaved');

  if (esImagen) {
    if (esVideo && !value) quitarVideoDeLaPagina(element);
    else if (value && value !== valorOriginal) {
      if (esVideo) mostrarVideo(element, value);
      else mostrarImagen(element, value);
    }
    const altField = element.dataset.cmsAltField;
    const alt = form.elements.alt;
    if (altField && alt && alt.value !== alt.dataset.inicial) {
      const altValue = alt.value;
      state.entry = await api(
        `/api/cms/entries/${encodeURIComponent(entryId)}/fields/${encodeURIComponent(altField)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: altValue, expectedVersion: state.entry.version }),
        }
      );
      // Un video no tiene `alt`: su descripción es su nombre accesible.
      element.setAttribute(esVideo ? 'aria-label' : 'alt', altValue);
      alt.dataset.inicial = altValue;
      guardoAlgo = true;
    }
  } else {
    // X-001: actualizar el contenido de texto sin destruir markup anidado.
    // Antes se hacia `element.textContent = value`, lo que borraba cualquier hijo
    // elemento (iconos, badges, spans) dentro de un <EditableText as="h1"> con slot
    // multi-nodo. Ahora editamos solo el textNode editable, preservando el resto.
    const newValue = updated.fields[field]?.value ?? value;
    // Listas y Markdown no son un texto: cada uno se pinta a su manera.
    if (element.dataset.cmsType === 'list') escribirLista(element, asList(newValue));
    else if (element.dataset.cmsType === 'richtext') escribirFormato(element, newValue);
    else escribirTexto(element, newValue);
  }
  // Lo que muestra la página ya está guardado: cerrar no debe revertirlo.
  confirmarEdicion();

  if (esImagen && !guardoAlgo) {
    setEditStatus(form, 'idle', 'No hay cambios que guardar.');
    setFormDirty(false);
    return;
  }
  setEditStatus(
    form,
    'success',
    element.dataset.cmsType === 'richtext'
      ? `${mensajeGuardado()} La página muestra una vista aproximada del formato.`
      : mensajeGuardado()
  );
  setGlobalState('unsaved');
  // A-11: este es el único guardado que no reabre el panel (los formularios
  // de colección y galería vuelven a su listado, y openPanel ya lo limpia).
  setFormDirty(false);
  // E-2: guardado correcto, la copia local ya no hace falta.
  clearDraft(form);
}
