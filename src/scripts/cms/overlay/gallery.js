/**
 * Parte de la interfaz del CMS. Antes esto era `src/scripts/cms-overlay.js`:
 * 3.500 líneas en un solo archivo, inyectadas como string por `set:html`.
 * Ahora son módulos ES que Astro empaqueta, así que los imports son reales y
 * la lógica pura se puede probar sin navegador.
 *
 * El módulo entero se carga con `import()` dinámico y solo cuando el overlay
 * está activo en `editor.*` (o por `?cms=1` en desarrollo), de modo que un visitante normal no descarga nada.
 */

import { escapeHtml } from './html';
import { panelBody } from './shell';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';
import { ensureSession } from './auth';
import { loadMediaPicker } from './media';
import { icon } from './icons';
import { dropzoneMarkup } from './dropzone';

// ─── Gallery management ──────────────────────────────────────────────────
// Gallery view state tracking
export async function loadGallery() {
  if (!(await ensureSession())) return;
  setPanelTitle('Galería');
  openPanel('<p class="hm-cms-muted">Cargando galería...</p>');
  try {
    const [catsData, albumsData, itemsData] = await Promise.all([
      api('/api/cms/gallery/categories'),
      api('/api/cms/gallery/albums'),
      api('/api/cms/gallery/items'),
    ]);
    const cats = catsData.items || [];
    const albums = albumsData.items || [];
    const items = itemsData.items || [];
    // Tres filas de navegación, cada una con su recuento y qué contiene. Antes
    // eran tres tarjetas de cifras más tres botones primarios idénticos que
    // hacían lo mismo que las tarjetas: seis controles para tres destinos.
    const destino = (accion, titulo, cuenta, detalle) => `
      <button type="button" class="hm-cms-nav-row" data-action="${accion}">
        <span class="hm-cms-nav-text">
          <span class="hm-cms-nav-title">${escapeHtml(titulo)}</span>
          <span class="hm-cms-nav-detail">${escapeHtml(detalle)}</span>
        </span>
        <span class="hm-cms-nav-count">${cuenta}</span>
      </button>`;
    openPanel(`
      <div class="hm-cms-stack">
        <p class="hm-cms-hint">Las fotos que aparecen en la página «Galería» del sitio.</p>
        <div class="hm-cms-nav-list">
          ${destino('gallery-items', 'Gestionar imágenes', items.length, 'Agregar, describir o quitar fotos')}
          ${destino('gallery-albums', 'Gestionar álbumes', albums.length, 'Una obra con sus fotos')}
          ${destino('gallery-cats', 'Gestionar categorías', cats.length, 'Los filtros de la galería')}
        </div>
      </div>
    `);
  } catch (error) {
    openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
  }
}

function normalizedGallerySearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function applyGalleryTaxonomySearch({
  query,
  rowSelector,
  countSelector,
  emptySelector,
  total,
  kind,
}) {
  const normalizedQuery = normalizedGallerySearch(query);
  const rows = panelBody.querySelectorAll(rowSelector);
  let visible = 0;

  rows.forEach((row) => {
    const matches =
      !normalizedQuery ||
      normalizedGallerySearch(row.dataset.gallerySearchText).includes(normalizedQuery);
    row.hidden = !matches;
    if (matches) visible++;
  });

  const count = panelBody.querySelector(countSelector);
  if (count) {
    const label = total === 1 ? kind.singular : kind.plural;
    count.textContent = normalizedQuery ? `${visible} de ${total} ${label}` : `${total} ${label}`;
  }

  const empty = panelBody.querySelector(emptySelector);
  if (empty) {
    empty.textContent = query.trim()
      ? `${kind.noMatch} coincide con «${query.trim()}».`
      : `No hay ${kind.plural} todavía.`;
    empty.hidden = visible > 0;
  }
}

let galleryCategorySearch = '';
let galleryAlbumSearch = '';
let galleryCategoriesListCache = [];
let galleryAlbumsListCache = [];

export function filterGalleryCategories(text) {
  galleryCategorySearch = text;
  applyGalleryTaxonomySearch({
    query: galleryCategorySearch,
    rowSelector: '[data-gallery-category-row]',
    countSelector: '[data-gallery-category-count]',
    emptySelector: '[data-gallery-category-empty]',
    total: galleryCategoriesListCache.length,
    kind: { singular: 'categoría', plural: 'categorías', noMatch: 'Ninguna categoría' },
  });
}

export function resetGalleryCategorySearch() {
  galleryCategorySearch = '';
}

export function filterGalleryAlbums(text) {
  galleryAlbumSearch = text;
  applyGalleryTaxonomySearch({
    query: galleryAlbumSearch,
    rowSelector: '[data-gallery-album-row]',
    countSelector: '[data-gallery-album-count]',
    emptySelector: '[data-gallery-album-empty]',
    total: galleryAlbumsListCache.length,
    kind: { singular: 'álbum', plural: 'álbumes', noMatch: 'Ningún álbum' },
  });
}

export function resetGalleryAlbumSearch() {
  galleryAlbumSearch = '';
}

export async function loadGalleryCategories() {
  if (!(await ensureSession())) return;
  setPanelTitle('Categorías de galería');
  openPanel('<p class="hm-cms-muted">Cargando categorías...</p>');
  try {
    const data = await api('/api/cms/gallery/categories');
    const cats = data.items || [];
    galleryCategoriesListCache = cats;
    openPanel(`
      <div class="hm-cms-stack">
        <button type="button" class="ghost small hm-cms-back" data-action="gallery">${icon('arrowLeft')}Volver a Galería</button>
        <div class="hm-cms-toolbar">
          <label class="hm-cms-grow">Buscar categoría
            <input name="galleryCategorySearch" type="search" data-gallery-category-search
              placeholder="Nombre" value="${escapeHtml(galleryCategorySearch)}" />
          </label>
          <button type="button" class="primary" data-action="gallery-new-cat">${icon('plus')}Nueva categoría</button>
        </div>
        <p class="hm-cms-count" role="status" aria-live="polite" data-gallery-category-count></p>
        <div class="hm-cms-collection-list">
          ${cats
            .map(
              (cat) => `
            <div class="hm-cms-collection-item" data-gallery-category-row data-gallery-search-text="${escapeHtml(`${cat.name} ${cat.slug}`)}" data-cat-id="${escapeHtml(cat.id)}">
              <div class="hm-cms-collection-info">
                <span class="hm-cms-collection-title">${escapeHtml(cat.name)}</span>
              </div>
              <div class="hm-cms-collection-actions">
                <button type="button" class="secondary small" data-action="gallery-edit-cat" data-cat-id="${escapeHtml(cat.id)}">${icon('pencil')}Editar</button>
                <button type="button" class="icon ghost destructive" data-action="gallery-delete-cat" data-cat-id="${escapeHtml(cat.id)}" data-cat-name="${escapeHtml(cat.name)}" aria-label="Eliminar categoría: ${escapeHtml(cat.name)}" title="Eliminar categoría: ${escapeHtml(cat.name)}">${icon('trash')}</button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        <p class="hm-cms-empty" data-gallery-category-empty hidden></p>
      </div>
    `);
    filterGalleryCategories(galleryCategorySearch);
  } catch (error) {
    openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
  }
}

export async function showGalleryCategoryForm(catId = null) {
  if (!(await ensureSession())) return;
  setPanelTitle(catId ? 'Editar categoría' : 'Nueva categoría');

  let cat = { name: '', slug: '' };
  if (catId) {
    try {
      const data = await api('/api/cms/gallery/categories');
      cat = (data.items || []).find((c) => c.id === catId) || cat;
    } catch {
      /* use defaults */
    }
  }

  openPanel(`
    <form data-gallery-cat-form data-cat-id="${catId ? escapeHtml(catId) : ''}">
      <label>Nombre
        <input name="name" value="${escapeHtml(cat.name)}" required />
      </label>
      <details class="hm-cms-advanced">
        <summary>Opciones avanzadas</summary>
        <label>Identificador en la dirección
          <input name="slug" value="${escapeHtml(cat.slug)}" pattern="[a-z0-9-]+" placeholder="Se genera a partir del nombre" />
        </label>
        <p class="hm-cms-hint">Se usa en la dirección de los filtros. Solo minúsculas, números y guiones.</p>
      </details>
      <div class="hm-cms-actions hm-cms-footer">
        <button type="submit">${catId ? 'Guardar cambios' : 'Crear categoría'}</button>
        <button type="button" class="ghost" data-action="gallery-cats">Cancelar</button>
        <p class="hm-cms-save-state" role="status" aria-live="polite" data-status></p>
      </div>
    </form>
  `);

  // Auto-generate slug from name
  const form = panelBody.querySelector('[data-gallery-cat-form]');
  const nameInput = form?.querySelector('[name="name"]');
  const slugInput = form?.querySelector('[name="slug"]');
  if (nameInput && slugInput && !catId) {
    nameInput.addEventListener('input', () => {
      slugInput.value = nameInput.value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    });
  }
}

export async function loadGalleryAlbums() {
  if (!(await ensureSession())) return;
  setPanelTitle('Álbumes de galería');
  openPanel('<p class="hm-cms-muted">Cargando álbumes...</p>');
  try {
    const data = await api('/api/cms/gallery/albums');
    const albums = data.items || [];
    galleryAlbumsListCache = albums;
    openPanel(`
      <div class="hm-cms-stack">
        <button type="button" class="ghost small hm-cms-back" data-action="gallery">${icon('arrowLeft')}Volver a Galería</button>
        <p class="hm-cms-hint">Un álbum agrupa las fotos de una obra; su nombre es el que ve el visitante. Las fotos se asignan desde «Gestionar imágenes».</p>
        <div class="hm-cms-toolbar">
          <label class="hm-cms-grow">Buscar álbum
            <input name="galleryAlbumSearch" type="search" data-gallery-album-search
              placeholder="Nombre" value="${escapeHtml(galleryAlbumSearch)}" />
          </label>
          <button type="button" class="primary" data-action="gallery-new-album">${icon('plus')}Nuevo álbum</button>
        </div>
        <p class="hm-cms-count" role="status" aria-live="polite" data-gallery-album-count></p>
        <div class="hm-cms-collection-list">
          ${albums
            .map(
              (album) => `
            <div class="hm-cms-collection-item" data-gallery-album-row data-gallery-search-text="${escapeHtml(`${album.name} ${album.slug}`)}" data-album-slug="${escapeHtml(album.slug)}">
              <div class="hm-cms-collection-info">
                <span class="hm-cms-collection-title">${escapeHtml(album.name)}</span>
                <span class="hm-cms-collection-meta">${album.itemCount} ${album.itemCount === 1 ? 'foto' : 'fotos'}</span>
              </div>
              <div class="hm-cms-collection-actions">
                <button type="button" class="secondary small" data-action="gallery-edit-album" data-album-slug="${escapeHtml(album.slug)}">${icon('pencil')}Editar</button>
                <button type="button" class="icon ghost destructive" data-action="gallery-delete-album" data-album-slug="${escapeHtml(album.slug)}" data-album-name="${escapeHtml(album.name)}" aria-label="Eliminar álbum: ${escapeHtml(album.name)}" title="Eliminar álbum: ${escapeHtml(album.name)}">${icon('trash')}</button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        <p class="hm-cms-empty" data-gallery-album-empty hidden></p>
      </div>
    `);
    filterGalleryAlbums(galleryAlbumSearch);
  } catch (error) {
    openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
  }
}

export async function showGalleryAlbumForm(albumSlug = null) {
  if (!(await ensureSession())) return;
  setPanelTitle(albumSlug ? 'Editar álbum' : 'Nuevo álbum');

  let album = { name: '', slug: '', itemCount: 0 };
  if (albumSlug) {
    try {
      const data = await api('/api/cms/gallery/albums');
      album = (data.items || []).find((a) => a.slug === albumSlug) || album;
    } catch {
      /* use defaults */
    }
  }

  openPanel(`
    <form data-gallery-album-form data-album-slug="${albumSlug ? escapeHtml(albumSlug) : ''}">
      <label>Nombre
        <input name="name" value="${escapeHtml(album.name)}" required />
      </label>
      <details class="hm-cms-advanced" ${albumSlug ? '' : 'open'}>
        <summary>Enlace con el proyecto</summary>
        <label>Identificador del proyecto
          <input name="slug" value="${escapeHtml(album.slug)}" pattern="[a-z0-9-]+" placeholder="Se genera a partir del nombre" ${albumSlug ? 'readonly' : ''} />
        </label>
        <p class="hm-cms-hint">${
          albumSlug
            ? 'No se puede cambiar: es lo que une las fotos del álbum con la página /proyectos/' +
              escapeHtml(album.slug) +
              '. El nombre sí se puede cambiar.'
            : 'Debe coincidir con la dirección del proyecto (/proyectos/…) para que sus fotos aparezcan allí. Solo minúsculas, números y guiones.'
        }</p>
      </details>
      <div class="hm-cms-actions hm-cms-footer">
        <button type="submit">${albumSlug ? 'Guardar cambios' : 'Crear álbum'}</button>
        <button type="button" class="ghost" data-action="gallery-albums">Cancelar</button>
        <p class="hm-cms-save-state" role="status" aria-live="polite" data-status></p>
      </div>
    </form>
  `);

  // Auto-generate slug from name
  const form = panelBody.querySelector('[data-gallery-album-form]');
  const nameInput = form?.querySelector('[name="name"]');
  const slugInput = form?.querySelector('[name="slug"]');
  if (nameInput && slugInput && !albumSlug) {
    nameInput.addEventListener('input', () => {
      slugInput.value = nameInput.value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    });
  }
}

// M-1: la lista pintaba las 177 fotos de golpe, sin buscador ni filtro, en
// un panel de 420 px. Encontrar una foto concreta era imposible en la
// práctica. El filtrado es local porque el catálogo entero cabe en una
// petición; lo que se acota es cuántas miniaturas se pintan.
export const GALLERY_PAGE_SIZE = 60;

export const galleryFilter = { q: '', album: '', categoria: '', limite: GALLERY_PAGE_SIZE };

let galleryItemsCache = [];

let galleryAlbumsCache = [];

let galleryCatsCache = [];

export let galleryFilterTimer;

/**
 * Aplica el texto del buscador de la galería tras una pausa.
 *
 * Repintar la lista destruye el input, así que al terminar se le devuelve el
 * foco y el cursor al final de lo escrito.
 */
export function scheduleGalleryFilter(texto) {
  galleryFilter.q = texto;
  galleryFilter.limite = GALLERY_PAGE_SIZE;
  clearTimeout(galleryFilterTimer);
  galleryFilterTimer = setTimeout(async () => {
    await loadGalleryItemsList({ recargar: false });
    const nuevo = panelBody.querySelector('[data-gallery-filter-q]');
    if (nuevo) {
      nuevo.focus();
      nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
    }
  }, 250);
}

function galleryItemsFiltrados() {
  const q = galleryFilter.q.trim().toLowerCase();
  return galleryItemsCache.filter((item) => {
    if (galleryFilter.album && (item.projectSlug || '') !== galleryFilter.album) return false;
    if (galleryFilter.categoria && (item.categoryId || '') !== galleryFilter.categoria) {
      return false;
    }
    if (!q) return true;
    return `${item.alt || ''} ${item.projectSlug || ''} ${item.categoryName || ''}`
      .toLowerCase()
      .includes(q);
  });
}

function renderGalleryItemsList(albums, cats, { autofocus = true } = {}) {
  const filtrados = galleryItemsFiltrados();
  const visibles = filtrados.slice(0, galleryFilter.limite);
  const restantes = filtrados.length - visibles.length;
  const opciones = (lista, valorActual, claveValor, claveTexto) =>
    lista
      .map(
        (x) =>
          `<option value="${escapeHtml(x[claveValor])}"${x[claveValor] === valorActual ? ' selected' : ''}>${escapeHtml(x[claveTexto])}</option>`
      )
      .join('');

  openPanel(
    `
    <div class="hm-cms-stack">
      <button type="button" class="ghost small hm-cms-back" data-action="gallery">${icon('arrowLeft')}Volver a Galería</button>
      <div class="hm-cms-toolbar">
        <label class="hm-cms-grow">Buscar
          <input name="galleryFilterQ" type="search" data-gallery-filter-q
            placeholder="Descripción, álbum o categoría" value="${escapeHtml(galleryFilter.q)}" />
        </label>
        <button type="button" class="primary" data-action="gallery-new-item">${icon('plus')}Agregar imagen</button>
      </div>
      <div class="hm-cms-two">
        <label>Álbum
          <select data-gallery-filter-album>
            <option value="">Todos</option>
            ${opciones(albums, galleryFilter.album, 'slug', 'name')}
          </select>
        </label>
        <label>Categoría
          <select data-gallery-filter-cat>
            <option value="">Todas</option>
            ${opciones(cats, galleryFilter.categoria, 'id', 'name')}
          </select>
        </label>
      </div>
      <p class="hm-cms-count">${
        filtrados.length === galleryItemsCache.length
          ? `${galleryItemsCache.length} imágenes`
          : `${filtrados.length} de ${galleryItemsCache.length} imágenes`
      }</p>
      ${
        filtrados.length === 0
          ? '<p class="hm-cms-empty">Ninguna foto coincide con el filtro.</p>'
          : `<div class="hm-cms-gallery-grid">
              ${visibles
                .map(
                  (item) => `
                <button type="button" class="hm-cms-gallery-thumb" data-action="gallery-edit-item" data-item-id="${escapeHtml(item.id)}" aria-label="Editar imagen: ${escapeHtml(item.alt || 'sin descripción')}" title="${escapeHtml(item.alt)}">
                  <img src="${escapeHtml(item.mediaPath)}" alt="" loading="lazy" />
                  ${item.featured ? `<span class="hm-cms-gallery-featured" title="Destacada">${icon('star', { size: 12 })}</span>` : ''}
                </button>
              `
                )
                .join('')}
            </div>
            ${
              restantes > 0
                ? `<button type="button" class="secondary" data-action="gallery-load-more">Ver ${Math.min(restantes, GALLERY_PAGE_SIZE)} más (${restantes} restantes)</button>`
                : ''
            }`
      }
    </div>
  `,
    { autofocus }
  );
}

export async function loadGalleryItemsList({ recargar = true } = {}) {
  if (!(await ensureSession())) return;
  setPanelTitle('Imágenes de galería');
  if (recargar) {
    openPanel('<p class="hm-cms-muted">Cargando imágenes...</p>');
    try {
      const [itemsData, albumsData, catsData] = await Promise.all([
        api('/api/cms/gallery/items'),
        api('/api/cms/gallery/albums'),
        api('/api/cms/gallery/categories'),
      ]);
      galleryItemsCache = itemsData.items || [];
      galleryAlbumsCache = albumsData.items || [];
      galleryCatsCache = catsData.items || [];
      galleryFilter.limite = GALLERY_PAGE_SIZE;
    } catch (error) {
      openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
      return;
    }
  }
  renderGalleryItemsList(galleryAlbumsCache, galleryCatsCache, { autofocus: recargar });
}

export async function showGalleryItemForm(itemId = null) {
  if (!(await ensureSession())) return;
  setPanelTitle(itemId ? 'Editar imagen' : 'Agregar imagen');

  let item = {
    mediaId: '',
    categoryId: null,
    alt: '',
    featured: false,
    status: 'published',
  };
  let catsData = { items: [] };
  let albumsData = { items: [] };

  try {
    [catsData, albumsData] = await Promise.all([
      api('/api/cms/gallery/categories'),
      api('/api/cms/gallery/albums'),
    ]);
    if (itemId) {
      item = await api(`/api/cms/gallery/items/${encodeURIComponent(itemId)}`);
    }
  } catch {
    /* use defaults */
  }

  const cats = catsData.items || [];
  const albums = albumsData.items || [];

  openPanel(`
    <form data-gallery-item-form data-item-id="${itemId ? escapeHtml(itemId) : ''}">
      <input name="mediaId" type="hidden" value="${escapeHtml(item.mediaId || '')}" />
      <div class="hm-cms-image-preview" ${item.mediaPath ? '' : 'hidden'} data-gallery-preview-box>
        <img data-gallery-media-preview src="${item.mediaPath ? escapeHtml(item.mediaPath) : ''}" alt="" />
      </div>
      ${dropzoneMarkup({ atributos: 'data-gallery-upload', texto: itemId ? 'Reemplazar por otra imagen' : 'Subir una imagen' })}
      <div class="hm-cms-field-group">
        <label>O elegir de la biblioteca
          <input name="mediaSearch" type="search" placeholder="Buscar por nombre o descripción" data-gallery-media-search />
        </label>
        <div data-gallery-media-grid class="hm-cms-media-grid">
          <p class="hm-cms-hint">Cargando imágenes…</p>
        </div>
      </div>
      <label>Descripción de la foto
        <input name="alt" value="${escapeHtml(item.alt)}" required aria-describedby="hm-cms-gallery-alt-hint" />
      </label>
      <p class="hm-cms-hint" id="hm-cms-gallery-alt-hint">No se ve en pantalla: la leen quienes no pueden ver la foto, y es lo que busca el filtro de la galería.</p>
      <label>Categoría
        <select name="categoryId">
          <option value="">Sin categoría</option>
          ${cats.map((cat) => `<option value="${escapeHtml(cat.id)}" ${cat.id === item.categoryId ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`).join('')}
        </select>
      </label>
      <label>Álbum (obra)
        <select name="projectSlug">
          <option value="">Sin álbum</option>
          ${albums.map((album) => `<option value="${escapeHtml(album.slug)}" ${album.slug === item.projectSlug ? 'selected' : ''}>${escapeHtml(album.name)}</option>`).join('')}
        </select>
      </label>
      <label>Estado
        <select name="status">
          <option value="published" ${item.status === 'published' ? 'selected' : ''}>Visible en el sitio</option>
          <option value="draft" ${item.status === 'draft' ? 'selected' : ''}>Oculta (borrador)</option>
        </select>
      </label>
      <label class="hm-cms-check">
        <input name="featured" type="checkbox" ${item.featured ? 'checked' : ''} />
        Destacada
      </label>
      ${
        itemId
          ? `<div class="hm-cms-edit-actions-danger">
          <button type="button" class="ghost destructive small" data-action="gallery-delete-item" data-item-id="${escapeHtml(itemId)}" data-item-title="${escapeHtml(item.alt)}">${icon('trash')}Quitar de la galería</button>
        </div>`
          : ''
      }
      <div class="hm-cms-actions hm-cms-footer">
        <button type="submit">${itemId ? 'Guardar cambios' : 'Agregar a la galería'}</button>
        <button type="button" class="ghost" data-action="gallery-items">Cancelar</button>
        <p class="hm-cms-save-state" role="status" aria-live="polite" data-status></p>
      </div>
    </form>
  `);

  // Load media picker
  try {
    await loadMediaPicker({ reset: true });
  } catch {
    /* silent */
  }
}
