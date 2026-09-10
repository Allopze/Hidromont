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
    src: '/fotos/curadas/valvula-tunel-chironta.webp',
    alt: 'Válvula instalada en túnel de central',
    width: 1600,
    height: 740,
  },
  'ch-besaya': {
    src: '/fotos/curadas/proyecto-montaje-tuberia.webp',
    alt: 'Montaje de tubería forzada de gran diámetro',
    width: 429,
    height: 491,
  },
  'ch-doiras': {
    src: '/fotos/curadas/proyecto-bifurcacion-obra.webp',
    alt: 'Bifurcación instalada en obra',
    width: 441,
    height: 259,
  },
  'ch-queltehues': {
    src: '/fotos/curadas/tuberia-terreno-queltehues.webp',
    alt: 'Instalación de tubería en terreno',
    width: 605,
    height: 310,
  },
  'ch-rio-frio': {
    src: '/fotos/curadas/proyecto-tuberia-montana.webp',
    alt: 'Tubería forzada en ladera de montaña',
    width: 960,
    height: 1280,
  },
  'embalse-chacrillas': {
    src: '/fotos/curadas/bifurcacion-primer-taller.webp',
    alt: 'Bifurcación de gran diámetro en fabricación en taller',
    width: 1425,
    height: 1104,
  },
  'tanques-glp-coyhaique': {
    src: '/fotos/curadas/tanques-glp-coyhaique.webp',
    alt: 'Tanque de GLP 30.000 galones en fabricación en taller',
    width: 1200,
    height: 1600,
  },
  'tanques-glp-puerto-williams': {
    src: '/fotos/curadas/tanques-glp-puerto-williams.webp',
    alt: 'Tanques aéreos de GLP pintados listos para despacho',
    width: 1200,
    height: 1600,
  },
  'ruta-nahuelbuta-pasarelas': {
    src: '/fotos/curadas/pasarela-ruta-nahuelbuta.webp',
    alt: 'Cúpula y estructura metálica para pasarela peatonal en carretera',
    width: 1600,
    height: 720,
  },
};

export const projectImages: Record<string, ProjectImageData> = Object.fromEntries(
  Object.entries(projectImageFallbacks).map(([slug, fallback]) => [
    slug,
    getCmsImage(`project-image.${slug}`, fallback),
  ])
);
