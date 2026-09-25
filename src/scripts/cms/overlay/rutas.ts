/**
 * Qué ficha de colección muestra una ruta del sitio, sin DOM.
 *
 * En la página de un servicio o un proyecto solo las imágenes se editaban en
 * contexto; el título, el resumen o el cuerpo obligaban a ir a Colecciones,
 * buscar la entrada y abrirla. Con esto la barra ofrece «Editar este
 * servicio» directamente.
 */

export interface FichaDeRuta {
  kind: 'servicio' | 'proyecto';
  slug: string;
  etiqueta: string;
}

const RUTAS: ReadonlyArray<Omit<FichaDeRuta, 'slug'> & { prefijo: string }> = [
  { prefijo: '/servicios/', kind: 'servicio', etiqueta: 'Editar este servicio' },
  { prefijo: '/proyectos/', kind: 'proyecto', etiqueta: 'Editar este proyecto' },
];

export function fichaDeRuta(pathname: string): FichaDeRuta | null {
  let ruta: string;
  try {
    ruta = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  ruta = ruta.replace(/\/index\.html$/, '').replace(/\/+$/, '');
  for (const { prefijo, kind, etiqueta } of RUTAS) {
    if (!ruta.startsWith(prefijo)) continue;
    const slug = ruta.slice(prefijo.length);
    // /servicios a secas es el índice, no una ficha.
    if (slug) return { kind, slug, etiqueta };
  }
  return null;
}
