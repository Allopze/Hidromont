import type { AuditedValueRule } from './auditedMigration';

/**
 * Correcciones de copy derivadas de la auditoría de septiembre de 2026.
 *
 * Cada regla verifica el valor previo (`from`) antes de escribir: si la base ya
 * no dice lo que esperábamos, la tanda aborta en vez de pisar una edición hecha
 * desde el panel. Ver `cms/scripts/apply-copy-fixes.ts`.
 *
 * `batch` agrupa las reglas para poder aplicarlas y revisarlas por partes
 * (`--batch=reconciliacion`), porque un diff de 73 textos no lo revisa nadie.
 */
export interface CopyFixRule extends AuditedValueRule {
  batch: string;
  /** Por qué cambia este texto. Sin esto, en seis meses alguien lo revierte. */
  nota: string;
}

export const copyFixRules: CopyFixRule[] = [
  // ── Tanda 0 · reconciliación ────────────────────────────────────────────
  // Estos seis textos ya se corrigieron en los archivos del repo, pero la base
  // —que es la fuente de verdad— seguía con la versión vieja. Sin esta tanda,
  // el próximo `cms:export` los revertía en silencio.
  {
    batch: 'reconciliacion',
    entryId: 'home.hero',
    key: 'subtitle',
    from: 'Tuberías forzadas, blindajes, compuertas, válvulas, turbinas y limpiarrejas para embalses y centrales hidroeléctricas. En España desde 1983 y en Chile desde 1997, con taller en Los Ángeles.',
    to: 'Tuberías forzadas, blindajes, compuertas, válvulas, turbinas y limpiarrejas para embalses y centrales hidroeléctricas. En España desde 1983 y en Chile desde 1997, con taller en Los Ángeles, Región del Biobío.',
    nota: 'Sin la región, «Los Ángeles» se lee como California — y esto es la meta description de la portada.',
  },
  {
    batch: 'reconciliacion',
    entryId: 'empresa.cta',
    key: 'subtitle',
    from: 'Cuéntenos el alcance de su obra y revisamos qué parte podemos ejecutar en el taller de Los Ángeles y qué parte en terreno.',
    to: 'Cuéntenos el alcance de su obra y revisamos qué podemos fabricar y montar nosotros.',
    nota: 'El reparto interno de trabajo no le importa al cliente; leído desde fuera sonaba a limitación.',
  },
  {
    batch: 'reconciliacion',
    entryId: 'empresa.instalaciones',
    key: 'title',
    from: 'El taller de Los Ángeles',
    to: 'El taller',
    nota: 'El artículo determinado más el topónimo presuponía que el lector ya sabe cuál taller es.',
  },
  {
    batch: 'reconciliacion',
    entryId: 'servicios.index.banner',
    key: 'subtitle',
    from: 'En Los Ángeles contamos con terreno para acopio y premontaje, además de talleres de calderería, mecanizado y pintura industrial.',
    to: 'Contamos con terreno para acopio y premontaje, además de taller de calderería, mecanizado y pintura industrial.',
    nota: 'Contradecía a /empresa, que dice que todo ocurre en la misma nave. Singular, y sin el topónimo de más.',
  },
  {
    batch: 'reconciliacion',
    entryId: 'servicios.tanques-especiales',
    key: 'body',
    mode: 'substring',
    from: 'En el taller de Los Ángeles se ejecutan el rolado',
    to: 'En el taller se ejecutan el rolado',
    nota: 'La ficha abría con geografía interna en vez del proceso.',
  },
  {
    batch: 'reconciliacion',
    entryId: 'servicios.tuberias-forzadas',
    key: 'body',
    mode: 'substring',
    from: 'Nuestro taller en Los Ángeles, Región del Biobío, cuenta con equipamiento',
    to: 'Nuestro taller cuenta con equipamiento',
    nota: 'La ubicación ya está dicha en la portada y en /empresa; aquí solo estorbaba el ritmo.',
  },
  {
    batch: 'reconciliacion',
    entryId: 'contact.form',
    key: 'subject',
    from: 'Nuevo contacto desde hidromont.cl',
    to: 'Nuevo contacto desde hidromontchile.cl',
    nota: 'bded6cc lo corrigió solo en cms-content.json: la base seguía con hidromont.cl, que no es este sitio, y el siguiente export lo revertía.',
  },
  // ── Tanda auditoria-2026-10 · texto público ─────────────────────────────
  // Revisión ortográfica y de coherencia antes de abrir el sitio al público
  // (2026-10-04). Los valores `from` se tomaron de la base del VPS, que
  // coincidía con la local.
  {
    batch: 'auditoria-2026-10',
    entryId: 'proyectos.index.hero',
    key: 'seoDescription',
    from: 'Banco de proyectos de Hidromont Chile — más de 80 proyectos ejecutados en Chile y el extranjero para centrales hidroeléctricas, embalses y presas.',
    to: 'Banco de proyectos de Hidromont Chile: centrales hidroeléctricas, embalses y presas en Chile y el extranjero, con tuberías forzadas, compuertas, válvulas y turbinas.',
    nota: '«Más de 80 proyectos» no se sostenía: el banco lista unos 39. Sin cifra, la description no promete lo que la página no muestra.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'empresa.hero',
    key: 'seoDescription',
    from: 'Hidromont Chile — Especialistas en ingeniería hidromecánica desde 1983. Sede en Los Ángeles, Biobío, con instalaciones propias y equipo técnico especializado.',
    to: 'Hidromont Chile: ingeniería hidromecánica desde 1983, con taller propio y equipo técnico especializado en Los Ángeles, Región del Biobío.',
    nota: 'Pasaba de 155 caracteres y Google la mostraba cortada con «…».',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'page.galeria',
    key: 'noResults',
    from: 'No se encontraron fotos coincidentes con tu búsqueda.',
    to: 'No se encontraron fotos coincidentes con su búsqueda.',
    nota: 'El resto del sitio trata de usted.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'servicios.index.banner',
    key: 'imageAlt',
    from: 'Proceso de fabricacion y caldereria hidromecanica en taller',
    to: 'Proceso de fabricación y calderería hidromecánica en taller',
    nota: 'Faltaban tres tildes.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'empresa.hero',
    key: 'imageAlt',
    from: 'Nave del taller industrial de Hidromont con grúa pórtico de 20 toneladas',
    to: 'Nave del taller industrial de Hidromont con puente grúa de 20 toneladas',
    nota: 'El resto del sitio (galería, estadística de /servicios) habla de puentes grúa; «grúa pórtico» es otra máquina.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'empresa.mediosdeobra',
    key: 'item3',
    from: 'Vehículos Pick-Up 4×4 para acceso a terreno',
    to: 'Camionetas 4×4 para acceso a terreno',
    nota: '«Pick-Up» con mayúsculas era un anglicismo; en Chile se dice camioneta.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'servicios.compuertas',
    key: 'procesos',
    from: [
      {
        titulo: 'Ingeniería',
        descripcion:
          'Diseño 3D en CAD, análisis de tensión y deformación por elementos finitos según las cargas y dimensiones del conducto.',
      },
      {
        titulo: 'Fabricación',
        descripcion:
          'Fabricación en taller con control de calidad, pre-montaje y pruebas funcionales antes del despacho.',
      },
      {
        titulo: 'Montaje',
        descripcion:
          'Instalación en obra con procedimientos específicos, alineación y pruebas hidráulicas.',
      },
      {
        titulo: 'Mantenimiento',
        descripcion:
          'Inspección, limpieza, sustitución de juntas de estanqueidad y sistemas de accionamiento, revisión de partes fijas e informes de estado.',
      },
    ],
    to: [
      {
        titulo: 'Ingeniería',
        descripcion:
          'Diseño 3D en CAD, análisis de tensión y deformación por elementos finitos según las cargas y dimensiones del conducto.',
      },
      {
        titulo: 'Fabricación',
        descripcion:
          'Fabricación en taller con control de calidad, premontaje y pruebas funcionales antes del despacho.',
      },
      {
        titulo: 'Montaje',
        descripcion:
          'Instalación en obra con procedimientos específicos, alineación y pruebas hidráulicas.',
      },
      {
        titulo: 'Mantenimiento',
        descripcion:
          'Inspección, limpieza, sustitución de juntas de estanqueidad y sistemas de accionamiento, revisión de partes fijas e informes de estado.',
      },
    ],
    nota: '«premontaje» va sin guion (RAE), como en el resto del sitio.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'proyectos.ch-doiras',
    key: 'alcance',
    mode: 'substring',
    from: 'pre-montaje en taller',
    to: 'premontaje en taller',
    nota: '«premontaje» va sin guion (RAE), como en el resto del sitio.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'proyectos.ch-doiras',
    key: 'body',
    from: 'En C.H. Doiras el alcance se dividió entre el blindaje de la conducción y las\nválvulas de guarda de la instalación.\n\n## Alcance del proyecto\n\n- **Ingeniería:** diseño previo del blindaje y análisis tensional de la trifurcación por elementos finitos.\n- **Blindaje:** trifurcación Ø 4.000 a Ø 2.600, con pre-montaje en taller para verificar dimensiones.\n- **Montaje:** instalación de la tubería Ø 2.600 en obra.\n- **Válvulas:** montaje de 3 válvulas mariposa DN 2700 PN 10.\n\nLa trifurcación se verificó mediante análisis tensional y pre-montaje dimensional\nen taller antes del traslado a obra.',
    to: 'En C.H. Doiras el alcance se dividió entre el blindaje de la conducción y las\nválvulas de guarda de la instalación.\n\n## Alcance del proyecto\n\n- **Ingeniería:** diseño previo del blindaje y análisis tensional de la trifurcación por elementos finitos.\n- **Blindaje:** trifurcación Ø 4.000 a Ø 2.600, con premontaje en taller para verificar dimensiones.\n- **Montaje:** instalación de la tubería Ø 2.600 en obra.\n- **Válvulas:** montaje de 3 válvulas mariposa DN 2700 PN 10.\n\nLa trifurcación se verificó mediante análisis tensional y premontaje dimensional\nen taller antes del traslado a obra.',
    nota: '«premontaje» va sin guion (RAE), como en el resto del sitio. Valor completo: aparece dos veces.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'servicios.otros-montajes',
    key: 'aplicaciones',
    from: [
      'Centrales hidroeléctricas',
      'Plantas industriales y de celulosa',
      'Obras de conducción',
      'Infraestructura de embalses',
      'Reparaciones post-siniestro',
    ],
    to: [
      'Centrales hidroeléctricas',
      'Plantas industriales y de celulosa',
      'Obras de conducción',
      'Infraestructura de embalses',
      'Reparaciones tras siniestros',
    ],
    nota: '«post-siniestro» no lleva guion; «tras siniestros» se entiende mejor.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'servicios.infraestructuras',
    key: 'aplicaciones',
    from: [
      'Obras viales y de mejoramiento de rutas',
      'Canales de riego y conducción',
      'Infraestructura de embalses',
      'Obras públicas MOP / DOH',
      'Reparaciones post-siniestro',
    ],
    to: [
      'Obras viales y de mejoramiento de rutas',
      'Canales de riego y conducción',
      'Infraestructura de embalses',
      'Obras públicas MOP / DOH',
      'Reparaciones tras siniestros',
    ],
    nota: '«post-siniestro» no lleva guion; «tras siniestros» se entiende mejor.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'proyectos.ruta-nahuelbuta-pasarelas',
    key: 'body',
    mode: 'substring',
    from: 'a partir de una altura de 1.40 m',
    to: 'a partir de una altura de 1,40 m',
    nota: 'En Chile el decimal va con coma.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'servicios.valvulas',
    key: 'normas',
    from: [
      'Pliego General de Obras Hidráulicas (P.G.O.H.)',
      'DIN 19705-1',
      'Criterios de diseño USBR',
      'Recomendaciones C.E.C.T.',
      'Materiales según ASME',
      'Directiva de Equipos a Presión 2014/68/EU (PED)',
    ],
    to: [
      'Pliego General de Obras Hidráulicas (P.G.O.H.)',
      'DIN 19705-1',
      'Criterios de diseño USBR',
      'Recomendaciones C.E.C.T.',
      'Materiales según ASME',
      'Directiva de Equipos a Presión 2014/68/UE (PED)',
    ],
    nota: 'En español la sigla de la Unión Europea es UE.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'proyectos.ch-pangal',
    key: 'alcance',
    mode: 'substring',
    from: 'para la reparación del culvert.',
    to: 'para la reparación de la alcantarilla (culvert).',
    nota: 'Palabra en inglés sin explicar; se conserva entre paréntesis porque es el término de obra.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'proyectos.embalse-convento-viejo',
    key: 'cliente',
    from: 'Constructora Nilahue (Besalco - BCF)',
    to: 'Constructora Nilahue (Besalco–BCF)',
    nota: 'Los consorcios van con raya sin espacios, como «Dragados–Besalco».',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'proyectos.embalse-el-bato',
    key: 'cliente',
    from: 'Besalco - Ferrovial',
    to: 'Besalco–Ferrovial',
    nota: 'Los consorcios van con raya sin espacios, como «Dragados–Besalco».',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'galeria:gal_coyhaique_1',
    key: 'alt',
    from: 'Tanque de almacenamiento de GLP de 150 metros cúbicos en taller',
    to: 'Tanque de almacenamiento de GLP de 30.000 galones en taller',
    nota: 'Dato confirmado por Hidromont (2026-10-04): son tanques de 30.000 galones, como dice la foto de la ficha.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'galeria:gal_coyhaique_1',
    key: 'title',
    from: 'Tanque de almacenamiento de GLP de 150 metros cúbicos en taller',
    to: 'Tanque de almacenamiento de GLP de 30.000 galones en taller',
    nota: 'Dato confirmado por Hidromont (2026-10-04): son tanques de 30.000 galones, como dice la foto de la ficha.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'project-image.tanques-glp-coyhaique',
    key: 'imageAlt',
    from: 'Tanque de GLP 30.000 galones en fabricación en taller',
    to: 'Tanque de GLP de 30.000 galones en fabricación en taller',
    nota: 'Faltaba la preposición.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'project-gallery.ch-queltehues',
    key: 'gallery1',
    from: '/fotos/proyectos/ch-queltehues/20160324_114353.webp',
    to: '',
    nota: 'Las fotos de la ficha eran de una compuerta en un canal; la obra es una tubería forzada. Pedido de Hidromont (2026-10-04). La única foto de la faena que no es la compuerta pasa a ser la portada, así que la galería de la ficha queda vacía y no se pinta.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'project-gallery.ch-queltehues',
    key: 'gallery1Alt',
    from: 'Armado de una compuerta plana de gran tamaño dentro del canal de hormigón, con sus vigas y planchas apuntaladas',
    to: '',
    nota: 'Acompaña a la retirada de gallery1.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'project-gallery.ch-queltehues',
    key: 'gallery2',
    from: '/fotos/proyectos/ch-queltehues/20160329_164852.webp',
    to: '',
    nota: 'Foto de la compuerta, no de la tubería: se quita. Un hueco vacío no se pinta en el sitio público.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'project-gallery.ch-queltehues',
    key: 'gallery2Alt',
    from: 'Vista cenital del tablero de la compuerta con soldadores trabajando sobre la viga principal',
    to: '',
    nota: 'Acompaña a la retirada de gallery2.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'project-gallery.ch-queltehues',
    key: 'gallery3',
    from: '/fotos/proyectos/ch-queltehues/IMG_20161206_113612.webp',
    to: '',
    nota: 'Foto de la compuerta, no de la tubería: se quita. Un hueco vacío no se pinta en el sitio público.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'project-gallery.ch-queltehues',
    key: 'gallery3Alt',
    from: 'El canal ya con agua, con la compuerta y su pasarela de rejilla instaladas en la desembocadura',
    to: '',
    nota: 'Acompaña a la retirada de gallery3.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'project-image.ch-queltehues',
    key: 'image',
    from: '/fotos/curadas/tuberia-terreno-queltehues.webp',
    to: '/fotos/proyectos/ch-queltehues/20160323_144441.webp',
    nota: 'La portada (tubería entre bosques) no se parecía al Cajón del Maipo y solo el nombre del archivo la atribuía a Queltehues. Pedido de Hidromont (2026-10-04): se usa la foto de la faena.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'project-image.ch-queltehues',
    key: 'imageAlt',
    from: 'Instalación de tubería en terreno',
    to: 'Grúa telescópica y cuadrilla en la explanada de obra de C.H. Queltehues, en plena cordillera',
    nota: 'Acompaña al cambio de portada.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'project-image.ch-queltehues',
    key: 'imageWidth',
    from: 605,
    to: 1600,
    nota: 'Medidas reales de la foto nueva.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'project-image.ch-queltehues',
    key: 'imageHeight',
    from: 310,
    to: 900,
    nota: 'Medidas reales de la foto nueva.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'galeria:gal_ch-queltehues_2',
    key: 'projectSlug',
    from: 'ch-queltehues',
    to: null,
    nota: 'Foto de una compuerta en un canal, no de la tubería de Queltehues. Pedido de Hidromont (2026-10-04): sale del álbum y sigue en /galeria bajo Infraestructuras.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'galeria:gal_ch-queltehues_3',
    key: 'projectSlug',
    from: 'ch-queltehues',
    to: null,
    nota: 'Foto de una compuerta en un canal, no de la tubería de Queltehues. Pedido de Hidromont (2026-10-04): sale del álbum y sigue en /galeria bajo Infraestructuras.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'galeria:gal_ch-queltehues_4',
    key: 'projectSlug',
    from: 'ch-queltehues',
    to: null,
    nota: 'Foto de una compuerta en un canal, no de la tubería de Queltehues. Pedido de Hidromont (2026-10-04): sale del álbum y sigue en /galeria bajo Infraestructuras.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'galeria:gal_ch-queltehues_5',
    key: 'projectSlug',
    from: 'ch-queltehues',
    to: null,
    nota: 'Foto de una compuerta en un canal, no de la tubería de Queltehues. Pedido de Hidromont (2026-10-04): sale del álbum y sigue en /galeria bajo Infraestructuras.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'galeria:gal_ch-queltehues_6',
    key: 'projectSlug',
    from: 'ch-queltehues',
    to: null,
    nota: 'Foto de una compuerta en un canal, no de la tubería de Queltehues. Pedido de Hidromont (2026-10-04): sale del álbum y sigue en /galeria bajo Infraestructuras.',
  },
  {
    batch: 'auditoria-2026-10',
    entryId: 'galeria:gal_ch-queltehues_8',
    key: 'projectSlug',
    from: 'ch-queltehues',
    to: null,
    nota: 'Foto de una compuerta en un canal, no de la tubería de Queltehues. Pedido de Hidromont (2026-10-04): sale del álbum y sigue en /galeria bajo Infraestructuras.',
  },
];
