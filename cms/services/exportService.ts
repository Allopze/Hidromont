import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import prettier from 'prettier';
import { config } from '../config/unifiedConfig';
import type { ContentRepository } from '../repositories/ContentRepository';
import type { GalleryRepository } from '../repositories/GalleryRepository';
import type { ImageService } from './imageService';
import type { CmsEntry } from '../types/cms';

// CMS-10: mirrors the enums Zod enforces in src/content.config.ts for the
// `proyectos` collection. Can't import astro:content here (this runs under
// plain Node/tsx, not the Astro runtime), so these are kept in sync by hand.
// A value outside these sets exports a syntactically valid .md that then
// fails `astro check` at publish time with a confusing, hard-to-trace error —
// catching it here at export time instead gives a clear, attributable one.
const CATEGORIA_PROYECTO_VALUES = new Set([
  'tuberias',
  'compuertas',
  'electromecanicos',
  'limpiarrejas',
  'estructuras',
]);
const TIPO_PROYECTO_VALUES = new Set(['destacado', 'banco']);

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

  async exportContent(): Promise<{ files: string[]; removed: string[] }> {
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
        entries.filter((entry) => ['servicio', 'proyecto'].includes(entry.kind))
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

    return { files: written, removed };
  }

  private exportPageContent(entries: CmsEntry[]): string {
    const target = path.join(this.rootDir, 'src', 'data', 'cms-content.json');
    const payload = {
      updatedAt: new Date().toISOString(),
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
   * CMS-10: `field.value` reaches here as `unknown` (updateFieldSchema accepts
   * z.unknown()), so nothing stops an operator from setting `categoria`/`tipo`
   * to a value outside the enum Astro's content schema enforces. Previously
   * this wrote a syntactically valid .md that then failed `astro check` at
   * publish time with an error pointing at Astro's internals, not the actual
   * bad field. Returns the first violation found, or null if the entry is valid.
   */
  private validateCollectionEntry(entry: CmsEntry): string | null {
    if (entry.kind !== 'proyecto') return null;

    const categoria = entry.fields.categoria?.value;
    if (categoria !== undefined && !CATEGORIA_PROYECTO_VALUES.has(String(categoria))) {
      return `categoria "${categoria}" inválida (valores permitidos: ${[...CATEGORIA_PROYECTO_VALUES].join(', ')})`;
    }

    const tipo = entry.fields.tipo?.value;
    if (tipo !== undefined && !TIPO_PROYECTO_VALUES.has(String(tipo))) {
      return `tipo "${tipo}" inválido (valores permitidos: ${[...TIPO_PROYECTO_VALUES].join(', ')})`;
    }

    return null;
  }

  private async exportCollection(entries: CmsEntry[]): Promise<string[]> {
    const written: string[] = [];

    for (const entry of entries) {
      const validationError = this.validateCollectionEntry(entry);
      if (validationError) {
        process.stderr.write(
          `  ⚠ Omitiendo ${entry.kind} "${entry.slug}" (${entry.id}): ${validationError}. Corrija el campo en el CMS y vuelva a exportar.\n`
        );
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

      writeFileSyncAtomic(
        target,
        await this.formatMarkdown(matter.stringify(body.trim() + '\n', frontmatter), target)
      );
      written.push(path.relative(this.rootDir, target));
    }

    return written;
  }

  /**
   * Los .md del repo siguen la convención de prettier (viñetas `-`, tablas
   * alineadas, printWidth 100); la salida cruda de `matter.stringify` no.
   * Sin este paso, cada export reescribía los 48 archivos con diffs de puro
   * formato aunque el contenido no hubiera cambiado. Formatear aquí con la
   * config del propio repo hace el round-trip DB→.md byte-idéntico.
   *
   * El formato es cosmético: si prettier fallara con algún contenido, se
   * escribe la versión sin formatear antes que hacer fallar el export.
   */
  private async formatMarkdown(raw: string, target: string): Promise<string> {
    try {
      const options = await prettier.resolveConfig(target);
      return await prettier.format(raw, { ...options, filepath: target });
    } catch (error) {
      process.stderr.write(
        `  ⚠ prettier falló en ${path.relative(this.rootDir, target)}; se escribe sin formatear: ${
          error instanceof Error ? error.message : String(error)
        }\n`
      );
      return raw;
    }
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
      updatedAt: new Date().toISOString(),
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
