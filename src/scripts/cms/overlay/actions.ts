/**
 * Las acciones de la barra del CMS, en un solo sitio.
 *
 * Estaban escritas dos veces: en `shell.js` (la barra de escritorio) y en
 * `mobile-menu.ts` (el panel flotante). Nada ataba las dos copias, y ya habían
 * divergido: la barra lleva `title` con explicaciones —qué hace exactamente
 * «Publicar cambios», qué incluye «Administrar»— y el panel móvil las había
 * perdido. Añadir un botón obligaba a tocar dos archivos y nada avisaba si se
 * olvidaba uno.
 *
 * `src/test/cms-acciones-barra.test.ts` exige que ambas superficies expongan
 * el mismo conjunto, para que no puedan volver a separarse.
 */

export interface AccionBarra {
  /** El valor de `data-action`, que es lo que lee la delegación de eventos. */
  accion: string;
  etiqueta: string;
  /** Sin esto el botón se pinta como llamada a la acción (azul lleno). */
  secundario?: boolean;
  /** Explicación larga. Solo cabe en la barra de escritorio. */
  titulo?: string;
}

export const ACCIONES_BARRA: readonly AccionBarra[] = [
  { accion: 'collections', etiqueta: 'Colecciones', secundario: true },
  { accion: 'gallery', etiqueta: 'Galería', secundario: true },
  { accion: 'jobs', etiqueta: 'Historial', secundario: true },
  {
    accion: 'admin',
    etiqueta: 'Administrar',
    secundario: true,
    titulo: 'Registro de actividad, respaldos de la base y cambio de contraseña.',
  },
  {
    accion: 'publish',
    etiqueta: 'Publicar cambios',
    titulo:
      'Exporta el contenido y compila este sitio. Si trabajas en local, debes desplegarlo para actualizar producción.',
  },
  { accion: 'logout', etiqueta: 'Salir', secundario: true },
];

function escaparAtributo(valor: string): string {
  return valor.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * El marcado de los botones de acción.
 *
 * `conTitulo` existe porque en el panel móvil un `title` no aporta nada: no hay
 * puntero que se quede quieto encima para revelarlo.
 */
export function botonesDeBarra({ conTitulo = true }: { conTitulo?: boolean } = {}): string {
  return ACCIONES_BARRA.map((a) => {
    const clase = a.secundario ? ' class="secondary"' : '';
    const titulo = conTitulo && a.titulo ? ` title="${escaparAtributo(a.titulo)}"` : '';
    return `<button type="button"${clase} data-action="${a.accion}" data-auth hidden${titulo}>${a.etiqueta}</button>`;
  }).join('\n      ');
}
