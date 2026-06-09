import { getCmsText } from './cms';

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface ServiceGallery {
  images: GalleryImage[];
}

const serviceSlugs = [
  'tuberias-forzadas', 'compuertas', 'valvulas', 'turbinas', 'limpiarrejas', 'otros-montajes',
];

export const serviceGalleries: Record<string, ServiceGallery> = Object.fromEntries(
  serviceSlugs.map((slug) => {
    const entryId = `service-gallery.${slug}`;
    const images: GalleryImage[] = [1, 2, 3]
      .map((n) => ({
        src: getCmsText(entryId, `gallery${n}`, ''),
        alt: getCmsText(entryId, `gallery${n}Alt`, ''),
      }))
      .filter((img) => img.src !== '');
    return [slug, { images }];
  })
);
