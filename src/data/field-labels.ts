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
    const campo = humanizar(formulario[1]).toLowerCase();
    switch (formulario[2]) {
      case 'Label':
        return `Rótulo del campo ${campo}`;
      case 'Placeholder':
        return `Texto de ejemplo del campo ${campo}`;
      case 'RequiredError':
        return `Error si ${campo} está vacío`;
      case 'InvalidError':
        return `Error si ${campo} no es válido`;
      default:
        return `Error si ${campo} es demasiado corto`;
    }
  }

  // Etiquetas de accesibilidad del visor: lightboxNextLabel…
  const lightbox = /^lightbox([A-Z][a-z]+)Label$/.exec(key);
  if (lightbox) return `Visor · botón ${humanizar(lightbox[1]).toLowerCase()}`;

  return humanizar(key);
}
