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

/**
 * Páginas índice: la ficha que guarda su título y descripción para buscadores.
 * Esos dos textos no se ven en la página, así que no hay nada que pulsar; la
 * barra ofrece abrirlos directamente, como «Editar este servicio».
 */
const PAGINAS: Record<string, string> = {
  '': 'home.hero',
  '/empresa': 'empresa.hero',
  '/servicios': 'servicios.index.hero',
  '/proyectos': 'proyectos.index.hero',
  '/clientes': 'clientes.hero',
  '/galeria': 'page.galeria',
  '/contacto': 'contacto.sections',
};

export function fichaDePagina(pathname: string): { entryId: string; etiqueta: string } | null {
  let ruta: string;
  try {
    ruta = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  ruta = ruta.replace(/\/index\.html$/, '').replace(/\/+$/, '');
  const entryId = PAGINAS[ruta];
  return entryId ? { entryId, etiqueta: 'Datos para buscadores' } : null;
}
