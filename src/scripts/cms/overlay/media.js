/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo en `editor.*` (o por `?cms=1` en desarrollo), de modo que un visitante normal no descarga nada.
 */

import { state } from './context';
import { escapeHtml } from './html';
import { panelBody } from './shell';
import { api } from './api';
import { icon } from './icons';
import { previsualizarEnfoque, previsualizarImagen, previsualizarVideo } from './edicion';
import { posicionCss } from './encuadre';
import { pareceNombreDeArchivo } from './alt';

/**
 * A-2 — Un solo selector de medios, paginado y con búsqueda en el servidor.
 *
 * Antes había dos implementaciones casi idénticas y ambas pedían
 * `/api/cms/media` sin parámetros: recibían las 100 más recientes y
 * filtraban en memoria. Con 2.122 assets en el catálogo, 2.022 eran
 * inalcanzables desde la interfaz — y el editor acababa subiendo
 * duplicados de fotos que ya estaban en el sistema. El servidor ya sabía
 * paginar y buscar sobre name/alt/path; solo faltaba usarlo.
 */
const MEDIA_PAGE_SIZE = 60;

export const mediaPicker = { query: '', page: 1, pages: 1, total: 0, loading: false, seq: 0 };

let mediaSearchTimer;

export let previewTimer;

/**
 * Programa el refresco de la vista previa de un campo de imagen.
 *
 * B-6: asignar el `src` en cada tecla hacía que el navegador pidiera una URL
 * por pulsación (se capturó un 404 de `/TEXTO%20DE%20AUDITORIA%20SIN%20GUARDAR`)
 * y la vista previa parpadeaba en roto mientras se escribía.
 */
export function schedulePreviewUpdate(valor) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    const preview = panelBody.querySelector('[data-image-preview]');
    // Solo cuando parece una ruta completa a una imagen.
    if (preview && /^\/.+\.(webp|jpe?g|png|svg|avif)$/i.test(valor)) {
      preview.setAttribute('src', valor);
      previsualizarImagen(valor);
    }
    // O a un video, en el editor de video.
    const video = panelBody.querySelector('[data-video-preview]');
    if (video && /^\/.+\.(mp4|webm)$/i.test(valor)) {
      video.setAttribute('src', valor);
      previsualizarVideo(valor);
    }
  }, 400);
}

function mediaTileMarkup(item, { action, selected }) {
  // C-2: un asset cuyo archivo no está en disco se marca en vez de
  // renderizarse como una miniatura rota sin explicación.
  const esVideo = String(item.mime || '').startsWith('video/');
  const cuerpo = item.missing
    ? `<span class="hm-cms-media-missing">${icon('alert')}Archivo no encontrado</span>`
    : esVideo
      ? // Un fotograma y quieto: una cuadrícula de videos moviéndose a la vez marea.
        `<video src="${escapeHtml(item.path)}#t=0.5" muted playsinline preload="metadata" aria-hidden="true"></video>`
      : // alt vacío cuando no hay texto alternativo propio: el nombre del archivo
        // ya va en el <span> de debajo, y repetirlo hacía que un lector de pantalla
        // leyera dos veces lo mismo por cada miniatura (axe: image-redundant-alt).
        `<img src="${escapeHtml(item.path)}" alt="${escapeHtml(item.alt || '')}" loading="lazy" />`;
  return `
    <button
      type="button"
      class="hm-cms-media-item ${selected ? 'selected' : ''}"
      data-action="${action}"
      data-media-id="${escapeHtml(item.id)}"
      ${item.missing ? 'disabled title="El archivo no existe en disco"' : ''}
    >
      ${cuerpo}
      <span class="hm-cms-media-name">${escapeHtml(item.name)}</span>
      ${item.usageCount > 0 ? `<span class="hm-cms-media-usage">En uso · ${item.usageCount}</span>` : ''}
    </button>
  `;
}

/** Descriptor del selector activo: el del editor de campo o el de galería. */
function activeMediaPicker() {
  const galleryGrid = panelBody.querySelector('[data-gallery-media-grid]');
  if (galleryGrid) {
    const form = panelBody.querySelector('[data-gallery-item-form]');
    return {
      grid: galleryGrid,
      action: 'gallery-select-media',
      selectedId: form?.querySelector('[name="mediaId"]')?.value || '',
      selectedPath: '',
      tipo: 'imagen',
    };
  }
  const grid = panelBody.querySelector('[data-media-grid]');
  if (!grid) return null;
  const form = panelBody.querySelector('[data-edit]');
  return {
    grid,
    action: 'select-media',
    selectedId: '',
    selectedPath: form?.elements.value?.value || '',
    // El editor de un video solo ofrece videos, y el de una foto, fotos.
    tipo: form?.dataset.tipoMedio || 'imagen',
  };
}

export function renderMediaPicker() {
  const picker = activeMediaPicker();
  if (!picker) return;

  if (!state.mediaItems.length) {
    picker.grid.innerHTML = mediaPicker.loading
      ? '<p class="hm-cms-hint hm-cms-media-wide">Buscando…</p>'
      : `<p class="hm-cms-hint hm-cms-media-wide">${
          picker.tipo !== 'video'
            ? 'Ninguna imagen coincide con la búsqueda.'
            : mediaPicker.query
              ? 'Ningún video coincide con la búsqueda.'
              : 'Todavía no hay videos en la biblioteca: sube uno arriba.'
        }</p>`;
    return;
  }

  const restantes = Math.max(0, mediaPicker.total - state.mediaItems.length);
  picker.grid.innerHTML =
    state.mediaItems
      .map((item) =>
        mediaTileMarkup(item, {
          action: picker.action,
          selected: picker.selectedId
            ? item.id === picker.selectedId
            : item.path === picker.selectedPath,
        })
      )
      .join('') +
    `<p class="hm-cms-hint hm-cms-media-wide">Mostrando ${state.mediaItems.length} de ${mediaPicker.total}.</p>` +
    (restantes > 0
      ? `<button type="button" class="secondary small hm-cms-media-wide" data-action="load-more-media">${
          mediaPicker.loading ? 'Cargando…' : `Ver más (quedan ${restantes})`
        }</button>`
      : '');
}

export async function loadMediaPicker({ reset = true } = {}) {
  const picker = activeMediaPicker();
  if (!picker || mediaPicker.loading) return;

  if (reset) {
    mediaPicker.page = 1;
    state.mediaItems = [];
  }
  mediaPicker.loading = true;
  const seq = ++mediaPicker.seq;
  renderMediaPicker();

  try {
    const params = new URLSearchParams({
      page: String(mediaPicker.page),
      limit: String(MEDIA_PAGE_SIZE),
    });
    if (mediaPicker.query) params.set('q', mediaPicker.query);
    params.set('tipo', picker.tipo);
    const data = await api(`/api/cms/media?${params}`);
    // Descartar respuestas fuera de orden: con LIKE sobre tres columnas sin
    // índice, escribir rápido las devuelve desordenadas.
    if (seq !== mediaPicker.seq) return;

    const nuevos = data.items || [];
    // `state.mediaItems` es buffer acumulado a propósito: los handlers de
    // selección resuelven el asset por id contra él.
    state.mediaItems = reset ? nuevos : [...state.mediaItems, ...nuevos];
    mediaPicker.total = data.total ?? state.mediaItems.length;
    mediaPicker.pages = data.pages ?? 1;
    mediaPicker.loading = false;
    renderMediaPicker();
  } catch (error) {
    mediaPicker.loading = false;
    if (seq !== mediaPicker.seq) return;
    picker.grid.innerHTML = `<p class="hm-cms-error">${escapeHtml(error.message)}</p>`;
  }
}

export function searchMediaPicker(query) {
  mediaPicker.query = query.trim();
  clearTimeout(mediaSearchTimer);
  mediaSearchTimer = setTimeout(() => loadMediaPicker({ reset: true }), 300);
}

export function applyMediaSelection(asset) {
  const form = panelBody.querySelector('[data-edit]');
  if (!form) return;

  form.elements.value.value = asset.path;
  form.elements.mediaId.value = asset.id;
  form.dataset.medioNuevo = '1';
  // P2-13 (auditoría 2026-09): la descripción de la biblioteca solo se usa si
  // es una descripción de verdad. Si es el nombre del archivo, o no hay, el
  // campo queda vacío y se pide una: antes se pegaba «DSCF2109» sobre una
  // descripción buena, o se quedaba la de la foto anterior.
  if (form.elements.alt) {
    const util = asset.alt && !pareceNombreDeArchivo(asset.alt, asset.name || asset.path);
    form.elements.alt.value = util ? asset.alt : '';
    if (!util) pedirDescripcion(form);
  }
  // La foto (o el video) elegida se ve ya en la página, con su propio
  // encuadre; si no se guarda, vuelve la anterior.
  const esVideo = String(asset.mime || '').startsWith('video/');
  if (esVideo) previsualizarVideo(asset.path);
  else previsualizarImagen(asset.path);
  const enfoque = { x: asset.focalX ?? 0.5, y: asset.focalY ?? 0.5 };
  if (state.encuadre) {
    state.encuadre.fijar(enfoque, { inicial: true });
    state.encuadre.habilitar(true);
  }
  previsualizarEnfoque(posicionCss(enfoque));

  const preview = panelBody.querySelector(
    esVideo ? '[data-video-preview]' : '[data-image-preview]'
  );
  if (preview) {
    preview.setAttribute('src', asset.path);
    if (!esVideo) preview.setAttribute('alt', asset.alt || asset.name);
  }

  const label = panelBody.querySelector('[data-selected-media-label]');
  if (label)
    label.textContent = `${asset.name}${asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}`;

  renderMediaPicker();
}

/** Resalta el campo de descripción para que la persona escriba una. */
export function pedirDescripcion(form) {
  const alt = form?.elements?.alt;
  if (!alt) return;
  alt.setAttribute('aria-invalid', 'true');
  alt.placeholder = 'Describe lo que se ve en la foto';
  alt.addEventListener('input', () => alt.removeAttribute('aria-invalid'), { once: true });
}
