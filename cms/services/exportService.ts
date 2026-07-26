import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { config } from '../config/unifiedConfig';
import type { ContentRepository } from '../repositories/ContentRepository';
import type { GalleryRepository } from '../repositories/GalleryRepository';
import type { ImageService } from './imageService';
import type { CmsEntry } from '../types/cms';

/**
 * A1-001 + A1-003: escritura atomica y robusta.
 * - Crea el directorio padre recursivamente (slugs con subdirectorio como
 *   `tanques/316l` ya no lanzan ENOENT).
 * - Escribe a `${target}.tmp` y luego renombra, de modo que un crash a mitad
 *   de escritura nunca deje un archivo truncado/corrupto (rename es atomico
 *   en el mismo sistema de ficheros).
 */
function writeFileSyncAtomic(target: string, data: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, target);
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

  exportContent(): { files: string[] } {
    // Solo se exporta contenido publicado: un borrador (status 'draft') nunca
    // llega a los archivos del sitio. Al excluirlo, el frontend recae en los
    // valores por defecto (page content) o conserva el .md previo (colecciones).
    const entries = this.contentRepository
      .listEntries()
      .filter((entry) => entry.status === 'published');
    const written = [
      this.exportPageContent(
        entries.filter((entry) => ['page', 'layout', 'component', 'settings'].includes(entry.kind))
      ),
      ...this.exportCollection(
        entries.filter((entry) => ['servicio', 'proyecto'].includes(entry.kind) && entry.version > 1)
      ),
    ];

    return { files: written };
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

  private exportCollection(entries: CmsEntry[]): string[] {
    return entries.map((entry) => {
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

      writeFileSyncAtomic(target, matter.stringify(body.trim() + '\n', frontmatter));
      return path.relative(this.rootDir, target);
    });
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
          title: item.title,
          alt: item.alt,
          caption: item.caption,
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
        process.stderr.write(`  ⚠ Skipping gallery item ${item.id} (${item.mediaPath}): ${err instanceof Error ? err.message : String(err)}\n`);
      }
    }

    const target = path.join(this.rootDir, 'src', 'data', 'gallery.json');
    const payload = {
      updatedAt: new Date().toISOString(),
      categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, position: c.position })),
      items: processedItems,
    };

    writeFileSyncAtomic(target, JSON.stringify(payload, null, 2) + '\n');
    if (skippedOrphan > 0) {
      process.stderr.write(`  ⚠ ${skippedOrphan} gallery item(s) saltado(s) por media huerfano.\n`);
    }
    return { file: path.relative(this.rootDir, target), count: processedItems.length };
  }
}
