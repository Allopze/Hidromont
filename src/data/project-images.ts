import { getCmsImage } from './cms';

export interface ProjectImageData {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const projectImageFallbacks: Record<string, ProjectImageData> = {
  'ch-los-condores': {
    src: '/fotos/curadas/montaje-vertical-caverna.webp',
    alt: 'Montaje vertical de tubería forzada en caverna subterránea',
    width: 1086,
    height: 1448,
  },
  'embalse-chironta': {
    src: '/fotos/curadas/proyecto-valvula-tunel.jpg',
    alt: 'Válvula instalada en túnel de central',
    width: 1024,
    height: 768,
  },
  'ch-besaya': {
    src: '/fotos/curadas/proyecto-montaje-tuberia.jpg',
    alt: 'Montaje de tubería forzada de gran diámetro',
    width: 481,
    height: 640,
  },
  'ch-dorias': {
    src: '/fotos/curadas/proyecto-bifurcacion-obra.jpg',
    alt: 'Bifurcación instalada en obra',
    width: 473,
    height: 354,
  },
  'ch-queltehues': {
    src: '/fotos/curadas/proyecto-tuberia-terreno.jpg',
    alt: 'Instalación de tubería en terreno',
    width: 639,
    height: 480,
  },
  'ch-rio-frio': {
    src: '/fotos/curadas/proyecto-tuberia-montana.webp',
    alt: 'Tubería forzada en ladera de montaña',
    width: 467,
    height: 697,
  },
  'embalse-chacrillas': {
    src: '/fotos/curadas/bifurcacion-primer-taller.webp',
    alt: 'Bifurcación de gran diámetro en fabricación en taller',
    width: 1425,
    height: 1104,
  },
  'tanques-glp-coyhaique': {
    src: '/fotos/curadas/tanques-glp-coyhaique.jpg',
    alt: 'Tanque de GLP 30.000 galones en fabricación en taller',
    width: 1500,
    height: 2000,
  },
  'tanques-glp-puerto-williams': {
    src: '/fotos/curadas/tanques-glp-puerto-williams.jpg',
    alt: 'Tanques aéreos de GLP pintados listos para despacho',
    width: 1500,
    height: 2000,
  },
};

export const projectImages: Record<string, ProjectImageData> = Object.fromEntries(
  Object.entries(projectImageFallbacks).map(([slug, fallback]) => [
    slug,
    getCmsImage(`project-image.${slug}`, fallback),
  ])
);
