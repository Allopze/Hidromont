import { getCmsImage, type CmsImageData } from './cms';

const serviceImageFallbacks: Record<string, CmsImageData> = {
  'tuberias-forzadas': {
    src: '/fotos/curadas/tuberia-forzada-tunel.webp',
    alt: 'Tubería forzada de gran diámetro instalada en túnel subterráneo',
    width: 1849,
    height: 851,
  },
  compuertas: {
    src: '/fotos/curadas/compuertas.jpg',
    alt: 'Compuerta hidráulica instalada en presa',
    width: 446,
    height: 621,
  },
  valvulas: {
    src: '/fotos/curadas/valvula-tuberia-tunel.webp',
    alt: 'Válvula instalada sobre tubería forzada en túnel',
    width: 1448,
    height: 1086,
  },
  turbinas: {
    src: '/fotos/curadas/turbinas.jpg',
    alt: 'Sala de máquinas con turbinas hidráulicas',
    width: 474,
    height: 271,
  },
  limpiarrejas: {
    src: '/fotos/curadas/limpiarrejas.jpg',
    alt: 'Limpiarreja instalada en obra hidroeléctrica',
    width: 471,
    height: 314,
  },
  'otros-montajes': {
    src: '/fotos/curadas/otros-montajes.jpg',
    alt: 'Montaje de gran componente hidromecánico',
    width: 471,
    height: 629,
  },
};

export const serviceImages: Record<string, CmsImageData> = Object.fromEntries(
  Object.entries(serviceImageFallbacks).map(([slug, fallback]) => [
    slug,
    getCmsImage(`service-image.${slug}`, fallback),
  ])
);
