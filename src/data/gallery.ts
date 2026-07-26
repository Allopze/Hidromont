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

interface GalleryExport {
  updatedAt: string;
  categories: GalleryCategoryData[];
  items: GalleryItemData[];
}

const data = galleryData as GalleryExport;

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
