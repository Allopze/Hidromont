import galleryData from './gallery.json';

export interface GalleryCategoryData {
  id: string;
  name: string;
  slug: string;
  position: number;
}

export interface GalleryItemData {
  id: string;
  title: string;
  alt: string;
  caption: string | null;
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
  categorySlug: string | null;
  categoryName: string | null;
  coverImage: GalleryItemData;
  itemCount: number;
  items: GalleryItemData[];
}

interface GalleryExport {
  updatedAt: string;
  categories: GalleryCategoryData[];
  items: GalleryItemData[];
}

const data = galleryData as GalleryExport;

const PROJECT_NAME_MAP: Record<string, string> = {
  'tanques-glp-coyhaique': 'Tanques Especiales GLP Coyhaique',
  'tanques-glp-puerto-williams': 'Tanques Especiales GLP Puerto Williams',
  'ruta-nahuelbuta-pasarelas': 'Pasarelas Peatonales Ruta Nahuelbuta',
};

export function getGalleryCategories(): GalleryCategoryData[] {
  return data.categories.sort((a, b) => a.position - b.position);
}

export function getGalleryItems(opts?: { categorySlug?: string; featuredOnly?: boolean }): GalleryItemData[] {
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

export function getCategoryCounts(): Record<string, number> {
  const counts: Record<string, number> = { all: data.items.length };
  for (const item of data.items) {
    const slug = item.categorySlug ?? 'otros';
    counts[slug] = (counts[slug] ?? 0) + 1;
  }
  return counts;
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
    const name = PROJECT_NAME_MAP[slug] || cover.title;
    albums.push({
      projectSlug: slug,
      projectName: name,
      categorySlug: cover.categorySlug,
      categoryName: cover.categoryName,
      coverImage: cover,
      itemCount: items.length,
      items,
    });
  }

  return albums;
}
