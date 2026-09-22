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
import { panelBody } from './shell';
import { api } from './api';
import { openPanel, setPanelTitle } from './panel';
import { ensureSession } from './auth';
import { loadMediaPicker } from './media';

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
    openPanel(`
      <div style="display:grid;gap:12px">
        <p class="hm-cms-muted">Gestiona las imágenes que aparecen en la página de galería del sitio.</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          <button type="button" data-action="gallery-cats" style="padding:16px;border:1px solid var(--hm-cms-line-soft);border-radius:0px;background:white;cursor:pointer;text-align:center">
            <strong style="display:block;font-size:24px;color:var(--hm-cms-primary)">${cats.length}</strong>
            <span style="font-size:12px;color:var(--hm-cms-ink-softer)">Categorías</span>
          </button>
          <button type="button" data-action="gallery-albums" style="padding:16px;border:1px solid var(--hm-cms-line-soft);border-radius:0px;background:white;cursor:pointer;text-align:center">
            <strong style="display:block;font-size:24px;color:var(--hm-cms-primary)">${albums.length}</strong>
            <span style="font-size:12px;color:var(--hm-cms-ink-softer)">Álbumes</span>
          </button>
          <button type="button" data-action="gallery-items" style="padding:16px;border:1px solid var(--hm-cms-line-soft);border-radius:0px;background:white;cursor:pointer;text-align:center">
            <strong style="display:block;font-size:24px;color:var(--hm-cms-primary)">${items.length}</strong>
            <span style="font-size:12px;color:var(--hm-cms-ink-softer)">Imágenes</span>
          </button>
        </div>
        <button type="button" data-action="gallery-cats">Gestionar categorías</button>
        <button type="button" data-action="gallery-albums">Gestionar álbumes</button>
        <button type="button" data-action="gallery-items">Gestionar imágenes</button>
      </div>
    `);
  } catch (error) {
    openPanel(`<p class="hm-cms-error">${escapeHtml(error.message)}</p>`);
  }
}

export async function loadGalleryCategories() {
  if (!(await ensureSession())) return;
  setPanelTitle('Categorías de galería');
  openPanel('<p class="hm-cms-muted">Cargando categorías...</p>');
  try {
    const data = await api('/api/cms/gallery/categories');
    const cats = data.items || [];
    openPanel(`
      <div style="display:grid;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span style="font-size:13px;color:var(--hm-cms-muted-soft)">${cats.length} categorías</span>
          <button type="button" data-action="gallery-new-cat">+ Nueva categoría</button>
        </div>
        <div style="display:grid;gap:6px">
          ${cats
            .map(
              (cat) => `
            <div class="hm-cms-gallery-cat-btn" data-cat-id="${escapeHtml(cat.id)}">
              <div>
                <span class="hm-cms-gallery-cat-name">${escapeHtml(cat.name)}</span>
                <span class="hm-cms-gallery-cat-slug">${escapeHtml(cat.slug)}</span>
              </div>
              <div style="display:flex;gap:4px">
                <button type="button" class="secondary" style="font-size:11px;padding:4px 8px" data-action="gallery-edit-cat" data-cat-id="${escapeHtml(cat.id)}">Editar</button>
                <button type="button" class="secondary destructive" style="font-size:11px;padding:4px 8px" data-action="gallery-delete-cat" data-cat-id="${escapeHtml(cat.id)}" data-cat-name="${escapeHtml(cat.name)}">×</button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        <button type="button" class="secondary" data-action="gallery">← Volver a galería</button>
      </div>
    `);
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
      <label>Slug (URL)
        <input name="slug" value="${escapeHtml(cat.slug)}" pattern="[a-z0-9-]+" placeholder="auto-generado" />
      </label>
      <p class="hm-cms-muted">El slug se usa en la URL y los filtros. Solo letras minúsculas, números y guiones.</p>
      <div class="hm-cms-actions">
        <button type="submit">${catId ? 'Guardar cambios' : 'Crear categoría'}</button>
        <button type="button" class="secondary" data-action="gallery-cats">Cancelar</button>
      </div>
      <p class="hm-cms-muted" role="status" aria-live="polite" data-status></p>
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
    openPanel(`
      <div style="display:grid;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span style="font-size:13px;color:var(--hm-cms-muted-soft)">${albums.length} álbumes</span>
          <button type="button" data-action="gallery-new-album">+ Nuevo álbum</button>
        </div>
        <div style="display:grid;gap:6px">
          ${albums
            .map(
              (album) => `
            <div class="hm-cms-gallery-cat-btn" data-album-slug="${escapeHtml(album.slug)}">
              <div>
                <span class="hm-cms-gallery-cat-name">${escapeHtml(album.name)}</span>
                <span class="hm-cms-gallery-cat-slug">${escapeHtml(album.slug)} · ${album.itemCount} foto${album.itemCount === 1 ? '' : 's'}</span>
              </div>
              <div style="display:flex;gap:4px">
                <button type="button" class="secondary" style="font-size:11px;padding:4px 8px" data-action="gallery-edit-album" data-album-slug="${escapeHtml(album.slug)}">Editar</button>
                <button type="button" class="secondary destructive" style="font-size:11px;padding:4px 8px" data-action="gallery-delete-album" data-album-slug="${escapeHtml(album.slug)}" data-album-name="${escapeHtml(album.name)}">×</button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        <p class="hm-cms-muted">El álbum agrupa las fotos de una obra y su nombre es el que ve el visitante. Las fotos se asignan desde "Gestionar imágenes".</p>
        <button type="button" class="secondary" data-action="gallery">← Volver a galería</button>
      </div>
    `);
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
      <label>Slug (URL del proyecto)
        <input name="slug" value="${escapeHtml(album.slug)}" pattern="[a-z0-9-]+" placeholder="auto-generado" ${albumSlug ? 'readonly' : ''} />
      </label>
      <p class="hm-cms-muted">${
        albumSlug
          ? 'El slug no se puede cambiar: es lo que enlaza las fotos del álbum con /proyectos/&lt;slug&gt;. El nombre sí, y es el que ve el visitante.'
          : 'El slug enlaza el álbum con la página del proyecto (/proyectos/&lt;slug&gt;). Solo letras minúsculas, números y guiones.'
      }</p>
      <div class="hm-cms-actions">
        <button type="submit">${albumSlug ? 'Guardar cambios' : 'Crear álbum'}</button>
        <button type="button" class="secondary" data-action="gallery-albums">Cancelar</button>
      </div>
      <p class="hm-cms-muted" role="status" aria-live="polite" data-status></p>
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
    <div style="display:grid;gap:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <span style="font-size:13px;color:var(--hm-cms-muted-soft)">
          ${
            filtrados.length === galleryItemsCache.length
              ? `${galleryItemsCache.length} imágenes`
              : `${filtrados.length} de ${galleryItemsCache.length}`
          }
        </span>
        <button type="button" data-action="gallery-new-item">+ Agregar imagen</button>
      </div>
      <label>Buscar
        <input name="galleryFilterQ" type="search" data-gallery-filter-q
          placeholder="Texto alternativo, álbum o categoría" value="${escapeHtml(galleryFilter.q)}" />
      </label>
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
      ${
        filtrados.length === 0
          ? '<p class="hm-cms-muted">Ninguna foto coincide con el filtro.</p>'
          : `<div class="hm-cms-gallery-grid">
              ${visibles
                .map(
                  (item) => `
                <button type="button" class="hm-cms-gallery-thumb" data-action="gallery-edit-item" data-item-id="${escapeHtml(item.id)}" aria-label="Editar imagen: ${escapeHtml(item.alt || 'sin descripción')}" title="${escapeHtml(item.alt)}">
                  <img src="${escapeHtml(item.mediaPath)}" alt="" loading="lazy" />
                  ${item.featured ? '<span class="hm-cms-gallery-featured">★</span>' : ''}
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
      <button type="button" class="secondary" data-action="gallery">← Volver a galería</button>
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
      <img data-gallery-media-preview src="${item.mediaPath ? escapeHtml(item.mediaPath) : ''}" alt=""
        style="width:100%;max-height:180px;object-fit:contain;background:var(--hm-cms-line-softer);border-radius:0px;${item.mediaPath ? '' : 'display:none'}" />
      <label>Seleccionar imagen
        <input name="mediaSearch" type="search" placeholder="Buscar en la biblioteca de medios..." data-gallery-media-search />
      </label>
      <label>O subir nueva imagen
        <input name="file" type="file" accept="image/png,image/jpeg,image/webp" data-gallery-upload />
      </label>
      <div data-gallery-media-grid class="hm-cms-media-grid" style="max-height:200px">
        <p class="hm-cms-muted">Cargando medios...</p>
      </div>
      <label>Texto alternativo (accesibilidad)
        <input name="alt" value="${escapeHtml(item.alt)}" required />
      </label>
      <p class="hm-cms-muted">La galería muestra las fotos agrupadas por álbum, sin título ni descripción. El texto alternativo no se ve en pantalla: es lo que leen los lectores de pantalla y lo que busca el filtro de la galería.</p>
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
      <div class="hm-cms-two">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input name="featured" type="checkbox" ${item.featured ? 'checked' : ''} />
          Destacada
        </label>
        <label>Estado
          <select name="status">
            <option value="published" ${item.status === 'published' ? 'selected' : ''}>Publicada</option>
            <option value="draft" ${item.status === 'draft' ? 'selected' : ''}>Borrador</option>
          </select>
        </label>
      </div>
      <div class="hm-cms-actions">
        <button type="submit">${itemId ? 'Guardar cambios' : 'Agregar a galería'}</button>
        ${itemId ? `<button type="button" class="secondary destructive" data-action="gallery-delete-item" data-item-id="${escapeHtml(itemId)}" data-item-title="${escapeHtml(item.alt)}">Eliminar</button>` : ''}
        <button type="button" class="secondary" data-action="gallery-items">Cancelar</button>
      </div>
      <p class="hm-cms-muted" role="status" aria-live="polite" data-status></p>
    </form>
  `);

  // Load media picker
  try {
    await loadMediaPicker({ reset: true });
  } catch {
    /* silent */
  }
}
