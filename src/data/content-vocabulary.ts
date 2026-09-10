/**
 * A-7 — Vocabulario canónico de los campos de enumeración del contenido.
 *
 * Estaba duplicado en siete sitios y dos ya habían divergido:
 *   - El comentario de `requiredFieldTemplate` (cms/services/contentService.ts)
 *     listaba 6 iconos válidos; `ServiceCard.astro` define 8, y la base usa
 *     los 8. Validar copiando ese comentario habría bloqueado dos servicios
 *     publicados (infraestructuras y tanques-especiales).
 *   - `GET /api/cms/schema` devolvía 2 estados de entrada; el validador
 *     acepta 3, así que el overlay nunca podía ofrecer `pending_review`.
 *
 * Vive en `src/data/` y no bajo `cms/` por tres razones: es importable desde
 * los tres runtimes (Astro/Vite, el tsx/Node del CMS y vitest en ambas
 * suites); `src/data/` ya es el hogar de las constantes puras compartidas
 * (categories, nav, company); y la dirección de dependencia es la correcta —
 * el vocabulario es del sitio y el CMS lo consume. Ponerlo bajo `cms/` metería
 * ese árbol en el grafo de Vite del build de producción, que es justo lo que
 * la puerta del build intenta mantener separado.
 */

export const CATEGORIA_PROYECTO = [
  'tuberias',
  'compuertas',
  'electromecanicos',
  'limpiarrejas',
  'estructuras',
] as const;

export const TIPO_PROYECTO = ['destacado', 'banco'] as const;

/** Debe coincidir con las claves del mapa `icons` de ServiceCard.astro. */
export const ICONO_SERVICIO = [
  'pipe',
  'gate',
  'valve',
  'turbine',
  'rack',
  'crane',
  'infrastructure',
  'tank',
] as const;

export const ENTRY_KINDS = [
  'page',
  'layout',
  'component',
  'settings',
  'servicio',
  'proyecto',
] as const;

/**
 * B-8: aquí había un tercer estado, `pending_review`, que el validador
 * aceptaba y el desplegable del panel nunca ofrecía. Se retira en vez de
 * exponerlo, porque exponerlo habría sido una trampa: el export filtra por
 * `status === 'published'`, así que `pending_review` hace exactamente lo mismo
 * que `draft` —despublicar, con los dos efectos que describe DRAFT_EFFECT— pero
 * bajo un nombre que promete que alguien lo revisará. No hay a quién: una sola
 * cuenta de administración y ninguna cola de revisión. Cero entradas lo usaban.
 *
 * Si algún día se construye un flujo de revisión de verdad, el estado vuelve
 * aquí junto con el filtro del export y la interfaz que lo gestione.
 */
export const ENTRY_STATUSES = ['draft', 'published'] as const;

export const FIELD_TYPES = [
  'text',
  'textarea',
  'richtext',
  'image',
  'link',
  'number',
  'list',
  'object',
] as const;

export type CategoriaProyecto = (typeof CATEGORIA_PROYECTO)[number];
export type TipoProyecto = (typeof TIPO_PROYECTO)[number];
export type IconoServicio = (typeof ICONO_SERVICIO)[number];

/**
 * ESTRUCT-3: etiquetas del enum FIJO `categoria` (tipo de trabajo de
 * ingeniería). Las categorías de la galería son un vocabulario aparte e
 * intencionalmente distinto: se gestionan en runtime desde el CMS, mientras
 * que este es un enum de compilación validado por Zod. No deben unificarse:
 * clasifican dimensiones distintas y una es editable sin build, la otra no.
 */
export const CATEGORIA_PROYECTO_LABEL: Record<CategoriaProyecto, string> = {
  compuertas: 'Compuertas y Válvulas',
  estructuras: 'Estructuras y Tanques',
  limpiarrejas: 'Limpiarrejas',
  electromecanicos: 'Montajes Especiales',
  tuberias: 'Tuberías y Blindajes',
};

/**
 * A-7: `tipo` decide si un proyecto tiene ficha propia o solo aparece en la
 * tabla (ver getStaticPaths de proyectos/[slug].astro). Eso no estaba escrito
 * en ninguna parte de la interfaz, así que la etiqueta lo dice.
 */
export const TIPO_PROYECTO_LABEL: Record<TipoProyecto, string> = {
  destacado: 'Destacado — tiene página propia',
  banco: 'Banco — solo aparece en la tabla de proyectos',
};

/**
 * Campos de enumeración por tipo de entrada. Es la tabla que consumen el
 * validador del servidor, el gate del export y el `<select>` del overlay,
 * para que los tres hablen del mismo vocabulario.
 */
export const ENUM_FIELDS: Record<string, Record<string, readonly string[]>> = {
  proyecto: { categoria: CATEGORIA_PROYECTO, tipo: TIPO_PROYECTO },
  servicio: { icono: ICONO_SERVICIO },
};

/** Etiquetas legibles por campo, para el desplegable. */
/**
 * E-3: el desplegable de icono ofrecía los valores crudos (`gate`, `rack`,
 * `crane`), que solo significan algo para quien ha visto los SVG. Los rótulos
 * describen el dibujo, y entre paréntesis va el servicio que hoy lo usa, que es
 * la pista más rápida para reconocerlo.
 */
export const ICONO_SERVICIO_LABEL: Record<string, string> = {
  pipe: 'Tubería (tuberías forzadas)',
  gate: 'Compuerta (compuertas)',
  valve: 'Válvula (válvulas)',
  turbine: 'Turbina (turbinas)',
  rack: 'Reja (limpiarrejas)',
  crane: 'Grúa (otros montajes)',
  infrastructure: 'Infraestructura (infraestructuras)',
  tank: 'Tanque (tanques especiales)',
};

export const ENUM_FIELD_LABELS: Record<string, Record<string, Record<string, string>>> = {
  proyecto: { categoria: CATEGORIA_PROYECTO_LABEL, tipo: TIPO_PROYECTO_LABEL },
  servicio: { icono: ICONO_SERVICIO_LABEL },
};

/** Tipos de entrada que se materializan en un archivo .md por slug. */
export const COLLECTION_KINDS = ['servicio', 'proyecto'] as const;
/** Tipos cuyo contenido va a cms-content.json y cae al fallback del código. */
export const PAGE_KINDS = ['page', 'layout', 'component', 'settings'] as const;

/**
 * A-9: «Borrador» significa dos cosas opuestas según el tipo de entrada, y el
 * desplegable del overlay era el mismo en ambos casos.
 *
 * En los tipos de página, quedar fuera de cms-content.json hace que
 * `getCmsText` caiga al tercer argumento: el texto escrito en el código. Es
 * decir, despublicar NO oculta, revierte — y revierte todos los campos de la
 * entrada, incluidos los que nadie tocó.
 *
 * En las colecciones, el .md se borra y la URL deja de existir.
 */
export const DRAFT_EFFECT = {
  page: {
    label: 'Borrador — el sitio vuelve al texto por defecto del código',
    warning:
      'Poner esta entrada en Borrador no oculta nada: la página vuelve a mostrar el texto escrito en el código, y eso afecta a TODOS los campos de la entrada, no solo al que editaste. Para borrar un texto de verdad, vacía ese campo y deja la entrada en Publicado.',
  },
  collection: {
    label: 'Borrador — la página deja de existir (su URL dará 404)',
    warning:
      'Poner esta entrada en Borrador borra su archivo de contenido en la próxima exportación: su página y su URL dejarán de existir en el sitio.',
  },
} as const;

/** Grupo al que pertenece un tipo de entrada, para elegir el efecto correcto. */
export function draftGroupForKind(kind: string): 'page' | 'collection' {
  return (COLLECTION_KINDS as readonly string[]).includes(kind) ? 'collection' : 'page';
}
