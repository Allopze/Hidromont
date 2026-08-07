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

export interface ProjectAlbumData {
  projectSlug: string;
  projectName: string;
  /** Categoría de la portada. Solo para mostrar un rótulo único en la tarjeta. */
  categorySlug: string | null;
  categoryName: string | null;
  /**
   * GAL-13: TODAS las categorías presentes en el álbum, no solo la de la
   * portada. El filtro se aplica sobre este conjunto: antes usaba la categoría
   * de la portada y eso dejaba 24 fotos inalcanzables desde el filtro de su
   * propia categoría (p. ej. las fotos de tuberías forzadas dentro de
   * `ch-queltehues`, cuyo álbum quedaba rotulado como compuertas).
   */
  categorySlugs: string[];
  categoryNames: string[];
  coverImage: GalleryItemData;
  itemCount: number;
  items: GalleryItemData[];
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
 * GAL-13: cuántos **álbumes** quedan visibles con cada filtro.
 *
 * Antes contaba fotos mientras el filtro se aplicaba a tarjetas: el desplegable
 * decía "Tuberías Forzadas y Blindajes (101)" y al elegirlo aparecían 8
 * tarjetas. El número que acompaña a un filtro tiene que ser el número de cosas
 * que ese filtro deja a la vista.
 */
export function getCategoryCounts(): Record<string, number> {
  const albums = getProjectAlbums();
  const counts: Record<string, number> = { all: albums.length };
  for (const album of albums) {
    for (const slug of album.categorySlugs) {
      counts[slug] = (counts[slug] ?? 0) + 1;
    }
  }
  return counts;
}

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getProjectAlbums(): ProjectAlbumData[] {
  const albumsMap = new Map<string, GalleryItemData[]>();

  for (const item of data.items) {
    const slug = item.projectSlug || 'general';
    if (!albumsMap.has(slug)) {
      albumsMap.set(slug, []);
    }
    albumsMap.get(slug)!.push(item);
  }

  const albums: ProjectAlbumData[] = [];
  for (const [slug, items] of albumsMap.entries()) {
    items.sort((a, b) => a.position - b.position);
    const cover = items.find((i) => i.featured) || items[0];
    const meta = albumMetaBySlug.get(slug);

    // Categorías presentes en el álbum, en el orden global de categorías para
    // que el rótulo sea estable entre tarjetas.
    const present = new Set(items.map((i) => i.categorySlug).filter(Boolean) as string[]);
    const ordered = getGalleryCategories().filter((c) => present.has(c.slug));

    albums.push({
      projectSlug: slug,
      // El nombre del álbum lo administra el CMS. Si faltara, se deriva del
      // slug: antes caía en el título de la portada, que ya no existe.
      projectName: meta?.name || slugToName(slug),
      categorySlug: cover.categorySlug,
      categoryName: cover.categoryName,
      categorySlugs: ordered.map((c) => c.slug),
      categoryNames: ordered.map((c) => c.name),
      coverImage: cover,
      itemCount: items.length,
      items,
    });
  }

  // Orden del CMS (GAL-21). Los álbumes sin metadatos van al final.
  return albums.sort((a, b) => {
    const pa = albumMetaBySlug.get(a.projectSlug)?.position ?? Number.MAX_SAFE_INTEGER;
    const pb = albumMetaBySlug.get(b.projectSlug)?.position ?? Number.MAX_SAFE_INTEGER;
    return pa - pb || a.projectName.localeCompare(b.projectName, 'es');
  });
}
