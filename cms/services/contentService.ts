import type { ContentRepository } from '../repositories/ContentRepository';
import { getInitialEntries } from './contentSeed';

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

  listEntries(kind?: string) {
    return this.contentRepository.listEntries(kind);
  }

  getEntry(id: string) {
    const entry = this.contentRepository.findEntry(id);
    if (!entry) throw new Error(`Entrada ${id} no encontrada`);
    return entry;
  }

  updateField(entryId: string, key: string, value: unknown) {
    return this.contentRepository.updateField(entryId, key, value, new Date().toISOString());
  }
}
