import type { ContentRepository } from '../repositories/ContentRepository';
import { getInitialEntries } from './contentSeed';

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
      // Debe ser una clave válida de iconos en ServiceCard.astro
      // (pipe | gate | valve | turbine | rack | crane).
      icono: { type: 'text', value: 'pipe' },
      orden: { type: 'number', value: 100 },
      body: { type: 'textarea', value: 'Contenido pendiente de completar.' },
    };
  }
  if (kind === 'proyecto') {
    return {
      nombre: { type: 'text', value: title },
      alcance: { type: 'textarea', value: 'Alcance pendiente de completar.' },
      // Debe ser uno del enum categoriaProyecto en src/content/config.ts.
      categoria: { type: 'text', value: 'tuberias' },
      tipo: { type: 'text', value: 'banco' },
      orden: { type: 'number', value: 100 },
      body: { type: 'textarea', value: 'Contenido pendiente de completar.' },
    };
  }
  return {};
}

export class ContentService {
  constructor(private readonly contentRepository: ContentRepository) {}

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
      type: f.type as 'text' | 'textarea' | 'richtext' | 'image' | 'link' | 'number' | 'list' | 'object',
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

  deleteEntry(id: string): void {
    this.contentRepository.deleteEntry(id);
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

  listEntries(kind?: string) {
    return this.contentRepository.listEntries(kind);
  }

  getEntry(id: string) {
    const entry = this.contentRepository.findEntry(id);
    if (!entry) throw new Error(`Entrada ${id} no encontrada`);
    return entry;
  }

  updateField(entryId: string, key: string, value: unknown, mediaId?: string) {
    return this.contentRepository.updateField(entryId, key, value, new Date().toISOString(), mediaId);
  }
}
