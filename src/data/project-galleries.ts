import { getCmsText } from './cms';

export interface GalleryImage {
  src: string;
  alt: string;
}

export interface ProjectGallery {
  images: GalleryImage[];
}

const projectSlugs = [
  'ch-los-condores', 'embalse-chironta', 'ch-besaya', 'ch-dorias',
  'ch-queltehues', 'ch-rio-frio', 'embalse-chacrillas',
];

export const projectGalleries: Record<string, ProjectGallery> = Object.fromEntries(
  projectSlugs.map((slug) => {
    const entryId = `project-gallery.${slug}`;
    const images: GalleryImage[] = [1, 2, 3]
      .map((n) => ({
        src: getCmsText(entryId, `gallery${n}`, ''),
        alt: getCmsText(entryId, `gallery${n}Alt`, ''),
      }))
      .filter((img) => img.src !== '');
    return [slug, { images }];
  })
);
