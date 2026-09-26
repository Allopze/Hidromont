/**
 * P2-22 (auditoría 2026-09) — Nombres legibles para las fichas del CMS.
 *
 * El panel nombraba cada ficha con su título interno: «Hero home › Título»,
 * «Header › Texto del botón», «Banco proyectos», «Galería proyecto
 * ch-besaya». Son nombres escritos para el código, y quien edita no reconoce
 * con ellos qué parte del sitio está tocando.
 *
 * Lo usan el panel (migas, listas, revisiones) y el resumen de publicación
 * del servidor, para que la misma ficha se llame igual en todas partes. Los
 * servicios y proyectos no pasan por aquí: su título ya es el que ve el
 * visitante.
 */

const NOMBRES: Record<string, string> = {
  // Portada
  'home.hero': 'Portada — cabecera',
  'home.services': 'Portada — servicios',
  'home.projects': 'Portada — proyectos',
  'home.capabilities': 'Portada — capacidades',
  'home.installations': 'Portada — instalaciones',
  'home.cta': 'Portada — invitación a contactar',
  // Empresa
  'empresa.hero': 'Empresa — cabecera',
  'empresa.historia': 'Empresa — historia',
  'empresa.metricas': 'Empresa — cifras',
  'empresa.instalaciones': 'Empresa — instalaciones',
  'empresa.maquinaria': 'Empresa — maquinaria',
  'empresa.mediosdeobra': 'Empresa — medios de obra',
  'empresa.cta': 'Empresa — invitación a contactar',
  // Servicios
  'servicios.index.hero': 'Servicios — cabecera',
  'servicios.index.banner': 'Servicios — franja de capacidad industrial',
  'servicios.index.metodologia': 'Servicios — metodología',
  'servicios.index.cta': 'Servicios — invitación a contactar',
  // Proyectos
  'proyectos.index.hero': 'Proyectos — cabecera',
  'proyectos.index.destacados': 'Proyectos — destacados',
  'proyectos.index.banco': 'Proyectos — listado de proyectos',
  'proyectos.index.cta': 'Proyectos — invitación a contactar',
  // Clientes
  'clientes.hero': 'Clientes — cabecera',
  'clientes.sectores': 'Clientes — referencias por sector',
  'clientes.cta': 'Clientes — invitación a contactar',
  'clientes.logos': 'Clientes — logos',
  // Calidad
  'calidad.hero': 'Calidad — cabecera',
  'calidad.contenido': 'Calidad — contenido',
  'calidad.principios': 'Calidad — principios',
  'calidad.badge': 'Calidad — sello ISO',
  'calidad.cta': 'Calidad — invitación a contactar',
  // Contacto
  'contacto.hero': 'Contacto — cabecera',
  'contacto.sections': 'Contacto — secciones',
  'contacto.gracias': 'Contacto — página de gracias',
  // Galería
  'galeria.hero': 'Galería — cabecera',
  'galeria.config': 'Galería — textos del buscador',
  'page.galeria': 'Galería — textos',
  'galeria.items': 'Galería — fotos',
  // Partes comunes a todas las páginas
  'layout.header': 'Cabecera y menú',
  'layout.footer': 'Pie de página',
  'clients.strip': 'Franja de clientes del inicio',
  'contact.form': 'Formulario de contacto',
  'contact.info': 'Datos de contacto (página Contacto)',
  'contact.ubicacion': 'Recuadro de ubicación',
  'site.company': 'Datos de la empresa',
  'site.accesibilidad': 'Textos para lectores de pantalla',
};

/** «ch-besaya» → «C.H. Besaya», «tanques-glp-coyhaique» → «Tanques GLP Coyhaique». */
function nombreDesdeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((parte) => {
      if (parte === 'ch') return 'C.H.';
      if (parte === 'glp') return 'GLP';
      return parte.charAt(0).toUpperCase() + parte.slice(1);
    })
    .join(' ');
}

/**
 * El nombre de una ficha tal como lo lee quien edita.
 *
 * @param titulo El título interno, para las fichas que no están en la lista
 *   (servicios, proyectos y cualquier ficha nueva): se devuelve tal cual.
 */
export function nombreDeFicha(id: string, titulo = ''): string {
  if (NOMBRES[id]) return NOMBRES[id];
  const [prefijo, ...resto] = id.split('.');
  const slug = resto.join('.');
  const quitar = (patron: RegExp) => titulo.replace(patron, '').trim();
  switch (prefijo) {
    case 'project-image':
      return `Foto del proyecto ${quitar(/^Imagen proyecto\s+/i) || nombreDesdeSlug(slug)}`;
    case 'service-image':
      return `Foto del servicio ${quitar(/^Imagen servicio\s+/i) || nombreDesdeSlug(slug)}`;
    case 'project-gallery':
      return `Fotos del proyecto ${nombreDesdeSlug(slug)}`;
    case 'service-gallery':
      return `Fotos del servicio ${nombreDesdeSlug(slug)}`;
    case 'servicios':
      return titulo || `Servicio ${nombreDesdeSlug(slug)}`;
    case 'proyectos':
      return titulo || `Proyecto ${nombreDesdeSlug(slug)}`;
    default:
      return titulo || id;
  }
}
