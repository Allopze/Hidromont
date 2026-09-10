import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import prettier from 'prettier';
import { config } from '../config/unifiedConfig';
import type { ContentRepository } from '../repositories/ContentRepository';
import type { GalleryRepository } from '../repositories/GalleryRepository';
import type { ImageService } from './imageService';
import { ENUM_FIELDS } from '../../src/data/content-vocabulary';
import type { CmsEntry } from '../types/cms';

/** A-7: entrada que el export dejó fuera, para poder avisar al editor. */
export interface SkippedEntry {
  id: string;
  kind: string;
  slug: string;
  reason: string;
}

/**
 * A-9: entrada de tipo página excluida por estar en borrador. No se oculta:
 * el sitio vuelve al texto por defecto del código, y eso hay que decirlo.
 */
export interface RevertedEntry {
  id: string;
  kind: string;
  title: string;
}

// A-7: el vocabulario ya no se duplica aquí. Vive en
// src/data/content-vocabulary.ts, del que también consumen el schema de Astro,
// el validador del servidor y el `<select>` del overlay. Antes eran dos `Set`
// mantenidos a mano con un comentario que reconocía la duplicación, y dos de
// las siete copias del vocabulario ya habían divergido.

/**
 * A1-001 + A1-003: escritura atomica y robusta.
 * - Crea el directorio padre recursivamente (slugs con subdirectorio como
 *   `tanques/316l` ya no lanzan ENOENT).
 * - Escribe a `${target}.tmp` y luego renombra, de modo que un crash a mitad
 *   de escritura nunca deje un archivo truncado/corrupto (rename es atomico
 *   en el mismo sistema de ficheros).
 * H-17: omite la escritura si el contenido ya es identico (evita disparar
 *   HMR innecesario en desarrollo y reduce I/O en exportaciones idempotentes).
 * @returns true si se escribio, false si el contenido era identico.
 */
function writeFileSyncAtomic(target: string, data: string): boolean {
  try {
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === data) {
      return false; // contenido identico — no hace falta escribir
    }
  } catch {
    // Si no podemos leer el archivo existente, procedemos con la escritura.
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, target);
  return true;
}

/**
 * GAL-1: guarda contra el borrado silencioso de la galería.
 *
 * `exportGallery()` regenera src/data/gallery.json **completo** desde SQLite.
 * Si la DB tiene menos items publicados que el JSON ya existente en disco, eso
 * casi siempre significa que el JSON se pobló por fuera del CMS (un script que
 * escribió el archivo directo) y que exportar destruiría contenido que la DB
 * nunca tuvo. Es exactamente lo que pasó al importar los álbumes de proyecto:
 * 168 fotos en el JSON contra 23 en la DB, y un solo clic en "Exportar" las
 * habría borrado sin un error ni una confirmación.
 *
 * Un borrado genuino (el admin borra fotos de verdad en el CMS) también reduce
 * la cuenta, así que la guarda es saltable — pero de forma explícita y dejando
 * rastro, en vez de ser el comportamiento por defecto.
 */
function assertNoSilentGalleryShrink(target: string, nextCount: number): void {
  if (process.env.CMS_ALLOW_GALLERY_SHRINK === '1') return;
  if (!fs.existsSync(target)) return;

  let previousCount: number;
  try {
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8')) as { items?: unknown[] };
    if (!Array.isArray(parsed.items)) return; // formato inesperado — no bloqueamos
    previousCount = parsed.items.length;
  } catch {
    return; // JSON ilegible: no hay nada que proteger
  }

  if (nextCount >= previousCount) return;

  throw new Error(
    `Export de galería abortado: la base de datos tiene ${nextCount} foto(s) publicada(s) ` +
      `pero ${path.basename(target)} ya contiene ${previousCount}. Exportar borraría ` +
      `${previousCount - nextCount} foto(s) que el CMS no conoce.\n` +
      `  • Si faltan fotos en el CMS, impórtalas antes: npx tsx cms/scripts/import-gallery-json.ts\n` +
      `  • Si la reducción es intencional (borraste fotos a propósito), repite con ` +
      `CMS_ALLOW_GALLERY_SHRINK=1.`
  );
}

/**
 * A-5: marca de tiempo derivada del contenido para que el export sea
 * idempotente. Las cadenas ISO se ordenan lexicográficamente, así que un
 * `sort()` basta. Sin entradas devuelve el epoch, nunca la hora actual.
 */
const EPOCH = '1970-01-01T00:00:00.000Z';

function maxFieldUpdatedAt(entries: CmsEntry[]): string {
  let max = EPOCH;
  for (const entry of entries) {
    for (const field of Object.values(entry.fields)) {
      if (field.updatedAt && field.updatedAt > max) max = field.updatedAt;
    }
  }
  return max;
}

/**
 * A-5: orden canónico del frontmatter, decidido AQUÍ y no heredado del
 * `ORDER BY key` de ContentRepository.hydrateEntry. Alfabético porque es el
 * orden que ya tienen los .md del repositorio; lo importante no es cuál sea,
 * sino que esté escrito en el exportador: mientras dependía de una cláusula
 * SQL, cambiarla reabría el problema sin que nadie lo notara.
 */
function orderFrontmatterKeys(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(fields)
      .sort()
      .map((key) => [key, fields[key]])
  );
}

/**
 * A-5 — Forma canónica de un .md de colección. Exportada para que el test de
 * punto fijo use exactamente este código y no una segunda implementación que
 * pueda divergir.
 *
 * Sobre el formato: prettier aquí solo normaliza detalles menores (la línea
 * en blanco tras el `---` de cierre). Quien fija de verdad el estilo del
 * frontmatter es el js-yaml 3.x que `gray-matter` trae empaquetado — el
 * plegado de los bloques `>-` a 80 columnas y el entrecomillado de valores
 * como `'1.200 m, …'` salen de ahí. Es una dependencia transitiva, así que
 * un `npm update` puede cambiar la salida: la garantía de idempotencia la da
 * el test, no este paso. No quitar prettier: sin él la salida deja de ser
 * punto fijo de prettier y `lint-staged` la reformatearía en cada commit.
 */
export async function canonicalMarkdown(
  frontmatter: Record<string, unknown>,
  body: string,
  target: string,
  rootDir: string = config.rootDir
): Promise<string> {
  const raw = matter.stringify(body.trim() + '\n', orderFrontmatterKeys(frontmatter));
  try {
    const options = await prettier.resolveConfig(target);
    return await prettier.format(raw, { ...options, filepath: target });
  } catch (error) {
    process.stderr.write(
      `  ⚠ prettier falló en ${path.relative(rootDir, target)}; se escribe sin formatear: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    return raw;
  }
}

export class ExportService {
  /**
   * @param rootDir raíz del repo donde escribir los archivos exportados.
   *   Configurable para que los tests puedan apuntar a un directorio temporal
   *   y no sobreescriban el `cms-content.json` real del sitio.
   */
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly rootDir: string = config.rootDir,
    private readonly galleryRepository?: GalleryRepository,
    private readonly imageService?: ImageService
  ) {}

  async exportContent(): Promise<{
    files: string[];
    removed: string[];
    skipped: SkippedEntry[];
    revertedToFallback: RevertedEntry[];
  }> {
    const skipped: SkippedEntry[] = [];
    // Solo se exporta contenido publicado: un borrador (status 'draft') nunca
    // Carga todas las entradas. Para cada una, exporta su archivo .md con sus
    // valores por defecto (page content) o conserva el .md previo (colecciones).
    const { entries: allEntries } = this.contentRepository.listEntries(undefined, 100000, 0);
    const entries = allEntries.filter((entry) => entry.status === 'published');
    const written = [
      this.exportPageContent(
        entries.filter((entry) => ['page', 'layout', 'component', 'settings'].includes(entry.kind))
      ),
      // CMS-3 fix: this used to also require `entry.version > 1` — entries are
      // created at version 1 and only field-level edits bump it, so a
      // proyecto/servicio that was bulk-imported (or created and published
      // without ever individually editing a field afterward) was silently
      // excluded from export forever: its .md was simply never written, even
      // though it was legitimately published. Export every published
      // collection entry regardless of version; re-writing unchanged content
      // is harmless (idempotent), unlike omitting live content entirely.
      ...(await this.exportCollection(
        entries.filter((entry) => ['servicio', 'proyecto'].includes(entry.kind)),
        skipped
      )),
    ];

    // CMS-2 fix: a renamed or unpublished collection entry previously left its
    // old .md behind (the export loop above only ever *writes*, never
    // deletes), so renamed/unpublished/deleted content kept shipping on the
    // site. Prune those, scoped to slugs a currently-known proyecto/servicio
    // entry claims (its current slug, or the slug it was originally imported
    // under) — never touches a file with no matching entry at all, so
    // hand-authored content added outside the CMS is left alone.
    const removed = this.pruneStaleCollectionFiles(
      allEntries.filter((entry) => ['servicio', 'proyecto'].includes(entry.kind))
    );

    // A-9: despublicar una entrada de página no la oculta — la saca de
    // cms-content.json y el sitio vuelve al texto por defecto del código, que
    // el editor no ve ni controla. Se reporta para que el efecto sea visible.
    const revertedToFallback = allEntries
      .filter(
        (entry) =>
          entry.status !== 'published' &&
          ['page', 'layout', 'component', 'settings'].includes(entry.kind)
      )
      .map((entry) => ({ id: entry.id, kind: entry.kind, title: entry.title }));

    return { files: written, removed, skipped, revertedToFallback };
  }

  private exportPageContent(entries: CmsEntry[]): string {
    const target = path.join(this.rootDir, 'src', 'data', 'cms-content.json');
    const payload = {
      // A-5: derivado del contenido, no del reloj. Con `new Date()` este
      // archivo cambiaba en CADA export aunque nada se hubiera editado, así
      // que el export era no idempotente por construcción y sus diffs
      // enterraban los cambios reales. Nadie lee este campo en src/.
      updatedAt: maxFieldUpdatedAt(entries),
      entries: Object.fromEntries(
        entries.map((entry) => [
          entry.id,
          {
            title: entry.title,
            slug: entry.slug,
            fields: Object.fromEntries(
              Object.entries(entry.fields).map(([key, field]) => [
                key,
                { type: field.type, value: field.value },
              ])
            ),
          },
        ])
      ),
    };

    writeFileSyncAtomic(target, JSON.stringify(payload, null, 2) + '\n');
    return path.relative(this.rootDir, target);
  }

  /**
   * CMS-2 fix: deletes stale .md files left behind by an unpublish or a slug
   * rename. Entries are imported with id `${collection}.${originalSlug}` (see
   * contentSeed.ts), and that id never changes even if `slug` is later
   * edited — so it reliably tells us the filename this entry was
   * *originally* exported under, without needing extra DB state.
   *
   * Whether an entry's CURRENT slug is allowed to have a file is governed by
   * `status === 'published'` alone. Now that CMS-3 removed the `version > 1`
   * gate from exportCollection()'s own eligibility filter, every published
   * entry is guaranteed a fresh file under its current slug on every export
   * pass — so a renamed entry's old slug is always safe to prune the moment
   * it differs from the current one, with no separate "was it actually
   * rewritten this pass" tracking needed.
   */
  private pruneStaleCollectionFiles(entries: CmsEntry[]): string[] {
    const removed: string[] = [];

    for (const entry of entries) {
      const collection = entry.kind === 'servicio' ? 'servicios' : 'proyectos';
      const idPrefix = `${collection}.`;
      const originalSlug = entry.id.startsWith(idPrefix)
        ? entry.id.slice(idPrefix.length)
        : entry.slug;
      const isPublished = entry.status === 'published';

      const staleSlugs = new Set<string>();

      // Unpublished: nothing should exist under any slug anymore.
      if (!isPublished) staleSlugs.add(entry.slug);

      // Renamed: the old filename is always stale — the current slug's file
      // is guaranteed fresh this same pass whenever the entry is published.
      if (originalSlug !== entry.slug) staleSlugs.add(originalSlug);

      for (const slug of staleSlugs) {
        const target = path.join(this.rootDir, 'src', 'content', collection, `${slug}.md`);
        if (fs.existsSync(target)) {
          fs.unlinkSync(target);
          removed.push(path.relative(this.rootDir, target));
        }
      }
    }

    return removed;
  }

  /**
   * A-7: `field.value` llega como `unknown` (updateFieldSchema acepta
   * z.unknown()), así que un valor fuera del enum que Astro exige podía
   * colarse hasta el .md y hacer fallar `astro check` con un error que
   * apuntaba a las tripas de Astro y no al campo culpable.
   *
   * Recorre ENUM_FIELDS en vez de dos campos escritos a mano, así que añadir
   * un campo de enumeración al vocabulario lo cubre aquí sin tocar nada.
   */
  private validateCollectionEntry(entry: CmsEntry): string | null {
    const enums = ENUM_FIELDS[entry.kind];
    if (!enums) return null;

    for (const [key, allowed] of Object.entries(enums)) {
      const value = entry.fields[key]?.value;
      if (value === undefined) continue;
      if (!allowed.includes(String(value))) {
        return `${key} "${value}" inválido (valores permitidos: ${allowed.join(', ')})`;
      }
    }
    return null;
  }

  private async exportCollection(entries: CmsEntry[], skipped: SkippedEntry[]): Promise<string[]> {
    const written: string[] = [];
    const writtenTargets = new Set<string>();

    for (const entry of entries) {
      const validationError = this.validateCollectionEntry(entry);
      if (validationError) {
        // A-7: además de avisar por stderr (útil para `npm run cms:export`
        // desde terminal), se acumula para devolverlo al panel. Antes el job
        // se cerraba como `succeeded` y el editor no se enteraba de que su
        // proyecto no se había publicado.
        process.stderr.write(
          `  ⚠ Omitiendo ${entry.kind} "${entry.slug}" (${entry.id}): ${validationError}. Corrija el campo en el CMS y vuelva a exportar.\n`
        );
        skipped.push({
          id: entry.id,
          kind: entry.kind,
          slug: entry.slug,
          reason: validationError,
        });
        continue;
      }

      const collection = entry.kind === 'servicio' ? 'servicios' : 'proyectos';
      const target = path.join(this.rootDir, 'src', 'content', collection, `${entry.slug}.md`);
      const frontmatter: Record<string, unknown> = {};
      let body = '';

      for (const [key, field] of Object.entries(entry.fields)) {
        if (key === 'body') {
          body = String(field.value ?? '');
        } else {
          frontmatter[key] = field.value;
        }
      }

      // C-1: en bases anteriores al índice único dos entradas publicadas
      // pueden reclamar el mismo slug. Escribir la segunda sobre la primera
      // haría desaparecer contenido según el orden de iteración.
      if (writtenTargets.has(target)) {
        process.stderr.write(
          `  ⚠ Omitiendo ${entry.kind} "${entry.slug}" (${entry.id}): otra entrada ya escribió ese archivo.\n`
        );
        skipped.push({
          id: entry.id,
          kind: entry.kind,
          slug: entry.slug,
          reason: 'otra entrada publicada reclama el mismo slug',
        });
        continue;
      }
      writtenTargets.add(target);

      writeFileSyncAtomic(target, await canonicalMarkdown(frontmatter, body, target, this.rootDir));
      written.push(path.relative(this.rootDir, target));
    }

    return written;
  }

  async exportGallery(): Promise<{ file: string; count: number }> {
    if (!this.galleryRepository || !this.imageService) {
      throw new Error('GalleryRepository e ImageService requeridos para exportGallery');
    }

    const categories = this.galleryRepository.listCategories();
    const items = this.galleryRepository.listItems({ status: 'published' });

    const processedItems = [];
    let skippedOrphan = 0;
    for (const item of items) {
      // A1-004: un item huerfano (media borrada, media_id NULL) no se puede exportar
      // porque no tiene imagen. Lo saltamos explicitamente para no romper el export.
      if (!item.mediaPath) {
        skippedOrphan += 1;
        process.stderr.write(
          `  ⚠ Skipping gallery item ${item.id}: media huerfano (media_id NULL). Reasigna un media en el CMS.\n`
        );
        continue;
      }
      try {
        const derivatives = await this.imageService.generateDerivatives(item.mediaPath);
        processedItems.push({
          id: item.id,
          // La galería no muestra título ni descripción por foto: solo fotos
          // agrupadas en álbumes. `alt` se mantiene porque es lo que anuncian
          // los lectores de pantalla, no texto visible.
          alt: item.alt,
          categorySlug: item.categorySlug,
          categoryName: item.categoryName,
          projectSlug: item.projectSlug ?? null,
          featured: item.featured,
          position: item.position,
          src: derivatives.src,
          width: derivatives.width,
          height: derivatives.height,
          srcset: derivatives.srcset,
          lqip: derivatives.lqip,
          focalX: item.mediaFocalX ?? 0.5,
          focalY: item.mediaFocalY ?? 0.5,
        });
      } catch (err) {
        process.stderr.write(
          `  ⚠ Skipping gallery item ${item.id} (${item.mediaPath}): ${err instanceof Error ? err.message : String(err)}\n`
        );
      }
    }

    const target = path.join(this.rootDir, 'src', 'data', 'gallery.json');
    const payload = {
      // A-5: derivado del contenido, igual que en cms-content.json.
      updatedAt: this.galleryRepository.maxUpdatedAt(),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        position: c.position,
      })),
      // GAL-19: los nombres y el orden de los álbumes vienen de la base. Antes
      // vivían en un mapa hardcodeado en src/data/gallery.ts, así que
      // renombrar un álbum exigía tocar código y rebuild.
      albums: this.galleryRepository.listAlbums().map((a) => ({
        slug: a.slug,
        name: a.name,
        position: a.position,
      })),
      items: processedItems,
    };

    assertNoSilentGalleryShrink(target, processedItems.length);

    writeFileSyncAtomic(target, JSON.stringify(payload, null, 2) + '\n');
    if (skippedOrphan > 0) {
      process.stderr.write(`  ⚠ ${skippedOrphan} gallery item(s) saltado(s) por media huerfano.\n`);
    }
    return { file: path.relative(this.rootDir, target), count: processedItems.length };
  }
}
