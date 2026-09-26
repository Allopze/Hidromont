import { cmsEntrySlugs, getCmsText } from './cms';

export interface GalleryImage {
  src: string;
  alt: string;
  /**
   * El hueco del CMS al que pertenece (1, 2 o 3). P2-10 (auditoría 2026-09):
   * se renumeraba por posición tras quitar los vacíos, así que con los huecos
   * 1 y 3 la foto del 3 se pintaba como `gallery2` y «+ Agregar imagen 3»
   * sobrescribía una foto que ya existía.
   */
  campo: number;
}

export interface ProjectGallery {
  images: GalleryImage[];
}

const projectSlugs = [
  'ch-los-condores',
  'embalse-chironta',
  'ch-besaya',
  'ch-doiras',
  'ch-queltehues',
  'ch-rio-frio',
  'embalse-chacrillas',
  'tanques-glp-coyhaique',
  'tanques-glp-puerto-williams',
  'ruta-nahuelbuta-pasarelas',
];

export const projectGalleries: Record<string, ProjectGallery> = Object.fromEntries(
  [...new Set([...projectSlugs, ...cmsEntrySlugs('project-gallery')])].map((slug) => {
    const entryId = `project-gallery.${slug}`;
    const images: GalleryImage[] = [1, 2, 3]
      .map((n) => ({
        src: getCmsText(entryId, `gallery${n}`, ''),
        alt: getCmsText(entryId, `gallery${n}Alt`, ''),
        campo: n,
      }))
      .filter((img) => img.src !== '');
    return [slug, { images }];
  })
);
