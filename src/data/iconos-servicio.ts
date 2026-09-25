/**
 * Los iconos de servicio, en un solo sitio: los pinta la tarjeta
 * (ServiceCard.astro) y los ofrece el selector de iconos del editor.
 *
 * A-7: tipado contra el vocabulario compartido, así el compilador falla si
 * las claves de este mapa y ICONO_SERVICIO divergen — que es justo lo que
 * había pasado: el CMS documentaba 6 iconos y aquí hay 8.
 */
import type { IconoServicio } from './content-vocabulary';

export const ICONOS_SERVICIO_SVG: Record<IconoServicio, string> = {
  pipe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 9h20M2 15h20" />
    <rect x="2" y="7" width="2" height="10" rx="1" />
    <rect x="20" y="7" width="2" height="10" rx="1" />
    <rect x="8" y="8" width="1.5" height="8" rx="0.5" />
    <rect x="14" y="8" width="1.5" height="8" rx="0.5" />
    <path d="M6 12h2M11 12h2M17 12h2" stroke-dasharray="1 1" />
  </svg>`,

  gate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 3v18M20 3v18" />
    <path d="M4 5h16" />
    <rect x="6" y="5" width="12" height="9" fill="none" />
    <path d="M6 9.5h12M6 14h12" />
    <path d="M12 5V2" />
    <path d="M3 18c2-1 4-1 6 0s4 1 6 0 4-1 6 0" />
    <path d="M3 21c2-1 4-1 6 0s4 1 6 0 4-1 6 0" opacity="0.6" />
  </svg>`,

  valve: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="9" width="2" height="8" rx="0.5" />
    <rect x="20" y="9" width="2" height="8" rx="0.5" />
    <path d="M4 13l8-5v10z" />
    <path d="M20 13l-8-5v10z" />
    <path d="M12 8V4" />
    <ellipse cx="12" cy="4" rx="4.5" ry="1.5" />
    <path d="M12 3v2M9.5 4h5" />
  </svg>`,

  turbine: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 8.5c4-3.5 7-1.5 8.5 2.5-2.5-1-6-1.5-8.5 1" />
    <path d="M15.5 12c3.5 4 1.5 7-2.5 8.5 1-2.5 1.5-6-1-8.5" />
    <path d="M12 15.5c-4 3.5-7 1.5-8.5-2.5 2.5 1 6 1.5 8.5-1" />
    <path d="M8.5 12c-3.5-4-1.5-7 2.5-8.5-1 2.5-1.5 6 1 8.5" />
    <circle cx="12" cy="12" r="9.5" />
  </svg>`,

  rack: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 3v18M10 3v18M14 3v18M18 3v18" />
    <path d="M4 6h16M4 18h16" stroke-width="2" />
    <path d="M3 11c1-1 3-1 4 0s3 1 4 0 3-1 4 0 3 1 4 0" stroke-width="2" />
    <path d="M12 11V7M12 7L9 4" />
  </svg>`,

  crane: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 6 5 C 6 2, 9.5 2, 12 2 C 14.5 2, 18 2, 18 5 V 14 C 18 16.5, 16 18, 14 18 H 10 C 8 18, 6 16.5, 6 14 Z" />
    <rect x="9" y="7" width="6" height="4" rx="0.5" />
    <circle cx="5" cy="11" r="0.8" />
    <circle cx="19" cy="11" r="0.8" />
  </svg>`,

  infrastructure: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 2 20 h 8 M 17 20 h 5" />
    <path d="M 10 20 V 8 h 2.5 L 17 20 Z" />
    <path d="M 2 9.5 h 8" />
    <path d="M 3.5 13.5 h 4" opacity="0.5" />
    <path d="M 16 17.5 Q 18.5 15, 21 20" />
  </svg>`,

  tank: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="7" width="18" height="10" rx="5" />
    <path d="M8 7v10M16 7v10" stroke-dasharray="1 2" />
    <path d="M6 17v4M18 17v4" />
    <path d="M4 21h16" />
    <path d="M12 7V4M10 4h4" />
    <path d="M3 12H1M1 10v4" />
    <circle cx="12" cy="12" r="1.5" />
  </svg>`,
};
