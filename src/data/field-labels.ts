/**
 * E-3 — Nombres legibles para los campos del CMS.
 *
 * El panel rotulaba cada campo con su clave de la base: `seoDescription`,
 * `gallery2Alt`, `hrefServiciosLimpiarrejas`, `card3Value`. Son identificadores
 * escritos para el código, y quien edita el sitio no tiene por qué deducir de
 * `eyebrow` que ahí va el texto pequeño de encima del título.
 *
 * Tres capas, de la más específica a la más general:
 *
 *   1. `FIELD_LABELS`, para las claves que existen de verdad en la base. Se
 *      escribieron leyendo su contenido real, no adivinando por el nombre.
 *   2. Reglas de patrón para las familias numeradas (`gallery3Alt`,
 *      `item5Title`, `navServiciosTanques`) y para los sufijos que se repiten
 *      (`*Label`, `*Placeholder`, `*Error`). Cubren las claves que aún no
 *      existen pero que seguirán el mismo molde.
 *   3. Un último recurso que separa el camelCase y capitaliza, para que una
 *      clave nueva salga al menos como «Campo nuevo» y no como `campoNuevo`.
 *
 * La clave cruda se sigue mostrando junto a la etiqueta en el panel: es lo que
 * aparece en los mensajes de error y lo que un desarrollador nombra por
 * teléfono, así que ocultarla del todo cambiaría un problema por otro.
 */

/** Claves presentes en la base, rotuladas leyendo su contenido. */
export const FIELD_LABELS: Record<string, string> = {
  // ── Texto de página ──
  title: 'Título',
  titulo: 'Título',
  pageTitle: 'Título de la página',
  subtitle: 'Subtítulo',
  text: 'Texto',
  texto: 'Texto',
  video: 'Video',
  videoAlt: 'Descripción del video',
  iconoPropio: 'Icono propio',
  nombres: 'Nombres de los clientes',
  // Rótulos de plantilla pasados al CMS (sep-2026).
  verServicio: 'Enlace de la tarjeta de servicio',
  verDetalle: 'Enlace de la tarjeta de proyecto',
  casoDestacado: 'Etiqueta de proyecto destacado sin foto',
  etiquetaServicio: 'Etiqueta sobre el título',
  tituloTipos: 'Título del bloque de tipos',
  tituloAplicaciones: 'Título del bloque de aplicaciones',
  tituloNormas: 'Título del bloque de normas',
  tituloGaleria: 'Título de la galería',
  obrasPrefijo: 'Título de la banda final (antes del nombre del servicio)',
  botonProyectos: 'Botón de la banda final hacia proyectos',
  botonContacto: 'Botón de la banda final hacia contacto',
  tituloDatosTecnicos: 'Título del bloque de datos técnicos',
  rotuloDiametro: 'Rótulo: un diámetro',
  rotuloDiametros: 'Rótulo: varios diámetros',
  rotuloLongitud: 'Rótulo: longitud',
  rotuloAcero: 'Rótulo: acero',
  rotuloPeso: 'Rótulo: peso',
  rotuloUbicacion: 'Rótulo: ubicación',
  tituloParticipantes: 'Título del bloque de participantes',
  rotuloContratista: 'Rótulo: contratista',
  rotuloMandante: 'Rótulo: mandante',
  rotuloCliente: 'Rótulo: cliente',
  tituloNormasAplicadas: 'Título del bloque de normas',
  enlaceServicio: 'Enlace al servicio (antes de su nombre)',
  enlaceVolver: 'Enlace de vuelta a proyectos',
  ubicacionTitulo: 'Título del recuadro',
  mapaTitulo: 'Título sobre el mapa',
  mapaLugar: 'Lugar sobre el mapa',
  mapaEnlace: 'Enlace al mapa',
  mapaDescripcion: 'Descripción del mapa para lectores de pantalla',
  codigo: 'Número grande',
  botonInicio: 'Botón hacia el inicio',
  botonContactar: 'Botón hacia contacto',
  saltarContenido: 'Enlace para saltar al contenido',
  videoPausar: 'Botón del video: pausar',
  videoReproducir: 'Botón del video: reproducir',
  visorNombre: 'Nombre del visor de fotos',
  visorCerrar: 'Visor: cerrar',
  visorAnterior: 'Visor: anterior',
  visorSiguiente: 'Visor: siguiente',
  carruselPausar: 'Carrusel de logos: pausar',
  carruselReanudar: 'Carrusel de logos: reanudar',
  tituloServicios: 'Título de la columna de servicios',
  tituloEmpresa: 'Título de la columna de empresa',
  tituloContacto: 'Título de la columna de contacto',
  enlaceQuienesSomos: 'Enlace a la página de empresa',
  rotuloTelefono: 'Rótulo del teléfono',
  rotuloCorreo: 'Rótulo del correo',
  rotuloDireccion: 'Rótulo de la dirección',
  derechos: 'Texto tras el nombre en el copyright',
  enlaceGoogleMaps: 'Enlace a Google Maps',
  enlaceWaze: 'Enlace a Waze',
  buscarRotulo: 'Rótulo del buscador',
  buscarEjemplo: 'Texto de ejemplo del buscador',
  filtroTodos: 'Filtro que muestra todas las categorías',
  columnaProyecto: 'Columna de la tabla: proyecto',
  columnaAlcance: 'Columna de la tabla: alcance',
  columnaCliente: 'Columna de la tabla: cliente',
  sinResultados: 'Aviso sin resultados',
  limpiarFiltros: 'Botón para limpiar la búsqueda',
  verMasUno: 'Botón «ver más» cuando queda uno',
  verMasVarios: 'Botón «ver más» ({n} = cuántos)',
  mostrandoProyectos: 'Recuento para lectores de pantalla',
  filtroTodas: 'Filtro que muestra todas las fotos',
  mostrandoUna: 'Recuento con una sola foto',
  mostrandoFotos: 'Recuento de fotos',
  sinFotos: 'Recuento sin fotos',
  enlaceProyecto: 'Enlace del visor al proyecto',
  sinProyectosTexto: 'Aviso si no hay proyectos destacados',
  sinProyectosBoton: 'Botón del aviso sin proyectos',
  // Nombres de las categorías de proyecto (proyectos.categorias).
  tuberias: 'Categoría: tuberías y blindajes',
  compuertas: 'Categoría: compuertas y válvulas',
  electromecanicos: 'Categoría: montajes especiales',
  limpiarrejas: 'Categoría: limpiarrejas',
  estructuras: 'Categoría: estructuras y tanques',
  eyebrow: 'Texto pequeño sobre el título',
  formEyebrow: 'Texto pequeño del formulario',
  formTitle: 'Título del formulario',
  infoEyebrow: 'Texto pequeño del bloque de datos',
  infoTitle: 'Título del bloque de datos',
  ubicacionTitle: 'Título del bloque de ubicación',
  body: 'Cuerpo del texto',
  description: 'Descripción',
  descripcionCorta: 'Descripción corta',
  descripcionLarga: 'Descripción larga',
  resumen: 'Resumen',
  note: 'Nota al pie',
  requiredNote: 'Aviso de campos obligatorios',
  caption: 'Pie de imagen',
  line1: 'Primera línea',
  line2: 'Segunda línea',
  successTitle: 'Título del mensaje de envío correcto',
  successBody: 'Texto del mensaje de envío correcto',
  errorBody: 'Texto del mensaje de error',
  emptyState: 'Texto cuando no hay contenido',
  noResults: 'Texto cuando la búsqueda no encuentra nada',

  // ── SEO ──
  seoTitle: 'Título para buscadores y pestaña',
  seoDescription: 'Descripción para buscadores',

  // ── Imágenes ──
  image: 'Imagen',
  imageAlt: 'Texto alternativo de la imagen',
  imageWidth: 'Ancho de la imagen (px)',
  imageHeight: 'Alto de la imagen (px)',
  images: 'Imágenes',
  logoSrc: 'Archivo del logo',
  logoAlt: 'Texto alternativo del logo',
  logoAriaLabel: 'Descripción del logo para lectores de pantalla',

  // ── Ficha de proyecto ──
  cliente: 'Cliente',
  mandante: 'Mandante',
  contratista: 'Contratista',
  ubicacion: 'Ubicación',
  location: 'Ubicación',
  alcance: 'Alcance de los trabajos',
  categoria: 'Categoría',
  tipo: 'Tipo',
  anio: 'Año',
  diametro: 'Diámetro',
  longitud: 'Longitud',
  peso: 'Peso',

  // ── Ficha de servicio ──
  nombre: 'Nombre',
  icono: 'Icono',
  tipos: 'Tipos',
  aplicaciones: 'Aplicaciones',
  normas: 'Normas',
  procesos: 'Procesos',
  orden: 'Orden de aparición',

  // ── Datos de la empresa ──
  razonSocial: 'Razón social',
  brand: 'Nombre de la marca',
  especialidad: 'Especialidad',
  modalidad: 'Modalidad de contrato',
  fundacion: 'Año de fundación',
  chileDesde: 'En Chile desde',
  domicilio: 'Domicilio',
  ciudad: 'Ciudad',
  casillaPostal: 'Casilla postal',
  telefono: 'Teléfono',
  email: 'Correo electrónico',
  sitioWeb: 'Sitio web',
  wordmarkPrimary: 'Nombre en el logotipo',
  wordmarkSub: 'Bajada del logotipo',

  // ── Formulario de contacto ──
  services: 'Servicios que se pueden elegir',
  subject: 'Asunto del correo que se envía',
  fromName: 'Remitente del correo que se envía',
  submitLabel: 'Texto del botón de envío',
  mobileMenuOpenLabel:
    'Nombre del botón que abre el menú en el móvil (lo leen los lectores de pantalla)',

  // ── Galería ──
  showFilters: 'Mostrar los filtros (true o false)',
  allItemsLabel: 'Texto de la opción «todas»',
  resultsLabel: 'Texto del recuento de resultados',
  emptyLabel: 'Texto cuando la categoría está vacía',
  searchPlaceholder: 'Texto de ejemplo del buscador',
  fallbackLabel: 'Texto de respaldo',

  // ── Enlaces y botones ──
  ctaLabel: 'Texto del botón',
  ctaHref: 'Destino del botón',
  buttonLabel: 'Texto del botón',
  primaryLabel: 'Texto del botón principal',
  secondaryLabel: 'Texto del botón secundario',
  linkLabel: 'Texto del enlace',
};

/** Nombre legible de una sección del sitio, para los menús y los enlaces. */
const SECCIONES: Record<string, string> = {
  Inicio: 'Inicio',
  Empresa: 'Empresa',
  Servicios: 'Servicios',
  Proyectos: 'Proyectos',
  Clientes: 'Clientes',
  Galeria: 'Galería',
  Calidad: 'Calidad',
  Contacto: 'Contacto',
  ServiciosCompuertas: 'Servicios · Compuertas',
  ServiciosInfraestructuras: 'Servicios · Infraestructuras',
  ServiciosLimpiarrejas: 'Servicios · Limpiarrejas',
  ServiciosMontajes: 'Servicios · Montajes',
  ServiciosTanques: 'Servicios · Tanques',
  ServiciosTuberias: 'Servicios · Tuberías',
  ServiciosTurbinas: 'Servicios · Turbinas',
  ServiciosValvulas: 'Servicios · Válvulas',
};

/** Qué parte de un elemento numerado nombra el sufijo. */
const PARTES: Record<string, string> = {
  Title: 'título',
  Label: 'rótulo',
  Value: 'valor',
  Desc: 'descripción',
  Alt: 'texto alternativo',
};

const FAMILIAS: Record<string, string> = {
  card: 'Tarjeta',
  item: 'Punto',
  gallery: 'Foto de la galería',
  p: 'Párrafo',
  stat: 'Cifra',
};

/** camelCase o kebab-case → «Frase legible». */
/** Los campos del formulario de contacto, por su nombre en pantalla. */
const CAMPOS_DEL_FORMULARIO: Record<string, string> = {
  name: 'Nombre',
  company: 'Empresa',
  email: 'Correo',
  phone: 'Teléfono',
  service: 'Servicio',
  message: 'Mensaje',
  submit: 'Enviar',
};

function humanizar(key: string): string {
  const conEspacios = key
    .replace(/[-_.]+/g, ' ')
    .replace(/([a-záéíóúñ0-9])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!conEspacios) return key;
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1).toLowerCase();
}

/**
 * Etiqueta legible para una clave de campo. Nunca devuelve vacío: si no
 * reconoce nada, devuelve la clave humanizada.
 */
export function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];

  // Menús y enlaces por sección: navServicios, hrefContacto…
  const nav = /^(nav|href)([A-Z].*)$/.exec(key);
  if (nav) {
    const seccion = SECCIONES[nav[2]] ?? humanizar(nav[2]);
    return nav[1] === 'nav' ? `Menú · ${seccion}` : `Enlace · ${seccion}`;
  }

  // Logotipos de clientes: logo-acciona, logo-aes-andes…
  const logo = /^logo-(.+)$/.exec(key);
  if (logo) {
    const nombre = logo[1]
      .split('-')
      .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
      .join(' ');
    return `Logo · ${nombre}`;
  }

  // Familias numeradas: card3Value, item5Title, gallery2Alt, p1Desc, item7, stat1Value.
  const numerado = /^(card|item|gallery|p|stat)(\d+)([A-Z][a-z]+)?$/.exec(key);
  if (numerado) {
    const familia = FAMILIAS[numerado[1]];
    const parte = numerado[3] ? PARTES[numerado[3]] : undefined;
    const base = `${familia} ${numerado[2]}`;
    if (!numerado[3]) return base;
    return parte ? `${base} · ${parte}` : `${base} · ${humanizar(numerado[3]).toLowerCase()}`;
  }

  // Sufijos del formulario: nameLabel, emailPlaceholder, messageRequiredError…
  const formulario = /^([a-z]+)(Label|Placeholder|RequiredError|InvalidError|TooShortError)$/.exec(
    key
  );
  if (formulario) {
    // P2-22 (auditoría 2026-09): salían «Rótulo del campo company» o «Error si
    // generic es demasiado corto», con la clave en inglés a la vista.
    const campo = CAMPOS_DEL_FORMULARIO[formulario[1]];
    const nombre = campo ? `«${campo}»` : humanizar(formulario[1]).toLowerCase();
    if (formulario[1] === 'generic') {
      switch (formulario[2]) {
        case 'RequiredError':
          return 'Error si un campo obligatorio está vacío';
        case 'InvalidError':
          return 'Error si un campo no es válido';
        case 'TooShortError':
          return 'Error si un campo es demasiado corto';
      }
    }
    switch (formulario[2]) {
      case 'Label':
        return `Nombre del campo ${nombre}`;
      case 'Placeholder':
        return `Texto de ejemplo del campo ${nombre}`;
      case 'RequiredError':
        return `Error si ${nombre} está vacío`;
      case 'InvalidError':
        return `Error si ${nombre} no es válido`;
      default:
        return `Error si ${nombre} es demasiado corto`;
    }
  }

  // Etiquetas de accesibilidad del visor: lightboxNextLabel…
  const lightbox = /^lightbox([A-Z][a-z]+)Label$/.exec(key);
  if (lightbox) return `Visor · botón ${humanizar(lightbox[1]).toLowerCase()}`;

  return humanizar(key);
}
