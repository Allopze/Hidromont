import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/unifiedConfig';
import type { ContentRepository } from '../repositories/ContentRepository';
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
  if (kind === 'servicio') {
    return {
      titulo: { type: 'text', value: title },
      resumen: { type: 'textarea', value: 'Descripción pendiente de completar.' },
      // A-7: el vocabulario válido está en src/data/content-vocabulary.ts
      // (ICONO_SERVICIO). Este comentario listaba 6 iconos cuando
      // ServiceCard define 8, y la base ya usaba los dos que faltaban.
      icono: { type: 'text', value: ICONO_SERVICIO[0] },
      orden: { type: 'number', value: 100 },
      body: { type: 'textarea', value: 'Contenido pendiente de completar.' },
    };
  }
  if (kind === 'proyecto') {
    return {
      nombre: { type: 'text', value: title },
      alcance: { type: 'textarea', value: 'Alcance pendiente de completar.' },
      // A-7: vocabulario en src/data/content-vocabulary.ts.
      categoria: { type: 'text', value: CATEGORIA_PROYECTO[0] },
      tipo: { type: 'text', value: 'banco' },
      orden: { type: 'number', value: 100 },
      body: { type: 'textarea', value: 'Contenido pendiente de completar.' },
    };
  }
  return {};
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
    private readonly rootDir: string = config.rootDir
  ) {}

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

    for (const entry of entries) {
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
    return this.contentRepository.createEntry({ ...input, fields, now });
  }

  updateEntryMeta(
    id: string,
    meta: { title?: string; slug?: string; status?: 'draft' | 'published' }
  ) {
    return this.contentRepository.updateEntryMeta(id, meta, new Date().toISOString());
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
  deleteEntry(id: string): { entry?: CmsEntry; file?: { relPath: string; contents: string } } {
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
    return this.contentRepository.listRevisions(entryId);
  }

  getRevision(revisionId: string) {
    const entry = this.contentRepository.getRevision(revisionId);
    if (!entry) throw new Error(`Revisión ${revisionId} no encontrada`);
    return entry;
  }

  restoreRevision(entryId: string, revisionId: string) {
    return this.contentRepository.restoreRevision(entryId, revisionId, new Date().toISOString());
  }

  listEntries(kind?: string, limit = 100, offset = 0, q?: string) {
    return this.contentRepository.listEntries(kind, limit, offset, q);
  }

  getEntry(id: string) {
    const entry = this.contentRepository.findEntry(id);
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
    return this.contentRepository.updateField(
      entryId,
      key,
      value,
      new Date().toISOString(),
      mediaId,
      expectedVersion
    );
  }
}
