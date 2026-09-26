import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/unifiedConfig';
import type { ContentRepository } from '../repositories/ContentRepository';
import type { SlugRepository } from '../repositories/SlugRepository';
import type { CmsEntry, CmsField } from '../types/cms';
import { getInitialEntries } from './contentSeed';
import { CATEGORIA_PROYECTO, ICONO_SERVICIO } from '../../src/data/content-vocabulary';

type SeedField = { type: string; value: unknown };

/**
 * Campos mínimos que exige el schema Zod de cada colección de Astro
 * (`src/content/config.ts`). Sin ellos, al exportar un `.md` `astro check`
 * falla con un error críptico para el editor (CMS-003). Se inyectan al crear
 * la entrada para que el archivo exportado sea siempre válido; el editor luego
 * reemplaza estos marcadores por contenido real desde el overlay.
 */
function requiredFieldTemplate(kind: string, title: string): Record<string, SeedField> {
  // P1-02 (auditoría 2026-09): la plantilla traía solo lo obligatorio del
  // schema y el formulario solo pinta claves que existen, así que un proyecto
  // nuevo no admitía cliente, diámetro ni normas (400 al guardarlos). Ahora
  // nace con todos los campos editables del tipo, vacíos, y sin textos de
  // relleno que acabarían publicados («Contenido pendiente de completar.»).
  // Los vacíos opcionales no llegan al .md (ver exportCollection).
  if (kind === 'servicio') {
    return {
      titulo: { type: 'text', value: title },
      resumen: { type: 'textarea', value: '' },
      // A-7: el vocabulario válido está en src/data/content-vocabulary.ts.
      icono: { type: 'text', value: ICONO_SERVICIO[0] },
      tipos: { type: 'list', value: [] },
      aplicaciones: { type: 'list', value: [] },
      normas: { type: 'list', value: [] },
      orden: { type: 'number', value: 100 },
      body: { type: 'richtext', value: '' },
    };
  }
  if (kind === 'proyecto') {
    return {
      nombre: { type: 'text', value: title },
      alcance: { type: 'textarea', value: '' },
      // A-7: vocabulario en src/data/content-vocabulary.ts.
      categoria: { type: 'text', value: CATEGORIA_PROYECTO[0] },
      tipo: { type: 'text', value: 'banco' },
      servicio: { type: 'text', value: '' },
      cliente: { type: 'text', value: '' },
      mandante: { type: 'text', value: '' },
      contratista: { type: 'text', value: '' },
      ubicacion: { type: 'text', value: '' },
      diametro: { type: 'text', value: '' },
      longitud: { type: 'text', value: '' },
      peso: { type: 'text', value: '' },
      acero: { type: 'text', value: '' },
      normas: { type: 'list', value: [] },
      orden: { type: 'number', value: 100 },
      body: { type: 'richtext', value: '' },
    };
  }
  return {};
}

/**
 * P1-04 (auditoría 2026-09): la API admitía `/` y `.` en el slug de una ficha
 * de colección. Con «tanques/316l» el build fallaba («Missing parameter:
 * slug») y con «tanques.glp» la página salía en otra URL de la que mostraba el
 * panel. Las rutas del sitio son `/proyectos/<slug>`: un solo segmento.
 */
const SLUG_DE_COLECCION = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function validarSlugDeColeccion(slug: string): void {
  if (!SLUG_DE_COLECCION.test(slug)) {
    throw new Error(
      `Dirección inválida: «${slug}». Usa solo letras minúsculas, números y guiones (sin espacios, barras ni puntos).`
    );
  }
}

const COLECCION = { servicio: 'servicios', proyecto: 'proyectos' } as const;
type KindColeccion = keyof typeof COLECCION;
const esColeccion = (kind: string): kind is KindColeccion => kind in COLECCION;

/** El id que las plantillas del sitio construyen para una ficha: `proyectos.<slug>`. */
export function collectionEntryId(kind: KindColeccion, slug: string): string {
  return `${COLECCION[kind]}.${slug}`;
}

/**
 * Fichas compañeras de una ficha de colección: su foto de cabecera y su
 * galería de 3 huecos. El sitio las busca por slug (`project-image.<slug>`).
 * P1-02: solo existían para los 10 proyectos y 8 servicios sembrados, así que
 * una ficha nueva o renombrada no admitía foto ni galería.
 */
export function companionEntries(kind: KindColeccion, slug: string, title: string) {
  const [imagen, galeria, rotulo] =
    kind === 'proyecto'
      ? ['project-image', 'project-gallery', 'proyecto']
      : ['service-image', 'service-gallery', 'servicio'];
  const campo = (key: string, type: CmsField['type']) => ({ key, type, value: '' });
  return [
    {
      id: `${imagen}.${slug}`,
      kind: 'settings',
      slug: `${imagen}/${slug}`,
      title: `Imagen ${rotulo} ${title}`,
      fields: [
        campo('image', 'image'),
        campo('imageAlt', 'text'),
        campo('video', 'video'),
        campo('videoAlt', 'text'),
      ],
    },
    {
      id: `${galeria}.${slug}`,
      kind: 'settings',
      slug: `${galeria}/${slug}`,
      title: `Galería ${rotulo} ${slug}`,
      fields: [1, 2, 3].flatMap((n) => [
        campo(`gallery${n}`, 'image'),
        campo(`gallery${n}Alt`, 'text'),
      ]),
    },
  ];
}

/**
 * Entradas que ninguna página del sitio lee.
 *
 * `importMissingEntries` solo añade: quitar una entrada de la semilla no la
 * borra de una base viva. Así quedaron en el panel fichas que se podían editar
 * y guardar sin que el sitio cambiara nada, que para quien no sabe de dónde
 * sale cada texto es indistinguible de un error:
 *
 * - `calidad.*`: la página de calidad se retiró en A2-002 y sus cinco fichas
 *   siguieron en la base.
 * - `contacto.hero`: «Conversemos». /contacto dejó de pintar su cabecera en
 *   ffa7674 y la ficha siguió sembrándose.
 * - `galeria.hero`, `galeria.config`: restos de una importación antigua; la
 *   galería lee `page.galeria` y sus textos de filtro están en el código.
 *
 * Solo se retiran por su id exacto: nada que coincida por prefijo o parecido.
 */
export const ENTRADAS_RETIRADAS = [
  'calidad.hero',
  'calidad.contenido',
  'calidad.badge',
  'calidad.principios',
  'calidad.cta',
  'contacto.hero',
  'galeria.hero',
  'galeria.config',
  // P3-08 (auditoría 2026-09): borrador con 90 rutas que no existen; ninguna
  // página la lee y cada publicación avisaba «vuelve al texto por defecto».
  'galeria.items',
] as const;

/**
 * Campos sueltos que ninguna página lee, dentro de fichas que sí se usan.
 * Se comprobó con un build completo registrando cada lectura del CMS
 * (25-09-2026), y leyendo el código en los que se leen sin mostrarse
 * (`company.ts` leía todos sus datos al cargarse, se usaran o no).
 *
 * `prefijo` retira el campo en todas las fichas de una familia generada por
 * slug (una galería por servicio o por proyecto); el resto, por id exacto.
 */
export const CAMPOS_RETIRADOS: ReadonlyArray<{
  entrada?: string;
  prefijo?: string;
  campos: readonly string[];
}> = [
  // PageHero dejó de pintar el texto pequeño sobre el título de las páginas
  // interiores; su prop `eyebrow` quedó solo por compatibilidad.
  { entrada: 'empresa.hero', campos: ['eyebrow'] },
  { entrada: 'servicios.index.hero', campos: ['eyebrow'] },
  { entrada: 'proyectos.index.hero', campos: ['eyebrow'] },
  { entrada: 'clientes.hero', campos: ['eyebrow'] },
  { entrada: 'page.galeria', campos: ['eyebrow'] },
  // CTASection no tiene texto sobre el título.
  { entrada: 'home.cta', campos: ['eyebrow'] },
  // Títulos quitados por petición expresa del dueño (ver clientes.astro y
  // ClientsStrip.astro): si siguen en el panel, invitan a escribirlos.
  { entrada: 'clients.strip', campos: ['title'] },
  { entrada: 'clientes.sectores', campos: ['title'] },
  // Nadie los lee.
  { entrada: 'contact.form', campos: ['fromName'] },
  // P2-12: las opciones del formulario salen de las fichas de servicio.
  { entrada: 'contact.form', campos: ['services'] },
  { entrada: 'contact.info', campos: ['note'] },
  { entrada: 'contacto.sections', campos: ['infoTitle'] },
  // /empresa pinta tres tarjetas.
  { entrada: 'empresa.metricas', campos: ['card4Label', 'card4Value', 'card4Desc'] },
  // La página de calidad no existe (A2-002) y la cabecera usa el logo.
  {
    entrada: 'layout.header',
    campos: ['navCalidad', 'hrefCalidad', 'wordmarkPrimary', 'wordmarkSub'],
  },
  // Ninguna página los muestra.
  {
    entrada: 'site.company',
    campos: [
      'casillaPostal',
      'fundacion',
      'chileDesde',
      'descripcionLarga',
      'especialidad',
      'modalidad',
    ],
  },
  // Restos de cuando las galerías eran una lista: hoy son gallery1..3.
  { prefijo: 'project-gallery.', campos: ['images'] },
  { prefijo: 'service-gallery.', campos: ['images'] },
  // Logos de clientes que ya no están en la lista (o duplicados de uno que
  // sí está con otro nombre): ninguna página los pide.
  {
    entrada: 'clientes.logos',
    campos: [
      'logo-dragado',
      'logo-engie',
      'logo-fcc',
      'logo-gas-natural-fenosa',
      'logo-mop-doh',
      'logo-naturener',
      'logo-navarro-sic',
      'logo-norvento',
      'logo-plenium-partners',
      'logo-viesgo',
    ],
  },
];

/** `clientes.logos.logo-<nombre-en-minúsculas-con-guiones>`, como lo pide cliente-logos.ts. */
export function esLogoDeCliente(entryId: string, key: string): boolean {
  return entryId === 'clientes.logos' && /^logo-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key);
}

/**
 * Campos que no existen hasta que alguien los usa, y que por eso se crean al
 * guardarlos: el logo de un cliente recién añadido a la lista y el icono propio
 * de un servicio (sus fichas vienen de un .md que no lo declara). Devuelve el
 * tipo con que se crea, o null si esa clave inexistente es un error.
 */
export function campoQueSeCreaAlGuardar(
  entry: Pick<CmsEntry, 'id' | 'kind'>,
  key: string
): 'image' | null {
  if (esLogoDeCliente(entry.id, key)) return 'image';
  if (entry.kind === 'servicio' && key === 'iconoPropio') return 'image';
  return null;
}

export class ContentService {
  /**
   * @param rootDir raíz del repo donde vive `src/content`. Configurable por el
   *   mismo motivo que en ExportService: sin esto, un test que borre una
   *   entrada de tipo servicio/proyecto elimina un .md real del repositorio,
   *   porque `deleteEntry` resuelve la ruta contra config.rootDir.
   */
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly rootDir: string = config.rootDir,
    private readonly slugRepository?: SlugRepository
  ) {}

  /**
   * P1-02 (auditoría 2026-09): el sitio construye el id de una ficha como
   * `proyectos.<slug>`, pero el panel creaba `proyecto.<slug>`, y editarla en
   * su página daba 404 (que además se mostraba como la pantalla de acceso).
   * Si el id pedido no existe y tiene esa forma, se resuelve por slug: así
   * funcionan también las fichas ya creadas en singular.
   */
  resolveEntryId(id: string): string {
    if (this.contentRepository.findEntry(id)) return id;
    // También en singular: así se escribieron las fichas creadas en el panel.
    const m = /^(servicios?|proyectos?)\.(.+)$/.exec(id);
    if (!m) return id;
    const kind = m[1].startsWith('servicio') ? 'servicio' : 'proyecto';
    return this.contentRepository.findCollectionEntryBySlug(kind, m[2], 'es-CL')?.id ?? id;
  }

  /** Crea las fichas compañeras que falten para cada ficha de colección. */
  ensureCompanions(): number {
    const now = new Date().toISOString();
    let creadas = 0;
    for (const kind of Object.keys(COLECCION) as KindColeccion[]) {
      for (const entry of this.contentRepository.listEntries(kind, 10_000).entries) {
        for (const c of companionEntries(kind, entry.slug, entry.title)) {
          if (this.contentRepository.insertEntryIfMissing({ ...c, status: 'published', now })) {
            creadas++;
          }
        }
      }
    }
    return creadas;
  }

  getEntryIfExists(id: string): CmsEntry | undefined {
    return this.contentRepository.findEntry(this.resolveEntryId(id));
  }

  projectsReferencingService(slug: string) {
    return this.contentRepository.projectsReferencingService(slug);
  }

  /** Slugs de servicio existentes, para validar y ofrecer el campo `servicio`. */
  serviceOptions(): Array<{ value: string; label: string }> {
    return this.contentRepository
      .listServiceSlugs()
      .map((s) => ({ value: s.slug, label: s.title }));
  }

  importInitialContent(): { imported: number } {
    const now = new Date().toISOString();
    const entries = getInitialEntries(this.rootDir);

    for (const entry of entries) {
      this.contentRepository.upsertEntry({
        id: entry.id,
        kind: entry.kind,
        slug: entry.slug,
        locale: entry.locale,
        title: entry.title,
        status: entry.status,
        fields: Object.values(entry.fields),
        now,
      });
    }

    return { imported: entries.length };
  }

  /**
   * Importa lo que falte del seed sin pisar nada editado.
   *
   * Dos niveles, porque hasta ahora solo había uno: las ENTRADAS que no
   * existen se crean, y en las que ya existen se insertan los CAMPOS nuevos
   * (M-4). Sin lo segundo, añadir una clave al seed no llegaba jamás a una
   * base viva y el frontend se quedaba pidiendo algo que nadie podía editar.
   * `insertMissingFields` usa INSERT OR IGNORE, así que un campo ya editado
   * desde el panel no se toca.
   */
  importMissingEntries(): { inserted: number; fieldsInserted: number } {
    const now = new Date().toISOString();
    const entries = getInitialEntries(this.rootDir);
    let inserted = 0;
    let fieldsInserted = 0;
    // P1-03: un .md cuyo slug ya tuvo una ficha (borrada o renombrada) no es
    // contenido nuevo: es un resto, y reimportarlo resucitaba lo borrado.
    this.slugRepository?.backfill();
    const conocidos = {
      servicio: this.slugRepository?.allSlugs('servicio') ?? new Set<string>(),
      proyecto: this.slugRepository?.allSlugs('proyecto') ?? new Set<string>(),
    };

    for (const entry of entries) {
      if (
        esColeccion(entry.kind) &&
        conocidos[entry.kind].has(entry.slug) &&
        !this.contentRepository.findEntry(entry.id)
      ) {
        continue;
      }
      const created = this.contentRepository.insertEntryIfMissing({
        id: entry.id,
        kind: entry.kind,
        slug: entry.slug,
        locale: entry.locale,
        title: entry.title,
        status: entry.status,
        fields: Object.values(entry.fields),
        now,
      });
      if (created) {
        inserted++;
        continue;
      }
      fieldsInserted += this.contentRepository.insertMissingFields(
        entry.id,
        Object.values(entry.fields),
        now
      );
    }

    this.slugRepository?.backfill();
    return { inserted, fieldsInserted };
  }

  /**
   * Borra las entradas de `ENTRADAS_RETIRADAS` que sigan en la base.
   *
   * Devuelve el snapshot de cada una, con la misma forma que `deleteEntry`, para
   * que quien arranca el servidor lo deje en la auditoría: con él
   * `restoreDeletedEntry` la rehace si alguna vez hiciera falta. Idempotente:
   * en el segundo arranque ya no queda nada que retirar.
   */
  retireObsoleteEntries(): Array<{ entry: CmsEntry }> {
    const retiradas: Array<{ entry: CmsEntry }> = [];
    for (const id of ENTRADAS_RETIRADAS) {
      const entry = this.contentRepository.findEntry(id);
      // Ninguna es de colección, pero si alguna vez lo fuera `deleteEntry`
      // borraría su .md: eso no es una limpieza de fichas, así que se salta.
      if (!entry || entry.kind === 'servicio' || entry.kind === 'proyecto') continue;
      this.contentRepository.deleteEntry(id);
      retiradas.push({ entry });
    }
    return retiradas;
  }

  /**
   * Quita de sus fichas los campos de `CAMPOS_RETIRADOS`. Cada ficha tocada
   * sube de versión y guarda revisión, así que «Revisiones» recupera la
   * anterior; además se devuelve cada campo quitado para la auditoría.
   * Idempotente.
   */
  retireObsoleteFields(): Array<{ entryId: string; key: string; field: CmsField }> {
    const now = new Date().toISOString();
    const retirados: Array<{ entryId: string; key: string; field: CmsField }> = [];
    // Las familias por slug (galerías) son todas de tipo `settings`.
    const ajustes = this.contentRepository.listEntries('settings', 10_000).entries.map((e) => e.id);

    for (const regla of CAMPOS_RETIRADOS) {
      const afectadas = regla.entrada
        ? [regla.entrada]
        : ajustes.filter((id) => regla.prefijo && id.startsWith(regla.prefijo));
      for (const id of afectadas) {
        const entry = this.contentRepository.findEntry(id);
        if (!entry || entry.kind === 'servicio' || entry.kind === 'proyecto') continue;
        const quitar = regla.campos.filter((key) => entry.fields[key] !== undefined);
        if (quitar.length === 0) continue;
        const quedan = Object.values(entry.fields).filter((f) => !quitar.includes(f.key));
        this.contentRepository.replaceEntryFields(id, quedan, now);
        for (const key of quitar) retirados.push({ entryId: id, key, field: entry.fields[key] });
      }
    }
    return retirados;
  }

  createEntry(input: {
    id: string;
    kind: string;
    slug: string;
    locale?: string;
    title: string;
    status?: 'draft' | 'published';
    fields?: Record<string, { type: string; value: unknown }>;
  }) {
    const now = new Date().toISOString();
    // Plantilla requerida por el schema primero, sobreescrita por cualquier
    // campo que el cliente sí envíe — así una entrada de colección nunca queda
    // sin los campos obligatorios y el .md exportado siempre valida (CMS-003).
    const merged: Record<string, SeedField> = {
      ...requiredFieldTemplate(input.kind, input.title),
      ...(input.fields ?? {}),
    };
    const fields = Object.entries(merged).map(([key, f]) => ({
      key,
      type: f.type as
        'text' | 'textarea' | 'richtext' | 'image' | 'link' | 'number' | 'list' | 'object',
      value: f.value,
    }));
    if (!esColeccion(input.kind)) {
      return this.contentRepository.createEntry({ ...input, fields, now });
    }
    // P1-02: el id de una ficha de colección lo decide el servidor, con la
    // forma que usan las plantillas del sitio.
    const kind = input.kind;
    validarSlugDeColeccion(input.slug);
    const id = collectionEntryId(kind, input.slug);
    const choque = this.contentRepository.findCollectionEntryBySlug(
      kind,
      input.slug,
      input.locale ?? 'es-CL'
    );
    if (choque) {
      throw new Error(
        `Ya existe una entrada de tipo "${kind}" con el slug "${input.slug}": «${choque.title}» (${choque.id}). Elija otro slug.`
      );
    }
    const created = this.contentRepository.createEntry({ ...input, id, fields, now });
    this.slugRepository?.record(kind, input.slug, id, now);
    for (const c of companionEntries(kind, input.slug, input.title)) {
      this.contentRepository.insertEntryIfMissing({ ...c, status: 'published', now });
    }
    return created;
  }

  updateEntryMeta(
    rawId: string,
    meta: { title?: string; slug?: string; status?: 'draft' | 'published' }
  ) {
    const id = this.resolveEntryId(rawId);
    const antes = this.contentRepository.findEntry(id);
    if (antes && esColeccion(antes.kind) && meta.slug !== undefined) {
      validarSlugDeColeccion(meta.slug);
    }
    const now = new Date().toISOString();
    const result = this.contentRepository.updateEntryMeta(id, meta, now);
    if (antes && esColeccion(antes.kind) && meta.slug && meta.slug !== antes.slug) {
      this.moverFichaDeSlug(antes.kind, id, antes, meta.slug, now);
    }
    return result;
  }

  /**
   * P1-03 (auditoría 2026-09): cambiar la dirección de una ficha le quitaba la
   * foto de cabecera, la galería y el enlace desde /galeria (todo cuelga del
   * slug) y dejaba la URL vieja en 404. Ahora se llevan consigo sus fichas
   * compañeras, las fotos de la galería y las referencias de otros proyectos,
   * y si estaba publicada la dirección vieja redirige (301) a la nueva.
   */
  private moverFichaDeSlug(
    kind: KindColeccion,
    id: string,
    antes: CmsEntry,
    nuevo: string,
    now: string
  ): void {
    const viejo = antes.slug;
    this.slugRepository?.record(kind, viejo, id, now);
    this.slugRepository?.record(kind, nuevo, id, now);
    for (const [c, destino] of companionEntries(kind, viejo, antes.title).map(
      (c, i) => [c, companionEntries(kind, nuevo, antes.title)[i]] as const
    )) {
      const existeViejo = this.contentRepository.findEntry(c.id);
      const existeNuevo = this.contentRepository.findEntry(destino.id);
      if (existeViejo && !existeNuevo) {
        this.contentRepository.renameEntry(c.id, destino.id, destino.slug);
      } else if (!existeNuevo) {
        this.contentRepository.insertEntryIfMissing({ ...destino, status: 'published', now });
      }
    }
    if (kind === 'proyecto') this.contentRepository.retargetGalleryProjectSlug(viejo, nuevo, now);
    if (kind === 'servicio') this.contentRepository.retargetServiceReferences(viejo, nuevo, now);
    const coleccion = COLECCION[kind];
    this.slugRepository?.removeRedirectFrom(`/${coleccion}/${nuevo}`);
    if (antes.status === 'published') {
      this.slugRepository?.addRedirect(`/${coleccion}/${viejo}`, `/${coleccion}/${nuevo}`, now);
    }
  }

  /**
   * Borra una entrada y devuelve lo necesario para poder restaurarla.
   *
   * La captura es casi gratis: ya se leía la entrada aquí mismo para saber qué
   * archivo borrar. Lo nuevo es conservar también los bytes del `.md`, porque
   * el export solo corre cuando el operador pulsa «Exportar»: mientras tanto
   * `src/content/` tendría un archivo borrado que git ve, y desplegar en esa
   * ventana devolvería un 404.
   */
  deleteEntry(rawId: string): { entry?: CmsEntry; file?: { relPath: string; contents: string } } {
    const id = this.resolveEntryId(rawId);
    const entry = this.contentRepository.findEntry(id);
    const capturado: { entry?: CmsEntry; file?: { relPath: string; contents: string } } = {
      entry: entry ?? undefined,
    };
    this.contentRepository.deleteEntry(id);

    // CMS-2 fix: deleting a proyecto/servicio entry from the CMS previously
    // left its exported .md file on disk — the "deleted" content stayed live
    // on the site until someone happened to notice and remove the file by
    // hand. Remove it here, at the one point where we have unambiguous
    // knowledge of exactly which file belonged to this entry.
    if (entry && (entry.kind === 'servicio' || entry.kind === 'proyecto')) {
      // C-1: el archivo se nombra por slug, y el slug no es exclusivo de esta
      // entrada en bases anteriores al índice único. Si otra entrada lo
      // reclama, el .md es suyo: borrarlo aquí destruiría contenido ajeno.
      // Reproducido en auditoría: borrar una entrada de prueba eliminó
      // src/content/proyectos/ch-pangal.md, de un proyecto distinto.
      const claimedByOther = this.contentRepository.findCollectionEntryBySlug(
        entry.kind,
        entry.slug,
        entry.locale
      );
      // Si otra entrada reclama el slug no se borra el archivo, y por tanto
      // tampoco hay nada que restaurar de él.
      if (claimedByOther) return capturado;

      const collection = entry.kind === 'servicio' ? 'servicios' : 'proyectos';
      const relPath = path.join('src', 'content', collection, `${entry.slug}.md`);
      const target = path.join(this.rootDir, relPath);
      if (fs.existsSync(target)) {
        capturado.file = { relPath, contents: fs.readFileSync(target, 'utf8') };
        fs.unlinkSync(target);
      }
      // P1-03: también los .md de sus direcciones anteriores, que ninguna otra
      // ficha use ahora. El historial se conserva para que el arranque no los
      // reimporte si reaparecen (p. ej. traídos por git).
      this.slugRepository?.record(entry.kind, entry.slug, id);
      this.slugRepository?.removeRedirectsTo(`/${collection}/${entry.slug}`);
      for (const slug of this.slugRepository?.slugsOf(entry.kind, id) ?? []) {
        if (slug === entry.slug) continue;
        if (this.contentRepository.findCollectionEntryBySlug(entry.kind, slug, entry.locale))
          continue;
        const viejo = path.join(this.rootDir, 'src', 'content', collection, `${slug}.md`);
        if (fs.existsSync(viejo)) fs.unlinkSync(viejo);
      }
    }
    return capturado;
  }

  /**
   * Rehace una entrada borrada a partir de su snapshot.
   *
   * No se reutiliza `restoreRevision`: llama a `updateEntryMeta`, que lanza
   * cuando la fila no existe — que es exactamente el caso aquí. Lo que sí
   * sirve es `upsertEntry`, que inserta entrada, campos y primera revisión en
   * una sola transacción.
   *
   * Las revisiones previas NO vuelven: el `ON DELETE CASCADE` de la tabla se
   * las llevó, y guardarlas en el snapshot serían hasta 50 copias completas de
   * la entrada por cada borrado. Se acepta la pérdida y se dice en pantalla.
   */
  restoreDeletedEntry(snapshot: {
    entry?: CmsEntry;
    file?: { relPath: string; contents: string };
  }): { id: string; fileRestored: boolean } {
    const entry = snapshot.entry;
    if (!entry) throw new Error('El registro no conserva la entrada borrada.');
    if (this.contentRepository.findEntry(entry.id)) {
      throw new Error(`Ya existe una entrada con el id "${entry.id}".`);
    }

    // `upsertEntry` toma los campos como array; `CmsEntry` los trae indexados
    // por clave, que es lo que produce `hydrateEntry`.
    this.contentRepository.upsertEntry({
      id: entry.id,
      kind: entry.kind,
      slug: entry.slug,
      locale: entry.locale,
      title: entry.title,
      status: entry.status,
      fields: Object.values(entry.fields),
      now: new Date().toISOString(),
    });

    let fileRestored = false;
    if (snapshot.file) {
      const target = path.join(this.rootDir, snapshot.file.relPath);
      // Solo si nadie lo recreó entre medias: pisarlo destruiría lo nuevo.
      if (!fs.existsSync(target)) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, snapshot.file.contents);
        fileRestored = true;
      }
    }
    return { id: entry.id, fileRestored };
  }

  listRevisions(entryId: string) {
    return this.contentRepository.listRevisions(this.resolveEntryId(entryId));
  }

  listRevisionsDetailed(entryId: string, field?: string) {
    return this.contentRepository.listRevisionsDetailed(this.resolveEntryId(entryId), field);
  }

  /**
   * P2-26: restaurar desde el editor de un campo devolvía la ficha entera
   * (título, subtítulo, botones…). Esto devuelve solo ese campo al valor que
   * tenía en la versión elegida, y deja una revisión nueva como cualquier
   * guardado.
   */
  restoreRevisionField(entryId: string, revisionId: string, key: string) {
    const id = this.resolveEntryId(entryId);
    const snapshot = this.getRevision(revisionId);
    if (snapshot.id !== id) throw new Error(`La revisión no pertenece a la entrada ${entryId}`);
    const field = snapshot.fields?.[key];
    if (!field) throw new Error(`Field ${key} does not exist in this revision`);
    this.contentRepository.updateField(id, key, field.value, new Date().toISOString());
    return this.getEntry(id);
  }

  getRevision(revisionId: string) {
    const entry = this.contentRepository.getRevision(revisionId);
    if (!entry) throw new Error(`Revisión ${revisionId} no encontrada`);
    return entry;
  }

  restoreRevision(entryId: string, revisionId: string) {
    return this.contentRepository.restoreRevision(
      this.resolveEntryId(entryId),
      revisionId,
      new Date().toISOString()
    );
  }

  listEntries(kind?: string, limit = 100, offset = 0, q?: string) {
    return this.contentRepository.listEntries(kind, limit, offset, q);
  }

  getEntry(id: string) {
    const entry = this.contentRepository.findEntry(this.resolveEntryId(id));
    if (!entry) throw new Error(`Entrada ${id} no encontrada`);
    return entry;
  }

  updateField(
    entryId: string,
    key: string,
    value: unknown,
    mediaId?: string,
    expectedVersion?: number
  ) {
    entryId = this.resolveEntryId(entryId);
    // El logo de un cliente recién añadido o el icono propio de un servicio no
    // tienen campo todavía (ver campoQueSeCreaAlGuardar). Cualquier otra clave
    // inexistente sigue siendo un error.
    const entry = this.contentRepository.findEntry(entryId);
    const tipoNuevo = entry && !entry.fields[key] ? campoQueSeCreaAlGuardar(entry, key) : null;
    if (tipoNuevo) {
      if (typeof value !== 'string')
        throw new Error(`El campo "${key}" de tipo "${tipoNuevo}" debe ser texto`);
      this.contentRepository.insertMissingFields(
        entryId,
        [{ key, type: tipoNuevo, value: '' }],
        new Date().toISOString()
      );
    }
    const antes =
      entryId === 'clientes.lista' && key === 'nombres' ? entry?.fields.nombres?.value : undefined;
    const actualizada = this.contentRepository.updateField(
      entryId,
      key,
      value,
      new Date().toISOString(),
      mediaId,
      expectedVersion
    );
    if (Array.isArray(antes) && Array.isArray(value)) this.migrarLogosRenombrados(antes, value);
    // P3-12 (auditoría 2026-09): pasar un proyecto de destacado a banco
    // quitaba su página, y quien la tuviera enlazada llegaba a un 404. Ahora
    // redirige al listado; si vuelve a destacado, la redirección se quita.
    if (entry?.kind === 'proyecto' && key === 'tipo' && this.slugRepository) {
      const ruta = `/proyectos/${entry.slug.replace(/^\/+/, '')}`;
      if (value === 'banco' && entry.fields.tipo?.value === 'destacado') {
        this.slugRepository.addRedirect(ruta, '/proyectos/');
      } else if (value === 'destacado') {
        this.slugRepository.removeRedirectFrom(ruta);
      }
    }
    return actualizada;
  }

  /**
   * P2-11 (auditoría 2026-09): el logo de un cliente se guarda con una clave
   * que sale de su nombre (`logo-colbun`), así que corregir «Colbún» por
   * «Colbún S.A.» en la lista lo dejaba sin logo en /clientes y en el inicio.
   *
   * Si en un guardado desaparecen tantos nombres como aparecen, se toman como
   * renombrados en el orden en que están, y el logo del nombre anterior pasa
   * al nuevo (salvo que el nuevo ya tenga uno). Añadir o quitar clientes a la
   * vez que se renombra no permite emparejarlos con seguridad y no mueve nada.
   */
  private migrarLogosRenombrados(antes: unknown[], despues: unknown[]) {
    const clave = (nombre: unknown) =>
      String(nombre ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    const clavesAntes = antes.map(clave).filter(Boolean);
    const clavesDespues = despues.map(clave).filter(Boolean);
    const quitados = clavesAntes.filter((k) => !clavesDespues.includes(k));
    const nuevos = clavesDespues.filter((k) => !clavesAntes.includes(k));
    if (!quitados.length || quitados.length !== nuevos.length) return;
    const logos = this.contentRepository.findEntry('clientes.logos');
    if (!logos) return;
    quitados.forEach((viejo, i) => {
      const logo = logos.fields[`logo-${viejo}`]?.value;
      const yaTiene = logos.fields[`logo-${nuevos[i]}`]?.value;
      if (typeof logo === 'string' && logo && !yaTiene) {
        this.updateField('clientes.logos', `logo-${nuevos[i]}`, logo);
      }
    });
  }
}
