import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/unifiedConfig';
import type { ContentRepository } from '../repositories/ContentRepository';
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
    const entries = getInitialEntries();

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

  /** Import only entries whose IDs do not yet exist in the DB (safe for live DBs). */
  importMissingEntries(): { inserted: number } {
    const now = new Date().toISOString();
    const entries = getInitialEntries();
    let inserted = 0;

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
      if (created) inserted++;
    }

    return { inserted };
  }

  createEntry(input: {
    id: string;
    kind: string;
    slug: string;
    locale?: string;
    title: string;
    status?: 'draft' | 'pending_review' | 'published';
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
    meta: { title?: string; slug?: string; status?: 'draft' | 'pending_review' | 'published' }
  ) {
    return this.contentRepository.updateEntryMeta(id, meta, new Date().toISOString());
  }

  deleteEntry(id: string): void {
    const entry = this.contentRepository.findEntry(id);
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
      if (claimedByOther) return;

      const collection = entry.kind === 'servicio' ? 'servicios' : 'proyectos';
      const target = path.join(this.rootDir, 'src', 'content', collection, `${entry.slug}.md`);
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    }
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

  listEntries(kind?: string, limit = 100, offset = 0) {
    return this.contentRepository.listEntries(kind, limit, offset);
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
