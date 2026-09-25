/**
 * Cómo se ordena el formulario de una ficha de colección, sin DOM.
 *
 * El formulario pintaba los campos en el orden en que salían de la base
 * —alfabético: aplicaciones, body, icono, normas, orden, procesos, resumen,
 * tipos, titulo—, así que el título del servicio quedaba al final, debajo de
 * todo, y además repetido: arriba estaba el «Título» de la entrada, que es
 * solo el nombre en la lista del panel y que el sitio no muestra. Cambiarlo no
 * cambiaba nada en la página.
 */

export interface Seccion {
  titulo: string;
  claves: string[];
}

interface Plan {
  /** El campo que el sitio usa como título de la ficha. */
  campoTitulo: string;
  secciones: Seccion[];
}

const PLANES: Record<string, Plan> = {
  servicio: {
    campoTitulo: 'titulo',
    secciones: [
      { titulo: 'Contenido', claves: ['titulo', 'resumen', 'body'] },
      { titulo: 'Detalles del servicio', claves: ['tipos', 'aplicaciones', 'normas'] },
      { titulo: 'Cómo aparece en el sitio', claves: ['icono', 'orden'] },
    ],
  },
  proyecto: {
    campoTitulo: 'nombre',
    secciones: [
      { titulo: 'Contenido', claves: ['nombre', 'alcance', 'body'] },
      {
        titulo: 'Datos del proyecto',
        claves: ['cliente', 'servicio', 'tipo', 'diametro', 'longitud', 'peso', 'acero', 'normas'],
      },
      { titulo: 'Cómo aparece en el sitio', claves: ['categoria', 'orden'] },
    ],
  },
};

/**
 * Campos de ficha que el sitio siempre pinta: vaciarlos deja una tarjeta sin
 * título o sin descripción en el inicio, en /servicios y en /proyectos.
 */
const OBLIGATORIOS: Record<string, string[]> = {
  servicio: ['titulo', 'resumen'],
  proyecto: ['nombre', 'alcance'],
};

/**
 * ¿Ofrece el editor de la página «Vaciar este texto» para este campo?
 *
 * No en una imagen (se cambia, no se vacía), ni en una lista o un cuerpo con
 * formato (vaciarlos borra de golpe todos sus elementos o el texto entero de
 * la ficha), ni en los campos obligatorios de una ficha.
 */
export function sePuedeVaciar(kind: string, campo: string, tipo: string): boolean {
  if (tipo === 'image' || tipo === 'list' || tipo === 'richtext') return false;
  return !OBLIGATORIOS[kind]?.includes(campo);
}

/** El campo que hace de título en el sitio, si esta ficha lo tiene. */
export function campoTituloDe(kind: string, claves: string[]): string | null {
  const campo = PLANES[kind]?.campoTitulo;
  return campo && claves.includes(campo) ? campo : null;
}

/**
 * Campos que existen en las fichas pero que ninguna página muestra. El
 * formulario los ofrecía y guardarlos no cambiaba nada en el sitio:
 *
 * - `procesos` de los servicios: la sección «Proceso de trabajo» se quitó de
 *   la página del servicio en 79f5257 y el campo siguió en las ocho fichas.
 * - `anio` de los proyectos: el schema lo admite, pero ninguna plantilla lo
 *   pinta (solo lo tiene la pasarela de Nahuelbuta).
 *
 * No se borran: el formulario solo envía lo que cambia, así que el valor sigue
 * en la base y en el .md exportado, listo por si alguna página vuelve a usarlo.
 */
const SIN_USO_EN_EL_SITIO: Record<string, string[]> = {
  servicio: ['procesos'],
  proyecto: ['anio'],
};

/**
 * Reparte las claves en secciones, en el orden del plan. Las que el plan no
 * nombra van a la sección del medio (los datos), en su orden original: un
 * campo nuevo nunca desaparece del formulario por no estar en la lista. Las
 * secciones vacías se omiten. Sin plan (páginas), una sola sección sin título.
 * Los campos que el sitio no muestra no se ofrecen.
 */
export function seccionesDeFicha(kind: string, todas: string[]): Seccion[] {
  const sinUso = new Set(SIN_USO_EN_EL_SITIO[kind] ?? []);
  const claves = todas.filter((k) => !sinUso.has(k));
  const plan = PLANES[kind];
  if (!plan) return [{ titulo: '', claves: [...claves] }];

  const nombradas = new Set(plan.secciones.flatMap((s) => s.claves));
  const sueltas = claves.filter((k) => !nombradas.has(k));
  return plan.secciones
    .map((seccion, i) => ({
      titulo: seccion.titulo,
      claves: [...seccion.claves.filter((k) => claves.includes(k)), ...(i === 1 ? sueltas : [])],
    }))
    .filter((s) => s.claves.length > 0);
}
