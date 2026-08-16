import { getCmsImage, type CmsImageData } from './cms';

const serviceImageFallbacks: Record<string, CmsImageData> = {
  'tuberias-forzadas': {
    src: '/fotos/curadas/tuberia-forzada-tunel.webp',
    alt: 'Tubería forzada de gran diámetro instalada en túnel subterráneo',
    width: 1849,
    height: 851,
  },
  compuertas: {
    src: '/fotos/curadas/compuertas.webp',
    alt: 'Compuerta hidráulica instalada en presa',
    width: 1448,
    height: 1086,
  },
  valvulas: {
    src: '/fotos/curadas/valvulas.webp',
    alt: 'Válvula instalada sobre tubería forzada en túnel',
    width: 1600,
    height: 900,
  },
  turbinas: {
    src: '/fotos/curadas/turbinas-obra-1.webp',
    alt: 'Mantenimiento de componente de turbina hidráulica en taller',
    width: 1200,
    height: 900,
  },
  limpiarrejas: {
    src: '/fotos/curadas/limpiarrejas-obra-1.webp',
    alt: 'Sistema de captación con limpiarreja en obra hidroeléctrica',
    width: 1200,
    height: 674,
  },
  'otros-montajes': {
    src: '/fotos/curadas/cuerpo-vapor-taller.webp',
    alt: 'Cuerpo de vapor de gran diámetro fabricado por Hidromont sobre cama baja en el taller',
    width: 1600,
    height: 1200,
  },
  infraestructuras: {
    src: '/fotos/curadas/pasarela-ruta-nahuelbuta.webp',
    alt: 'Cúpula y estructura metálica para pasarela superior peatonal en Ruta Nahuelbuta',
    width: 1600,
    height: 720,
  },
  'tanques-especiales': {
    src: '/fotos/curadas/tanque-glp-izaje-despacho.webp',
    alt: 'Tanque de GLP pintado izado con pórtico grúa durante su despacho desde el taller de Hidromont',
    width: 1600,
    height: 900,
  },
};

export const serviceImages: Record<string, CmsImageData> = Object.fromEntries(
  Object.entries(serviceImageFallbacks).map(([slug, fallback]) => [
    slug,
    getCmsImage(`service-image.${slug}`, fallback),
  ])
);
