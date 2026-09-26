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
  /** Oculta controles que solo tienen sentido en una superficie táctil. */
  soloTactil?: boolean;
  /** Marca un control con estado pulsado alternable. */
  pulsable?: boolean;
  /**
   * Solo tiene sentido en la página de un servicio o proyecto: se muestra
   * cuando `ficha.js` reconoce la entrada de la página y le pone su id.
   */
  requiereFicha?: boolean;
  /**
   * En la barra de escritorio va dentro del menú «Más». Son las acciones que
   * se usan de vez en cuando: tenerlas al mismo nivel que Publicar hacía una
   * barra de siete botones iguales. En el panel móvil se listan todas.
   */
  enMenu?: boolean;
}

export const ACCIONES_BARRA: readonly AccionBarra[] = [
  {
    accion: 'edit-page-entry',
    etiqueta: 'Editar esta ficha',
    secundario: true,
    titulo: 'Abre el formulario de esta página: títulos, textos, listas y datos de la ficha.',
    requiereFicha: true,
  },
  { accion: 'collections', etiqueta: 'Colecciones', secundario: true },
  {
    accion: 'pages',
    etiqueta: 'Ir a otra página',
    secundario: true,
    titulo: 'Lista las páginas del sitio para abrir la que quieras editar.',
    enMenu: true,
  },
  { accion: 'gallery', etiqueta: 'Galería', secundario: true },
  { accion: 'jobs', etiqueta: 'Historial de publicaciones', secundario: true, enMenu: true },
  {
    accion: 'toggle-edit-guides',
    etiqueta: 'Guías editables',
    secundario: true,
    titulo: 'Mostrar u ocultar las zonas editables en pantallas táctiles.',
    soloTactil: true,
    pulsable: true,
  },
  {
    accion: 'admin',
    etiqueta: 'Administrar',
    secundario: true,
    titulo: 'Registro de actividad, respaldos de la base y cambio de contraseña.',
    enMenu: true,
  },
  {
    accion: 'publish',
    etiqueta: 'Publicar cambios',
    titulo: 'Muestra qué cambios saldrán y, al confirmar, actualiza el sitio.',
  },
  { accion: 'logout', etiqueta: 'Salir', secundario: true, enMenu: true },
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
export function botonesDeBarra({
  conTitulo = true,
  filtro = () => true,
}: {
  conTitulo?: boolean;
  /** Para repartir la barra de escritorio entre los botones y el menú «Más». */
  filtro?: (accion: AccionBarra) => boolean;
} = {}): string {
  return ACCIONES_BARRA.filter(filtro)
    .map((a) => {
      // «Publicar cambios» es la única acción principal de la barra.
      const clase = a.secundario ? ' class="secondary"' : ' class="primary"';
      const titulo = conTitulo && a.titulo ? ` title="${escaparAtributo(a.titulo)}"` : '';
      const soloTactil = a.soloTactil ? ' data-touch-only' : '';
      const pressed = a.pulsable ? ' aria-pressed="false"' : '';
      const ficha = a.requiereFicha ? ' data-page-entry' : '';
      return `<button type="button"${clase} data-action="${a.accion}" data-auth hidden${titulo}${soloTactil}${pressed}${ficha}>${a.etiqueta}</button>`;
    })
    .join('\n      ');
}

/** Los dos repartos de la barra de escritorio. */
export const FUERA_DEL_MENU = (a: AccionBarra) => !a.enMenu;
export const DENTRO_DEL_MENU = (a: AccionBarra) => Boolean(a.enMenu);
