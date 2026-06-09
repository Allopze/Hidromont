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
    src: '/fotos/curadas/compuertas.jpg',
    alt: 'Compuerta hidráulica instalada en presa',
    width: 446,
    height: 621,
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
    src: '/fotos/curadas/turbinas.jpg',
    alt: 'Sala de máquinas con turbinas hidráulicas',
    width: 474,
    height: 271,
  },
  {
    slug: 'limpiarrejas',
    title: 'Limpiarrejas',
    src: '/fotos/curadas/limpiarrejas.jpg',
    alt: 'Limpiarreja instalada en obra hidroeléctrica',
    width: 471,
    height: 314,
  },
  {
    slug: 'otros-montajes',
    title: 'Montajes especiales',
    src: '/fotos/curadas/otros-montajes.jpg',
    alt: 'Montaje de gran componente hidromecánico',
    width: 471,
    height: 629,
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
    slug: 'ch-dorias',
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
      nombre: { type: 'text', value: 'Hidromont Chile S.A.' },
      razonSocial: { type: 'text', value: 'Hidromont Chile S.A.' },
      domicilio: { type: 'text', value: 'Av. Las Industrias N° 10.950, Longitudinal Sur, Km 513' },
      ciudad: { type: 'text', value: 'Los Ángeles, Región del Biobío, Chile' },
      casillaPostal: { type: 'text', value: 'Casilla 48 — Los Ángeles, Región del Biobío' },
      telefono: { type: 'text', value: '+56 43 32 84 14' },
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
          'Especialistas en montajes hidráulicos e industriales, con experiencia en tuberías forzadas, blindajes, compuertas, válvulas, turbinas y limpiarrejas. Integramos ingeniería, fabricación y montaje para entregar soluciones seguras, robustas y adaptadas a cada proyecto hidroeléctrico o hidráulico.',
      },
      especialidad: {
        type: 'textarea',
        value:
          'Ingeniería, fabricación y montaje de equipos hidromecánicos para embalses y centrales hidroeléctricas.',
      },
      modalidad: { type: 'text', value: 'Proyectos llave en mano / EPC' },
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
      logoAlt: { type: 'text', value: 'Hidromont Chile S.A.' },
      logoAriaLabel: { type: 'text', value: 'Hidromont Chile — Inicio' },
      wordmarkPrimary: { type: 'text', value: 'HIDROMONT' },
      wordmarkSub: { type: 'text', value: 'Chile S.A.' },
      navInicio: { type: 'text', value: 'Inicio' },
      navServicios: { type: 'text', value: 'Servicios' },
      navServiciosTuberias: { type: 'text', value: 'Tuberías Forzadas' },
      navServiciosCompuertas: { type: 'text', value: 'Compuertas' },
      navServiciosValvulas: { type: 'text', value: 'Válvulas' },
      navServiciosTurbinas: { type: 'text', value: 'Turbinas' },
      navServiciosLimpiarrejas: { type: 'text', value: 'Limpiarrejas' },
      navServiciosMontajes: { type: 'text', value: 'Montajes Especiales' },
      navProyectos: { type: 'text', value: 'Proyectos' },
      navEmpresa: { type: 'text', value: 'Empresa' },
      navCalidad: { type: 'text', value: 'Calidad' },
      navClientes: { type: 'text', value: 'Clientes' },
      navContacto: { type: 'text', value: 'Contacto' },
      ctaLabel: { type: 'text', value: 'Contáctenos' },
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
          'Más de 40 años de trayectoria en proyectos hidráulicos e hidroeléctricos en Chile y el exterior. Especialistas en soluciones técnicas de alta complejidad desde 1983.',
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
      title: { type: 'text', value: 'Soluciones hidromecánicas llave en mano' },
      subtitle: {
        type: 'textarea',
        value:
          'Cubrimos toda la cadena de valor de los proyectos hidromecánicos: desde ingeniería y fabricación hasta montaje, mantenimiento y rehabilitación en terreno.',
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
      title: { type: 'text', value: 'Capacidad técnica y experiencia comprobada' },
      subtitle: {
        type: 'textarea',
        value: 'Más de 40 años de trayectoria en proyectos hidráulicos nacionales e internacionales.',
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
      title: { type: 'text', value: 'Taller propio en Los Ángeles, Biobío' },
      subtitle: {
        type: 'textarea',
        value: 'Infraestructura especializada para responder a proyectos complejos con rapidez y precisión.',
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
          'Estamos disponibles para presentar nuestra trayectoria, capacidades técnicas y experiencia en proyectos hidromecánicos nacionales e internacionales.',
      },
      primaryLabel: { type: 'text', value: 'Ponerse en contacto' },
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
        value:
          'Trayectoria desde 1983. Presencia en Chile desde 1997. Especialización exclusiva en ingeniería hidromecánica.',
      },
      image: { type: 'image', value: '/fotos/curadas/taller-nave.webp' },
      imageAlt: { type: 'text', value: 'Nave del taller industrial de Hidromont con grúa pórtico de 20 toneladas' },
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
      title: { type: 'text', value: 'Soluciones hidromecánicas llave en mano' },
      subtitle: {
        type: 'textarea',
        value:
          'Desde ingeniería hasta montaje en terreno. Abarcamos toda la cadena de valor: tuberías forzadas, compuertas, válvulas, turbinas, limpiarrejas y fabricaciones especiales.',
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
          'Nuestro equipo puede apoyarle en ingeniería, fabricación, montaje, mantenimiento y rehabilitación de equipos hidromecánicos para embalses, presas, conducciones y centrales hidroeléctricas.',
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
        value: 'Los campos marcados con * son obligatorios. Te contactaremos a la brevedad.',
      },
      nameRequiredError: { type: 'text', value: 'Por favor ingrese su nombre.' },
      nameTooShortError: { type: 'text', value: 'El nombre debe tener al menos 2 caracteres.' },
      emailRequiredError: { type: 'text', value: 'Por favor ingrese su correo electrónico.' },
      emailInvalidError: { type: 'text', value: 'Ingrese un correo válido (ej. correo@empresa.com).' },
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
        value: 'Tu mensaje ha sido enviado correctamente. El equipo de Hidromont Chile te contactará a la brevedad.',
      },
      title: { type: 'text', value: 'Mensaje enviado correctamente' },
      subtitle: { type: 'textarea', value: 'Tu mensaje fue enviado correctamente. Te contactaremos a la brevedad.' },
      primaryLabel: { type: 'text', value: 'Volver al inicio' },
      secondaryLabel: { type: 'text', value: 'Ver nuestros proyectos' },
    },
  },
  {
    id: 'calidad.hero',
    kind: 'page',
    slug: '/calidad',
    locale: 'es-CL',
    title: 'Hero calidad',
    status: 'published',
    fields: {
      eyebrow: { type: 'text', value: 'Gestión de Calidad' },
      title: { type: 'text', value: 'Calidad y Medioambiente' },
      subtitle: {
        type: 'textarea',
        value:
          'La calidad como compromiso para cumplir las necesidades de nuestros clientes, fomentar la mejora continua y cumplir los requisitos legales y reglamentarios aplicables.',
      },
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
      brand: { type: 'text', value: 'Hidromont Chile S.A.' },
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
];
