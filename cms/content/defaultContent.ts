import type { CmsEntry } from '../types/cms';

type EntrySeed = Omit<CmsEntry, 'version' | 'fields'> & {
  fields: Record<string, { type: CmsEntry['fields'][string]['type']; value: unknown }>;
};

const serviceImageSeeds: Array<{
  slug: string;
  title: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}> = [
  {
    slug: 'tuberias-forzadas',
    title: 'Tuberías forzadas',
    src: '/fotos/curadas/tuberia-forzada-tunel.webp',
    alt: 'Tubería forzada de gran diámetro instalada en túnel subterráneo',
    width: 1849,
    height: 851,
  },
  {
    slug: 'compuertas',
    title: 'Compuertas',
    src: '/fotos/curadas/compuertas.webp',
    alt: 'Compuertas planas azules instaladas entre machones de hormigón sobre el cauce',
    width: 1448,
    height: 1086,
  },
  {
    slug: 'valvulas',
    title: 'Válvulas',
    src: '/fotos/curadas/valvula-tuberia-tunel.webp',
    alt: 'Válvula instalada sobre tubería forzada en túnel',
    width: 1448,
    height: 1086,
  },
  {
    slug: 'turbinas',
    title: 'Turbinas',
    src: '/fotos/catalogo/turbinas-montaje-rodete-sobradelo.webp',
    alt: 'Montaje del rodete y el distribuidor de un grupo hidráulico con el puente grúa de la casa de máquinas',
    width: 1024,
    height: 768,
  },
  {
    slug: 'limpiarrejas',
    title: 'Limpiarrejas',
    src: '/fotos/curadas/limpiarrejas-peine-reja-taller.webp',
    alt: 'Peine del limpiarrejas recorriendo la reja durante las pruebas en taller',
    width: 1920,
    height: 1080,
  },
  {
    slug: 'otros-montajes',
    title: 'Montajes especiales',
    src: '/fotos/curadas/otros-montajes.jpg',
    alt: 'Montaje de gran componente hidromecánico',
    width: 471,
    height: 629,
  },
  {
    slug: 'infraestructuras',
    title: 'Infraestructura',
    src: '/fotos/curadas/otros-montajes.jpg',
    alt: 'Estructuras metálicas y obras civiles de infraestructura',
    width: 471,
    height: 629,
  },
  {
    slug: 'tanques-especiales',
    title: 'Tanques especiales',
    src: '/fotos/curadas/fabricacion-tuberias-taller.webp',
    alt: 'Fabricación y cilindrado de estanques y recipientes especiales en taller',
    width: 1200,
    height: 800,
  },
];

const projectImageSeeds: Array<{
  slug: string;
  title: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}> = [
  {
    slug: 'ch-los-condores',
    title: 'C.H. Los Cóndores',
    src: '/fotos/curadas/montaje-vertical-caverna.webp',
    alt: 'Montaje vertical de tubería forzada en caverna subterránea',
    width: 1086,
    height: 1448,
  },
  {
    slug: 'embalse-chironta',
    title: 'Embalse Chironta',
    src: '/fotos/curadas/proyecto-valvula-tunel.jpg',
    alt: 'Válvula instalada en túnel de central',
    width: 1024,
    height: 768,
  },
  {
    slug: 'ch-besaya',
    title: 'C.H. Besaya',
    src: '/fotos/curadas/proyecto-montaje-tuberia.jpg',
    alt: 'Montaje de tubería forzada de gran diámetro',
    width: 481,
    height: 640,
  },
  {
    slug: 'ch-doiras',
    title: 'C.H. Dorias',
    src: '/fotos/curadas/proyecto-bifurcacion-obra.jpg',
    alt: 'Bifurcación instalada en obra',
    width: 473,
    height: 354,
  },
  {
    slug: 'ch-queltehues',
    title: 'C.H. Queltehues',
    src: '/fotos/curadas/proyecto-tuberia-terreno.jpg',
    alt: 'Instalación de tubería en terreno',
    width: 639,
    height: 480,
  },
  {
    slug: 'ch-rio-frio',
    title: 'C.H. Río Frío',
    src: '/fotos/curadas/proyecto-tuberia-montana.webp',
    alt: 'Tubería forzada en ladera de montaña',
    width: 467,
    height: 697,
  },
  {
    slug: 'embalse-chacrillas',
    title: 'Embalse Chacrillas',
    src: '/fotos/curadas/bifurcacion-primer-taller.webp',
    alt: 'Bifurcación de gran diámetro en fabricación en taller',
    width: 1425,
    height: 1104,
  },
];

const serviceGallerySlugs = [
  'tuberias-forzadas',
  'compuertas',
  'valvulas',
  'turbinas',
  'limpiarrejas',
  'otros-montajes',
  'infraestructuras',
  'tanques-especiales',
];

const projectGallerySlugs = [
  'ch-los-condores',
  'embalse-chironta',
  'ch-besaya',
  'ch-doiras',
  'ch-queltehues',
  'ch-rio-frio',
  'embalse-chacrillas',
];

const clienteLogos: Array<{ key: string; nombre: string; logo: string }> = [
  { key: 'acciona', nombre: 'Acciona', logo: '/logos-clientes/acciona.svg' },
  { key: 'aes-andes', nombre: 'AES Andes', logo: '/logos-clientes/aes-andes.png' },
  { key: 'arauco', nombre: 'Arauco', logo: '/logos-clientes/arauco.svg' },
  { key: 'besalco', nombre: 'Besalco', logo: '/logos-clientes/besalco.webp' },
  { key: 'colbun', nombre: 'Colbún', logo: '/logos-clientes/colbun.svg' },
  { key: 'conpax', nombre: 'Conpax', logo: '/logos-clientes/conpax.png' },
  { key: 'elecnor', nombre: 'Elecnor', logo: '/logos-clientes/elecnor.svg' },
  {
    key: 'electrica-puntilla',
    nombre: 'Eléctrica Puntilla',
    logo: '/logos-clientes/electrica-puntilla.png',
  },
  { key: 'endesa', nombre: 'Endesa', logo: '/logos-clientes/endesa.png' },
  { key: 'engie', nombre: 'Engie', logo: '/logos-clientes/engie.png' },
  { key: 'ferrovial', nombre: 'Ferrovial', logo: '/logos-clientes/ferrovial.png' },
  { key: 'gpe', nombre: 'GPE', logo: '/logos-clientes/gpe.png' },
  { key: 'iberdrola', nombre: 'Iberdrola', logo: '/logos-clientes/iberdrola.png' },
  { key: 'mop-doh', nombre: 'M.O.P. / D.O.H.', logo: '/logos-clientes/mop-doh.jpeg' },
  { key: 'pacific-hydro', nombre: 'Pacific Hydro', logo: '/logos-clientes/pacific-hydro.png' },
];

const imageEntries: EntrySeed[] = [
  ...serviceImageSeeds.map((image) => ({
    id: `service-image.${image.slug}`,
    kind: 'settings',
    slug: `service-image/${image.slug}`,
    locale: 'es-CL',
    title: `Imagen servicio ${image.title}`,
    status: 'published' as const,
    fields: {
      image: { type: 'image' as const, value: image.src },
      imageAlt: { type: 'text' as const, value: image.alt },
      imageWidth: { type: 'number' as const, value: image.width },
      imageHeight: { type: 'number' as const, value: image.height },
    },
  })),
  ...projectImageSeeds.map((image) => ({
    id: `project-image.${image.slug}`,
    kind: 'settings',
    slug: `project-image/${image.slug}`,
    locale: 'es-CL',
    title: `Imagen proyecto ${image.title}`,
    status: 'published' as const,
    fields: {
      image: { type: 'image' as const, value: image.src },
      imageAlt: { type: 'text' as const, value: image.alt },
      imageWidth: { type: 'number' as const, value: image.width },
      imageHeight: { type: 'number' as const, value: image.height },
    },
  })),
  // Galerías de servicios (3 slots por servicio, vacíos por defecto)
  ...serviceGallerySlugs.map((slug) => ({
    id: `service-gallery.${slug}`,
    kind: 'settings',
    slug: `service-gallery/${slug}`,
    locale: 'es-CL',
    title: `Galería servicio ${slug}`,
    status: 'published' as const,
    fields: {
      gallery1: { type: 'image' as const, value: '' },
      gallery1Alt: { type: 'text' as const, value: '' },
      gallery2: { type: 'image' as const, value: '' },
      gallery2Alt: { type: 'text' as const, value: '' },
      gallery3: { type: 'image' as const, value: '' },
      gallery3Alt: { type: 'text' as const, value: '' },
    },
  })),
  // Galerías de proyectos (3 slots por proyecto, vacíos por defecto)
  ...projectGallerySlugs.map((slug) => ({
    id: `project-gallery.${slug}`,
    kind: 'settings',
    slug: `project-gallery/${slug}`,
    locale: 'es-CL',
    title: `Galería proyecto ${slug}`,
    status: 'published' as const,
    fields: {
      gallery1: { type: 'image' as const, value: '' },
      gallery1Alt: { type: 'text' as const, value: '' },
      gallery2: { type: 'image' as const, value: '' },
      gallery2Alt: { type: 'text' as const, value: '' },
      gallery3: { type: 'image' as const, value: '' },
      gallery3Alt: { type: 'text' as const, value: '' },
    },
  })),
];

export const defaultContentEntries: EntrySeed[] = [
  {
    id: 'site.company',
    kind: 'settings',
    slug: 'company',
    locale: 'es-CL',
    title: 'Datos corporativos',
    status: 'published',
    fields: {
      nombre: { type: 'text', value: 'Hidromont Chile' },
      razonSocial: { type: 'text', value: 'Hidromont Chile' },
      domicilio: { type: 'text', value: 'Av. Las Industrias N° 10.950' },
      ciudad: { type: 'text', value: 'Los Ángeles, Región del Biobío, Chile' },
      casillaPostal: { type: 'text', value: 'Casilla 48 — Los Ángeles, Región del Biobío' },
      telefono: { type: 'text', value: '+56 43 232 8414' },
      email: { type: 'text', value: 'hidromont@hidromont.cl' },
      sitioWeb: { type: 'link', value: 'https://hidromont.cl' },
      fundacion: { type: 'number', value: 1983 },
      chileDesde: { type: 'number', value: 1997 },
      descripcionCorta: {
        type: 'textarea',
        value:
          'Ingeniería, fabricación y montaje de equipos hidromecánicos para embalses y centrales hidroeléctricas.',
      },
      descripcionLarga: {
        type: 'textarea',
        value:
          'Realizamos ingeniería, fabricación y montaje de tuberías forzadas, blindajes, compuertas, válvulas, turbinas y limpiarrejas para obras hidráulicas e hidroeléctricas.',
      },
      especialidad: {
        type: 'textarea',
        value:
          'Ingeniería, fabricación y montaje de equipos hidromecánicos para embalses y centrales hidroeléctricas.',
      },
      modalidad: { type: 'text', value: 'Proyectos EPC' },
    },
  },
  ...imageEntries,
  {
    id: 'layout.header',
    kind: 'layout',
    slug: 'header',
    locale: 'es-CL',
    title: 'Header',
    status: 'published',
    fields: {
      logoSrc: { type: 'image', value: '' },
      logoAlt: { type: 'text', value: 'Hidromont Chile' },
      logoAriaLabel: { type: 'text', value: 'Hidromont Chile — Inicio' },
      wordmarkPrimary: { type: 'text', value: 'HIDROMONT' },
      wordmarkSub: { type: 'text', value: 'Chile' },
      navInicio: { type: 'text', value: 'Inicio' },
      hrefInicio: { type: 'text', value: '/' },
      navServicios: { type: 'text', value: 'Servicios' },
      hrefServicios: { type: 'text', value: '/servicios' },
      navServiciosTuberias: { type: 'text', value: 'Tuberías Forzadas' },
      hrefServiciosTuberias: { type: 'text', value: '/servicios/tuberias-forzadas' },
      navServiciosCompuertas: { type: 'text', value: 'Compuertas' },
      hrefServiciosCompuertas: { type: 'text', value: '/servicios/compuertas' },
      navServiciosValvulas: { type: 'text', value: 'Válvulas' },
      hrefServiciosValvulas: { type: 'text', value: '/servicios/valvulas' },
      navServiciosTurbinas: { type: 'text', value: 'Turbinas' },
      hrefServiciosTurbinas: { type: 'text', value: '/servicios/turbinas' },
      navServiciosLimpiarrejas: { type: 'text', value: 'Limpiarrejas' },
      hrefServiciosLimpiarrejas: { type: 'text', value: '/servicios/limpiarrejas' },
      navServiciosMontajes: { type: 'text', value: 'Montajes Especiales' },
      hrefServiciosMontajes: { type: 'text', value: '/servicios/otros-montajes' },
      navServiciosInfraestructuras: { type: 'text', value: 'Infraestructuras' },
      hrefServiciosInfraestructuras: { type: 'text', value: '/servicios/infraestructuras' },
      navServiciosTanques: { type: 'text', value: 'Tanques Especiales' },
      hrefServiciosTanques: { type: 'text', value: '/servicios/tanques-especiales' },
      navProyectos: { type: 'text', value: 'Proyectos' },
      hrefProyectos: { type: 'text', value: '/proyectos' },
      navGaleria: { type: 'text', value: 'Galería' },
      hrefGaleria: { type: 'text', value: '/galeria' },
      navEmpresa: { type: 'text', value: 'Empresa' },
      hrefEmpresa: { type: 'text', value: '/empresa' },
      navClientes: { type: 'text', value: 'Clientes' },
      hrefClientes: { type: 'text', value: '/clientes' },
      navContacto: { type: 'text', value: 'Contacto' },
      hrefContacto: { type: 'text', value: '/contacto' },
      ctaLabel: { type: 'text', value: 'Contáctenos' },
      ctaHref: { type: 'text', value: '/contacto' },
      mobileMenuOpenLabel: { type: 'text', value: 'Abrir menú de navegación' },
    },
  },
  {
    id: 'home.hero',
    kind: 'page',
    slug: '/',
    locale: 'es-CL',
    title: 'Hero home',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Especialistas en equipos hidromecánicos' },
      title: { type: 'text', value: 'Ingeniería, fabricación y montaje de equipos hidromecánicos' },
      subtitle: {
        type: 'textarea',
        value:
          'Tuberías forzadas, blindajes, compuertas, válvulas, turbinas y limpiarrejas para embalses y centrales hidroeléctricas. En España desde 1983 y en Chile desde 1997, con taller en Los Ángeles.',
      },
      primaryLabel: { type: 'text', value: 'Conocer nuestros servicios' },
      secondaryLabel: { type: 'text', value: 'Ver proyectos' },
    },
  },
  {
    id: 'home.services',
    kind: 'page',
    slug: '/',
    locale: 'es-CL',
    title: 'Servicios home',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Servicios' },
      title: { type: 'text', value: 'Servicios hidromecánicos' },
      subtitle: {
        type: 'textarea',
        value:
          'Cubrimos toda la cadena de valor de los proyectos hidromecánicos: desde ingeniería y fabricación hasta montaje y mantenimiento.',
      },
    },
  },
  {
    id: 'home.capabilities',
    kind: 'page',
    slug: '/',
    locale: 'es-CL',
    title: 'Capacidades home',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Por qué elegirnos' },
      title: { type: 'text', value: 'Ingeniería, fabricación y montaje' },
      subtitle: {
        type: 'textarea',
        value:
          'Más de 40 años de trayectoria en proyectos hidráulicos nacionales e internacionales.',
      },
    },
  },
  {
    id: 'home.installations',
    kind: 'page',
    slug: '/',
    locale: 'es-CL',
    title: 'Instalaciones home',
    status: 'published',
    fields: {
      image: { type: 'image', value: '/fotos/curadas/fabricacion-tuberias-taller.webp' },
      imageAlt: {
        type: 'text',
        value: 'Fabricación de tuberías forzadas de gran diámetro en el taller de Hidromont',
      },
      eyebrow: { type: 'text', value: 'Instalaciones y medios productivos' },
      title: { type: 'text', value: 'Instalaciones en Los Ángeles, Biobío' },
      subtitle: {
        type: 'textarea',
        value:
          'Infraestructura especializada para responder a proyectos complejos con rapidez y precisión.',
      },
    },
  },
  {
    id: 'home.projects',
    kind: 'page',
    slug: '/',
    locale: 'es-CL',
    title: 'Proyectos home',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Experiencia' },
      title: { type: 'text', value: 'Proyectos destacados' },
      buttonLabel: { type: 'text', value: 'Ver todos los proyectos' },
    },
  },
  {
    id: 'home.cta',
    kind: 'page',
    slug: '/',
    locale: 'es-CL',
    title: 'CTA home',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Contáctenos' },
      title: { type: 'text', value: '¿Quiere saber más sobre nuestra empresa?' },
      subtitle: {
        type: 'textarea',
        value:
          'Podemos revisar los antecedentes técnicos y el alcance de su proyecto hidromecánico.',
      },
      primaryLabel: { type: 'text', value: 'Contacto' },
      secondaryLabel: { type: 'text', value: 'Conocer la empresa' },
    },
  },
  {
    id: 'empresa.hero',
    kind: 'page',
    slug: '/empresa',
    locale: 'es-CL',
    title: 'Hero empresa',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Quiénes somos' },
      title: { type: 'text', value: 'Empresa' },
      subtitle: {
        type: 'textarea',
        value: 'Trayectoria desde 1983. Especialización en ingeniería hidromecánica.',
      },
      image: { type: 'image', value: '/fotos/curadas/taller-nave.webp' },
      imageAlt: {
        type: 'text',
        value: 'Nave del taller industrial de Hidromont con grúa pórtico de 20 toneladas',
      },
    },
  },
  {
    id: 'servicios.index.hero',
    kind: 'page',
    slug: '/servicios',
    locale: 'es-CL',
    title: 'Hero servicios',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Servicios' },
      title: { type: 'text', value: 'Servicios hidromecánicos' },
      subtitle: {
        type: 'textarea',
        value:
          'Ocho líneas de trabajo: tuberías forzadas y blindajes, compuertas, válvulas, turbinas, limpiarrejas, tanques especiales, infraestructuras y fabricaciones especiales.',
      },
      image: { type: 'image', value: '/fotos/curadas/otros-montajes.jpg' },
      imageAlt: { type: 'text', value: 'Fabricación de grandes equipos hidromecánicos en taller' },
    },
  },
  {
    id: 'proyectos.index.hero',
    kind: 'page',
    slug: '/proyectos',
    locale: 'es-CL',
    title: 'Hero proyectos',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Experiencia' },
      title: { type: 'text', value: 'Proyectos' },
      subtitle: {
        type: 'textarea',
        value:
          'Más de 40 años de proyectos hidráulicos nacionales e internacionales. Tuberías forzadas, compuertas, válvulas, turbinas, limpiarrejas y montajes electromecánicos.',
      },
      image: { type: 'image', value: '/fotos/curadas/bifurcacion-t-taller.webp' },
      imageAlt: { type: 'text', value: 'Bifurcación en T de gran diámetro fabricada en taller' },
    },
  },
  {
    id: 'page.galeria',
    kind: 'page',
    slug: '/galeria',
    locale: 'es-CL',
    title: 'Galería',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Nuestro trabajo' },
      title: { type: 'text', value: 'Galería' },
      subtitle: {
        type: 'textarea',
        value: 'Imágenes de nuestros proyectos, instalaciones y equipo.',
      },
      image: { type: 'image', value: '' },
      imageAlt: { type: 'text', value: 'Galería de proyectos Hidromont Chile' },
    },
  },
  {
    id: 'contacto.hero',
    kind: 'page',
    slug: '/contacto',
    locale: 'es-CL',
    title: 'Hero contacto',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Contacto' },
      title: { type: 'text', value: 'Conversemos' },
      subtitle: {
        type: 'textarea',
        value:
          'Nuestro equipo puede apoyarle en ingeniería, fabricación, montaje y mantenimiento de equipos hidromecánicos para embalses, presas, conducciones y centrales hidroeléctricas.',
      },
    },
  },
  {
    id: 'contacto.sections',
    kind: 'page',
    slug: '/contacto',
    locale: 'es-CL',
    title: 'Secciones contacto',
    status: 'published',
    fields: {
      formEyebrow: { type: 'text', value: 'Formulario de contacto' },
      formTitle: { type: 'text', value: 'Envíe su consulta' },
      infoEyebrow: { type: 'text', value: 'Datos de contacto' },
      infoTitle: { type: 'text', value: 'Información directa' },
    },
  },
  {
    id: 'contact.form',
    kind: 'component',
    slug: 'contact-form',
    locale: 'es-CL',
    title: 'Formulario de contacto',
    status: 'published',
    fields: {
      subject: { type: 'text', value: 'Nuevo contacto desde hidromont.cl' },
      fromName: { type: 'text', value: 'Sitio web Hidromont Chile' },
      nameLabel: { type: 'text', value: 'Nombre' },
      namePlaceholder: { type: 'text', value: 'Su nombre completo' },
      companyLabel: { type: 'text', value: 'Empresa' },
      companyPlaceholder: { type: 'text', value: 'Nombre de su empresa' },
      emailLabel: { type: 'text', value: 'Correo electrónico' },
      emailPlaceholder: { type: 'text', value: 'correo@empresa.com' },
      phoneLabel: { type: 'text', value: 'Teléfono' },
      phonePlaceholder: { type: 'text', value: '+56 9 1234 5678' },
      serviceLabel: { type: 'text', value: 'Servicio requerido' },
      servicePlaceholder: { type: 'text', value: 'Seleccione un servicio (opcional)' },
      services: {
        type: 'list',
        value: [
          'Tuberías Forzadas y Blindajes',
          'Compuertas',
          'Válvulas Hidráulicas',
          'Turbinas Hidráulicas',
          'Limpiarrejas',
          'Montajes y Fabricaciones Especiales',
          'Otro',
        ],
      },
      messageLabel: { type: 'text', value: 'Mensaje' },
      messagePlaceholder: { type: 'text', value: 'Describa su proyecto o consulta técnica.' },
      submitLabel: { type: 'text', value: 'Enviar consulta' },
      requiredNote: {
        type: 'textarea',
        value:
          'Los campos marcados con * son obligatorios. Le contactaremos después de revisar su consulta.',
      },
      nameRequiredError: { type: 'text', value: 'Por favor ingrese su nombre.' },
      nameTooShortError: { type: 'text', value: 'El nombre debe tener al menos 2 caracteres.' },
      emailRequiredError: { type: 'text', value: 'Por favor ingrese su correo electrónico.' },
      emailInvalidError: {
        type: 'text',
        value: 'Ingrese un correo válido (ej. correo@empresa.com).',
      },
      messageRequiredError: { type: 'text', value: 'Por favor escriba su consulta o mensaje.' },
      genericRequiredError: { type: 'text', value: 'Campo requerido.' },
      genericInvalidError: { type: 'text', value: 'Valor inválido.' },
      genericTooShortError: { type: 'text', value: 'Valor demasiado corto.' },
    },
  },
  {
    id: 'contact.info',
    kind: 'component',
    slug: 'contact-info',
    locale: 'es-CL',
    title: 'Información de contacto',
    status: 'published',
    fields: {
      title: { type: 'text', value: 'Información de contacto' },
      addressLabel: { type: 'text', value: 'Dirección' },
      phoneLabel: { type: 'text', value: 'Teléfono' },
      emailLabel: { type: 'text', value: 'Correo electrónico' },
      note: {
        type: 'textarea',
        value:
          'Envíenos sus antecedentes y nuestro equipo técnico responderá a la brevedad. Puede adjuntar planos, fichas técnicas o cualquier documento de referencia.',
      },
    },
  },
  {
    id: 'contacto.gracias',
    kind: 'page',
    slug: '/contacto/gracias',
    locale: 'es-CL',
    title: 'Página gracias contacto',
    status: 'published',
    fields: {
      pageTitle: { type: 'text', value: 'Mensaje enviado' },
      description: {
        type: 'textarea',
        value:
          'Su mensaje fue enviado correctamente. El equipo de Hidromont Chile le contactará después de revisarlo.',
      },
      title: { type: 'text', value: 'Mensaje enviado correctamente' },
      subtitle: {
        type: 'textarea',
        value: 'Su mensaje fue enviado correctamente. Le contactaremos después de revisarlo.',
      },
      primaryLabel: { type: 'text', value: 'Volver al inicio' },
      secondaryLabel: { type: 'text', value: 'Ver nuestros proyectos' },
    },
  },
  {
    id: 'layout.footer',
    kind: 'layout',
    slug: 'footer',
    locale: 'es-CL',
    title: 'Footer',
    status: 'published',
    fields: {
      brand: { type: 'text', value: 'Hidromont Chile' },
      description: {
        type: 'textarea',
        value:
          'Ingeniería, fabricación y montaje de equipos hidromecánicos para embalses y centrales hidroeléctricas. Desde 1983 ejecutando proyectos complejos con precisión industrial.',
      },
      location: { type: 'text', value: 'Los Ángeles, Región del Biobío, Chile' },
    },
  },
  {
    id: 'clients.strip',
    kind: 'component',
    slug: 'clients-strip',
    locale: 'es-CL',
    title: 'Clientes strip',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Clientes y referencias' },
      title: { type: 'text', value: 'Empresas que confían en Hidromont' },
      fallbackLabel: { type: 'text', value: 'También trabajamos con' },
      linkLabel: { type: 'text', value: 'Ver todos los clientes' },
    },
  },

  // ─── Empresa ──────────────────────────────────────────────────────────────

  {
    id: 'empresa.historia',
    kind: 'page',
    slug: '/empresa',
    locale: 'es-CL',
    title: 'Historia empresa',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Historia' },
      title: { type: 'text', value: 'Más de 40 años en infraestructura hidráulica' },
      p1: {
        type: 'textarea',
        value:
          'Hidromont Chile es parte de una empresa de origen español con trayectoria desde 1983. Cuenta con sede en la Región del Biobío, Chile, desde donde participa en la construcción y rehabilitación de proyectos hidráulicos a nivel nacional e internacional.',
      },
      p2: {
        type: 'textarea',
        value:
          'La compañía realiza ingeniería, fabricación y montaje de equipos hidromecánicos para embalses y centrales hidroeléctricas.',
      },
      p3: {
        type: 'textarea',
        value:
          'Realizamos montajes hidráulicos e industriales de tuberías forzadas, blindajes, compuertas, válvulas, turbinas y limpiarrejas.',
      },
    },
  },
  {
    id: 'empresa.metricas',
    kind: 'page',
    slug: '/empresa',
    locale: 'es-CL',
    title: 'Métricas empresa',
    status: 'published',
    fields: {
      card1Value: { type: 'text', value: '1983' },
      card1Label: { type: 'text', value: 'Fundación' },
      card1Desc: { type: 'text', value: 'Origen español' },
      card2Value: { type: 'text', value: 'EPC' },
      card2Label: { type: 'text', value: 'Modalidad' },
      card2Desc: { type: 'text', value: 'Ingeniería, fabricación y montaje' },
      card3Value: { type: 'text', value: 'ISO 9001' },
      card3Label: { type: 'text', value: 'Calidad' },
      card3Desc: { type: 'text', value: 'Sistema de gestión' },
      ubicacionTitle: { type: 'text', value: 'Ubicación' },
    },
  },
  {
    id: 'empresa.instalaciones',
    kind: 'page',
    slug: '/empresa',
    locale: 'es-CL',
    title: 'Instalaciones empresa',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Infraestructura' },
      title: { type: 'text', value: 'Instalaciones y medios productivos' },
      subtitle: {
        type: 'textarea',
        value:
          'El taller se montó para abastecer con urgencia las piezas imprevistas que aparecen durante una reparación, y permite fabricar tubería de gran diámetro y mecanizar en la misma nave.',
      },
      item1Title: { type: 'text', value: 'Superficie de terreno' },
      item1Value: { type: 'text', value: '11.000 m²' },
      item1Desc: {
        type: 'textarea',
        value:
          'Área de terreno destinada a maniobras de acopio, premontaje y logística de grandes estructuras.',
      },
      item2Title: { type: 'text', value: 'Taller industrial' },
      item2Value: { type: 'text', value: '2.000 m²' },
      item2Desc: {
        type: 'textarea',
        value:
          'Preparado para fabricar elementos de gran tamaño y responder a suministros urgentes.',
      },
      item3Title: { type: 'text', value: 'Taller de pintura' },
      item3Value: { type: 'text', value: '400 m²' },
      item3Desc: {
        type: 'textarea',
        value:
          'Área techada y equipada para preparación de superficie, arenado y aplicación de pintura industrial.',
      },
      item4Title: { type: 'text', value: 'Oficinas e ingeniería' },
      item4Value: { type: 'text', value: '320 m²' },
      item4Desc: {
        type: 'textarea',
        value: 'Equipo técnico dedicado a ingeniería de proyectos, cálculo y control de calidad.',
      },
      item6Title: { type: 'text', value: 'Puentes grúa' },
      item6Value: { type: 'text', value: '5 unidades' },
      item6Desc: {
        type: 'textarea',
        value: '5 puentes grúa de 10 a 20 t para maniobras de fabricación y montaje.',
      },
    },
  },
  {
    id: 'empresa.maquinaria',
    kind: 'page',
    slug: '/empresa',
    locale: 'es-CL',
    title: 'Maquinaria empresa',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Equipamiento' },
      title: { type: 'text', value: 'Maquinaria especializada' },
      subtitle: {
        type: 'textarea',
        value:
          'El taller dispone de equipos para fabricación, mecanizado, soldadura, corte y montaje de componentes hidromecánicos.',
      },
      item1: {
        type: 'text',
        value: 'Estaciones de soldadura automática de arco sumergido (4 unidades)',
      },
      item2: { type: 'text', value: 'Fresadora DYE600 de carrera 7 m' },
      item3: { type: 'text', value: 'Tornos paralelos de 2 m y 6 m' },
      item4: { type: 'text', value: 'Torno al aire con volteo 4,5 m' },
      item5: { type: 'text', value: 'Cizalla LOIRE 3 m/16 mm' },
      item6: { type: 'text', value: 'Mesa de corte ESAB SHARK CS 12 m × 3 m, plasma hasta 32 mm' },
      item7: { type: 'text', value: 'Plegadora MEBUSA 200 t × 3 m' },
      item8: { type: 'text', value: 'Oxicorte hasta 100 mm' },
      item9: { type: 'text', value: 'Grúa autopropulsada 50 t' },
      item10: { type: 'text', value: 'Grupos electrógenos de 100 a 200 KVA' },
    },
  },
  {
    id: 'empresa.mediosdeobra',
    kind: 'page',
    slug: '/empresa',
    locale: 'es-CL',
    title: 'Medios de obra empresa',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Capacidad de montaje' },
      title: { type: 'text', value: 'Medios de obra' },
      subtitle: {
        type: 'textarea',
        value:
          'Disponemos de medios propios para ejecutar montajes en terreno, incluyendo obras de acceso difícil que requieren medios especiales de transporte.',
      },
      item1: { type: 'text', value: 'Grúa autopropulsada 50 t' },
      item2: { type: 'text', value: 'Camiones pluma para maniobras de montaje en terreno' },
      item3: { type: 'text', value: 'Vehículos Pick-Up 4×4 para acceso a terreno' },
      item4: { type: 'text', value: 'Grupos electrógenos de 100 a 200 KVA' },
      item5: { type: 'text', value: 'Equipos de arenado y pintura industrial' },
      item6: {
        type: 'text',
        value: 'Bastidores y equipos de armado para tuberías de mediano y gran diámetro',
      },
      item7: { type: 'text', value: 'Plataformas y teleférico para montajes en pendiente' },
      item8: { type: 'text', value: 'Winches de alto tonelaje' },
    },
  },
  {
    id: 'empresa.cta',
    kind: 'page',
    slug: '/empresa',
    locale: 'es-CL',
    title: 'CTA empresa',
    status: 'published',
    fields: {
      title: { type: 'text', value: '¿Necesita revisar un alcance técnico?' },
      subtitle: {
        type: 'textarea',
        value:
          'Cuéntenos el alcance de su obra y revisamos qué parte podemos ejecutar en el taller de Los Ángeles y qué parte en terreno.',
      },
      buttonLabel: { type: 'text', value: 'Contactar equipo técnico' },
    },
  },

  // ─── Calidad (A2-002): entradas calidad.* eliminadas. No merecen sección propia;
  //     la certificación ISO 9001 ya está representada en la tarjeta de métricas
  //     `empresa.metricas.card3*` de empresa.astro. Reubicar el contenido futuro
  //     editando esa tarjeta vía CMS si se quiere expandir. ─────────────────────

  // ─── Servicios index ──────────────────────────────────────────────────────

  {
    id: 'servicios.index.metodologia',
    kind: 'page',
    slug: '/servicios',
    locale: 'es-CL',
    title: 'Metodología servicios',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Metodología' },
      title: { type: 'text', value: 'Actividades transversales' },
      subtitle: {
        type: 'textarea',
        value:
          'Todas nuestras líneas de servicio comparten un mismo enfoque metodológico que garantiza calidad, trazabilidad y seguridad en cada etapa del proyecto.',
      },
      item1Title: { type: 'text', value: 'Desmontajes' },
      item1Desc: {
        type: 'textarea',
        value: 'Desmontaje controlado de equipos para reparación o sustitución.',
      },
      item2Title: { type: 'text', value: 'Fabricación' },
      item2Desc: {
        type: 'textarea',
        value: 'Oxicorte, plegado, armado, soldadura, mecanizado y ensamblado.',
      },
      item3Title: { type: 'text', value: 'Reparaciones' },
      item3Desc: {
        type: 'textarea',
        value: 'Limpieza, tratamiento superficial, juntas y sistemas de accionamiento.',
      },
      item4Title: { type: 'text', value: 'Mantenimiento de turbinas' },
      item4Desc: {
        type: 'textarea',
        value: 'Recuperación de rodetes por cavitación, alineaciones y mecanizados.',
      },
      item5Title: { type: 'text', value: 'Montajes' },
      item5Desc: {
        type: 'textarea',
        value: 'Procedimientos específicos con análisis de medios y tiempos.',
      },
      item6Title: { type: 'text', value: 'Obturaciones' },
      item6Desc: {
        type: 'textarea',
        value: 'Diseño, fabricación y montaje de obturaciones especiales.',
      },
    },
  },
  {
    id: 'servicios.index.cta',
    kind: 'page',
    slug: '/servicios',
    locale: 'es-CL',
    title: 'CTA servicios',
    status: 'published',
    fields: {
      title: { type: 'text', value: '¿Necesita un servicio específico?' },
      subtitle: {
        type: 'textarea',
        value: 'Converse con nuestro equipo técnico sobre los requisitos de su proyecto.',
      },
      buttonLabel: { type: 'text', value: 'Contacto' },
    },
  },

  // ─── Proyectos index ──────────────────────────────────────────────────────

  {
    id: 'proyectos.index.destacados',
    kind: 'page',
    slug: '/proyectos',
    locale: 'es-CL',
    title: 'Destacados proyectos',
    status: 'published',
    fields: {
      // IMPORTANTE: NO VOLVER A INCLUIR el campo 'eyebrow' (que contenía "Casos de referencia"). Solicitud expresa del usuario.
      title: { type: 'text', value: 'Proyectos de referencia' },
    },
  },
  {
    id: 'proyectos.index.banco',
    kind: 'page',
    slug: '/proyectos',
    locale: 'es-CL',
    title: 'Banco proyectos',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Banco de proyectos' },
      title: { type: 'text', value: 'Registro de obras hidráulicas e hidroeléctricas' },
      subtitle: {
        type: 'textarea',
        value:
          'Obras del grupo en Chile, España, Honduras y Costa Rica, agrupadas por línea de servicio.',
      },
    },
  },
  {
    id: 'proyectos.index.cta',
    kind: 'page',
    slug: '/proyectos',
    locale: 'es-CL',
    title: 'CTA proyectos',
    status: 'published',
    fields: {
      title: { type: 'text', value: 'Más de 40 años de proyectos en Chile y el exterior' },
      subtitle: {
        type: 'textarea',
        value: 'Hemos ejecutado obras en Chile, España, Honduras y Costa Rica.',
      },
      buttonLabel: { type: 'text', value: 'Contacto' },
    },
  },

  // ─── Clientes ─────────────────────────────────────────────────────────────

  {
    id: 'clientes.hero',
    kind: 'page',
    slug: '/clientes',
    locale: 'es-CL',
    title: 'Hero clientes',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Nuestros clientes' },
      title: { type: 'text', value: 'Clientes' },
      subtitle: {
        type: 'textarea',
        value:
          'Empresas eléctricas, constructoras, mineras, sanitarias e industriales que han confiado en Hidromont para sus proyectos hidráulicos e hidroeléctricos.',
      },
    },
  },
  {
    id: 'clientes.sectores',
    kind: 'page',
    slug: '/clientes',
    locale: 'es-CL',
    title: 'Referencias clientes',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Nuestros clientes' },
      // IMPORTANTE: NO VOLVER A INCLUIR el campo 'title' (que contenía "Empresas que confían en nosotros" o similares). Solicitud expresa del usuario.
    },
  },
  {
    id: 'clientes.cta',
    kind: 'page',
    slug: '/clientes',
    locale: 'es-CL',
    title: 'CTA clientes',
    status: 'published',
    fields: {
      title: {
        type: 'text',
        value: '¿Trabaja en una obra hidráulica o hidroeléctrica?',
      },
      subtitle: {
        type: 'textarea',
        value: 'Cuéntenos el alcance y revisamos las alternativas de fabricación y montaje.',
      },
      buttonLabel: { type: 'text', value: 'Contacto' },
    },
  },
  {
    id: 'clientes.logos',
    kind: 'settings',
    slug: 'clientes/logos',
    locale: 'es-CL',
    title: 'Logos de clientes',
    status: 'published',
    fields: Object.fromEntries(
      clienteLogos.map(({ key, logo }) => [`logo-${key}`, { type: 'image' as const, value: logo }])
    ),
  },
];
