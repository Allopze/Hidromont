import galleryData from './gallery.json';

export interface GalleryCategoryData {
  id: string;
  name: string;
  slug: string;
  position: number;
}

export interface GalleryItemData {
  id: string;
  /**
   * La galería no rotula las fotos: se ven agrupadas por álbum y nada más.
   * `alt` sobrevive porque no es texto visible sino lo que anuncia un lector
   * de pantalla, y sin él las 168 fotos quedarían mudas.
   */
  alt: string;
  categorySlug: string | null;
  categoryName: string | null;
  projectSlug?: string | null;
  featured: boolean;
  position: number;
  src: string;
  width: number;
  height: number;
  srcset: string;
  lqip: string;
  focalX: number;
  focalY: number;
}

export interface GalleryAlbumMeta {
  slug: string;
  name: string;
  position: number;
}

interface GalleryExport {
  updatedAt: string;
  categories: GalleryCategoryData[];
  /** GAL-19: nombre y orden de cada álbum, administrados desde el CMS. */
  albums?: GalleryAlbumMeta[];
  items: GalleryItemData[];
}

const data = galleryData as GalleryExport;

const albumMetaBySlug = new Map((data.albums ?? []).map((album) => [album.slug, album]));

export function getGalleryCategories(): GalleryCategoryData[] {
  return data.categories.sort((a, b) => a.position - b.position);
}

export function getGalleryItems(opts?: {
  categorySlug?: string;
  featuredOnly?: boolean;
}): GalleryItemData[] {
  let items = [...data.items].sort((a, b) => a.position - b.position);

  if (opts?.categorySlug && opts.categorySlug !== 'all') {
    items = items.filter((item) => item.categorySlug === opts.categorySlug);
  }
  if (opts?.featuredOnly) {
    items = items.filter((item) => item.featured);
  }

  return items;
}

export function getGalleryItemCount(): number {
  return data.items.length;
}

/**
 * Cuántas **fotos** quedan visibles con cada filtro de categoría — la galería
 * ya no agrupa en álbumes, así que el número junto a cada filtro es
 * simplemente cuántas fotos tiene esa categoría.
 */
export function getCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = { all: data.items.length };
  for (const item of data.items) {
    if (!item.categorySlug) continue;
    counts[item.categorySlug] = (counts[item.categorySlug] ?? 0) + 1;
  }
  return counts;
}

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Nombre legible del proyecto/álbum de una foto, para el índice de búsqueda
 * (p. ej. que "queltehues" encuentre sus fotos aunque el texto de búsqueda
 * escrito sea "C.H. Queltehues"). El nombre lo administra el CMS; si faltara
 * se deriva del slug.
 */
export function getAlbumName(projectSlug: string): string {
  return albumMetaBySlug.get(projectSlug)?.name || slugToName(projectSlug);
}
