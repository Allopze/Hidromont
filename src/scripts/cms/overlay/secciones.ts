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
      { titulo: 'Detalles del servicio', claves: ['tipos', 'aplicaciones', 'procesos', 'normas'] },
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

/** El campo que hace de título en el sitio, si esta ficha lo tiene. */
export function campoTituloDe(kind: string, claves: string[]): string | null {
  const campo = PLANES[kind]?.campoTitulo;
  return campo && claves.includes(campo) ? campo : null;
}

/**
 * Reparte las claves en secciones, en el orden del plan. Las que el plan no
 * nombra van a la sección del medio (los datos), en su orden original: un
 * campo nuevo nunca desaparece del formulario por no estar en la lista. Las
 * secciones vacías se omiten. Sin plan (páginas), una sola sección sin título.
 */
export function seccionesDeFicha(kind: string, claves: string[]): Seccion[] {
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
