import { nanoid } from 'nanoid';
import type Database from 'better-sqlite3';
import { fieldLabel } from '../../src/data/field-labels';
import type { CmsEntry, CmsField, FieldType } from '../types/cms';

interface EntryRow {
  id: string;
  kind: string;
  slug: string;
  locale: string;
  title: string;
  status: 'draft' | 'published';
  version: number;
}

interface FieldRow {
  entry_id: string;
  key: string;
  type: FieldType;
  value_json: string;
  source_ref_json: string | null;
  updated_at: string;
}

// CMS-L5: cap on how many revisions createRevision() keeps per entry, and how
// many listRevisions() ever displays — kept as one constant so they can't
// drift apart.
const MAX_REVISIONS_PER_ENTRY = 50;

export class ContentRepository {
  constructor(private readonly db: Database.Database) {}

  upsertEntry(input: {
    id: string;
    kind: string;
    slug: string;
    locale?: string;
    title: string;
    status?: 'draft' | 'published';
    fields: CmsField[];
    now: string;
  }): void {
    const transaction = this.db.transaction(() => {
      const existing = this.findEntryRow(input.id);
      this.db
        .prepare(
          `INSERT INTO content_entries (id, kind, slug, locale, title, status, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             kind = excluded.kind,
             slug = excluded.slug,
             locale = excluded.locale,
             title = excluded.title,
             status = excluded.status,
             updated_at = excluded.updated_at`
        )
        .run(
          input.id,
          input.kind,
          input.slug,
          input.locale ?? 'es-CL',
          input.title,
          input.status ?? 'published',
          input.now,
          input.now
        );

      for (const field of input.fields) {
        this.upsertField(input.id, field, input.now, false);
      }

      if (!existing) this.createRevision(input.id, 1, input.now);
    });

    transaction();
  }

  /** Create a brand-new entry (throws if id already exists). */
  createEntry(input: {
    id: string;
    kind: string;
    slug: string;
    locale?: string;
    title: string;
    status?: 'draft' | 'published';
    fields: CmsField[];
    now: string;
  }): CmsEntry {
    const existing = this.findEntryRow(input.id);
    if (existing) throw new Error(`Ya existe una entrada con id "${input.id}"`);
    this.assertSlugAvailable(input.kind, input.slug, input.locale ?? 'es-CL');

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO content_entries (id, kind, slug, locale, title, status, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .run(
          input.id,
          input.kind,
          input.slug,
          input.locale ?? 'es-CL',
          input.title,
          input.status ?? 'draft',
          input.now,
          input.now
        );

      for (const field of input.fields) {
        this.upsertField(input.id, field, input.now, false);
      }

      this.createRevision(input.id, 1, input.now);
    });

    transaction();

    const entry = this.findEntry(input.id);
    if (!entry) throw new Error(`Entrada ${input.id} no encontrada tras crear`);
    return entry;
  }

  /** Update entry metadata (title, slug, status). Does not touch fields. */
  updateEntryMeta(
    id: string,
    meta: { title?: string; slug?: string; status?: 'draft' | 'published' },
    now: string
  ): CmsEntry {
    const existing = this.findEntryRow(id);
    if (!existing) throw new Error(`Entrada ${id} no encontrada`);

    const newTitle = meta.title ?? existing.title;
    const newSlug = meta.slug ?? existing.slug;
    const newStatus = meta.status ?? existing.status;

    if (newSlug !== existing.slug) {
      this.assertSlugAvailable(existing.kind, newSlug, existing.locale, id);
    }

    this.db
      .prepare(
        'UPDATE content_entries SET title = ?, slug = ?, status = ?, updated_at = ? WHERE id = ?'
      )
      .run(newTitle, newSlug, newStatus, now, id);

    const entry = this.findEntry(id);
    if (!entry) throw new Error(`Entrada ${id} no encontrada tras actualizar`);
    return entry;
  }

  /** Delete an entry and all its fields and revisions (cascade). */
  deleteEntry(id: string): void {
    const existing = this.findEntryRow(id);
    if (!existing) throw new Error(`Entrada ${id} no encontrada`);
    this.db.prepare('DELETE FROM content_entries WHERE id = ?').run(id);
  }

  /** Insert an entry only if its id does not already exist. Does NOT overwrite fields. */
  insertEntryIfMissing(input: {
    id: string;
    kind: string;
    slug: string;
    locale?: string;
    title: string;
    status?: 'draft' | 'published';
    fields: CmsField[];
    now: string;
  }): boolean {
    const existing = this.findEntryRow(input.id);
    if (existing) return false;
    // C-1: corre en cada arranque desde importMissingEntries(). Con el índice
    // único activo, un choque de slug haría que el INSERT OR IGNORE silenciara
    // la violación y luego contáramos como insertada una entrada inexistente.
    if (
      ContentRepository.isCollectionKind(input.kind) &&
      this.findCollectionEntryBySlug(input.kind, input.slug, input.locale ?? 'es-CL')
    ) {
      return false;
    }

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO content_entries (id, kind, slug, locale, title, status, version, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .run(
          input.id,
          input.kind,
          input.slug,
          input.locale ?? 'es-CL',
          input.title,
          input.status ?? 'published',
          input.now,
          input.now
        );

      for (const field of input.fields) {
        this.db
          .prepare(
            `INSERT OR IGNORE INTO content_fields (entry_id, key, type, value_json, source_ref_json, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            input.id,
            field.key,
            field.type,
            JSON.stringify(field.value),
            field.sourceRef ? JSON.stringify(field.sourceRef) : null,
            input.now
          );
      }

      this.createRevision(input.id, 1, input.now);
    });

    transaction();
    return true;
  }

  /**
   * M-4: inserta los campos del seed que la entrada todavía no tiene, sin
   * tocar los que ya existen.
   *
   * `insertEntryIfMissing` opera a nivel de ENTRADA: si la entrada existe,
   * sale antes de mirar los campos. Así que añadir una clave nueva al seed
   * no llegaba nunca a una base viva, y el único camino alternativo
   * (`importInitialContent`) usa upsert y sobreescribe todo lo editado desde
   * el panel. Ese hueco dejó 11 claves que el frontend pedía y que solo
   * existían como fallback en el código: parecían editables y no lo eran.
   *
   * `INSERT OR IGNORE` sobre la PK (entry_id, key) hace el trabajo: lo que ya
   * está no se toca.
   *
   * @returns cuántos campos se insertaron.
   */
  insertMissingFields(entryId: string, fields: CmsField[], now: string): number {
    if (!this.findEntryRow(entryId)) return 0;

    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO content_fields (entry_id, key, type, value_json, source_ref_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    let inserted = 0;
    this.db.transaction(() => {
      for (const field of fields) {
        const result = insert.run(
          entryId,
          field.key,
          field.type,
          JSON.stringify(field.value),
          field.sourceRef ? JSON.stringify(field.sourceRef) : null,
          now
        );
        inserted += result.changes;
      }
    })();
    return inserted;
  }

  /**
   * M-1: acepta `q` para buscar por título, slug o id.
   *
   * Antes solo paginaba, y el overlay no usaba ni eso: pintaba las 40 entradas
   * de golpe en un panel de 420 px y encontrar un proyecto concreto era
   * recorrer la lista a ojo. Se busca también por id porque es lo que el
   * editor ve junto al título en el listado.
   */
  listEntries(
    kind?: string,
    limit = 100,
    offset = 0,
    q?: string
  ): { entries: CmsEntry[]; total: number } {
    const condiciones: string[] = [];
    const parametros: unknown[] = [];

    if (kind) {
      condiciones.push('kind = ?');
      parametros.push(kind);
    }
    const patron = q?.trim() ? `%${q.trim()}%` : null;
    if (patron) {
      condiciones.push('(title LIKE ? OR slug LIKE ? OR id LIKE ?)');
      parametros.push(patron, patron, patron);
    }
    const where = condiciones.length > 0 ? ` WHERE ${condiciones.join(' AND ')}` : '';

    const total = (
      this.db
        .prepare(`SELECT COUNT(*) as count FROM content_entries${where}`)
        .get(...parametros) as { count: number }
    ).count;

    const rows = this.db
      .prepare(
        `SELECT id, kind, slug, locale, title, status, version FROM content_entries${where}
          ORDER BY id LIMIT ? OFFSET ?`
      )
      .all(...parametros, limit, offset) as EntryRow[];

    return { entries: rows.map((row) => this.hydrateEntry(row)), total };
  }

  findEntry(id: string): CmsEntry | undefined {
    const row = this.findEntryRow(id);
    return row ? this.hydrateEntry(row) : undefined;
  }

  updateField(
    entryId: string,
    key: string,
    value: unknown,
    now: string,
    mediaId?: string,
    expectedVersion?: number
  ): CmsEntry {
    const field = this.findField(entryId, key);
    if (!field) throw new Error(`Field ${entryId}.${key} does not exist`);

    const currentVersion =
      (
        this.db.prepare('SELECT version FROM content_entries WHERE id = ?').get(entryId) as {
          version: number;
        }
      )?.version ?? 1;

    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw new Error(
        `Conflicto de edición: la entrada fue modificada por otro proceso (versión actual: ${currentVersion}, esperada: ${expectedVersion})`
      );
    }

    const nextVersion = currentVersion + 1;

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          'UPDATE content_fields SET value_json = ?, updated_at = ? WHERE entry_id = ? AND key = ?'
        )
        .run(JSON.stringify(value), now, entryId, key);
      this.db
        .prepare('UPDATE content_entries SET version = ?, updated_at = ? WHERE id = ?')
        .run(nextVersion, now, entryId);
      this.createRevision(entryId, nextVersion, now);

      // A-4: registrar qué imagen usa este campo, para poder avisar antes de
      // borrarla. La tabla llevaba vacía desde su creación porque el overlay
      // nunca mandaba `mediaId`, así que `usageCount` era siempre 0 y el CMS
      // no podía decir en qué páginas estaba una foto.
      //
      // Si no llega, se resuelve por ruta: así queda cubierto todo el que
      // escriba un campo de imagen (el editor inline, el formulario de
      // colección, los scripts), no solo quien pase por el selector de medios.
      let resolvedMediaId = mediaId;
      if (!resolvedMediaId && field.type === 'image' && typeof value === 'string' && value) {
        const asset = this.db
          .prepare('SELECT id FROM media_assets WHERE path = ? ORDER BY created_at ASC LIMIT 1')
          .get(value) as { id: string } | undefined;
        resolvedMediaId = asset?.id;
      }

      // Un campo apunta a una sola imagen a la vez. Sin este borrado, cambiar
      // la imagen de A a B dejaba las dos filas y `usageCount` inflaba para
      // siempre.
      this.db
        .prepare('DELETE FROM media_usages WHERE entry_id = ? AND field_key = ?')
        .run(entryId, key);

      if (resolvedMediaId) {
        this.db
          .prepare(
            `INSERT INTO media_usages (media_id, entry_id, field_key, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(media_id, entry_id, field_key) DO UPDATE SET updated_at = excluded.updated_at`
          )
          .run(resolvedMediaId, entryId, key, now);
      }
    });

    transaction();

    const entry = this.findEntry(entryId);
    if (!entry) throw new Error(`Entry ${entryId} disappeared after update`);
    return entry;
  }

  replaceEntryFields(entryId: string, fields: CmsField[], now: string): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare('DELETE FROM content_fields WHERE entry_id = ?').run(entryId);
      for (const field of fields) {
        this.upsertField(entryId, field, now, false);
      }
      this.db
        .prepare('UPDATE content_entries SET version = version + 1, updated_at = ? WHERE id = ?')
        .run(now, entryId);
      const version = (
        this.db.prepare('SELECT version FROM content_entries WHERE id = ?').get(entryId) as {
          version: number;
        }
      ).version;
      this.createRevision(entryId, version, now);
    });

    transaction();
  }

  listRevisions(entryId: string): Array<{ id: string; version: number; createdAt: string }> {
    const rows = this.db
      .prepare(
        'SELECT id, version, created_at FROM revisions WHERE entry_id = ? ORDER BY version DESC LIMIT ?'
      )
      .all(entryId, MAX_REVISIONS_PER_ENTRY) as Array<{
      id: string;
      version: number;
      created_at: string;
    }>;
    return rows.map((r) => ({ id: r.id, version: r.version, createdAt: r.created_at }));
  }

  getRevision(revisionId: string): CmsEntry | undefined {
    const row = this.db
      .prepare('SELECT snapshot_json FROM revisions WHERE id = ?')
      .get(revisionId) as { snapshot_json: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.snapshot_json) as CmsEntry;
  }

  restoreRevision(entryId: string, revisionId: string, now: string): CmsEntry {
    const snapshot = this.getRevision(revisionId);
    if (!snapshot) throw new Error(`Revisión ${revisionId} no encontrada`);
    if (snapshot.id !== entryId)
      throw new Error(`La revisión no pertenece a la entrada ${entryId}`);

    // CMS-L5: previously only restored fields — if the entry was renamed or
    // (un)published after this revision was taken, "restoring" it silently
    // kept the CURRENT slug/status/title, which isn't what an operator
    // reaching for a revision to undo a change would expect.
    this.updateEntryMeta(
      entryId,
      { title: snapshot.title, slug: snapshot.slug, status: snapshot.status },
      now
    );

    const fields: CmsField[] = Object.values(snapshot.fields);
    this.replaceEntryFields(entryId, fields, now);

    const entry = this.findEntry(entryId);
    if (!entry) throw new Error(`Entrada ${entryId} no encontrada tras restaurar`);
    return entry;
  }

  private upsertField(entryId: string, field: CmsField, now: string, bumpVersion: boolean): void {
    this.db
      .prepare(
        `INSERT INTO content_fields (entry_id, key, type, value_json, source_ref_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(entry_id, key) DO UPDATE SET
           type = excluded.type,
           value_json = excluded.value_json,
           source_ref_json = excluded.source_ref_json,
           updated_at = excluded.updated_at`
      )
      .run(
        entryId,
        field.key,
        field.type,
        JSON.stringify(field.value),
        field.sourceRef ? JSON.stringify(field.sourceRef) : null,
        now
      );

    if (bumpVersion) {
      this.db
        .prepare('UPDATE content_entries SET version = version + 1, updated_at = ? WHERE id = ?')
        .run(now, entryId);
    }
  }

  /**
   * C-1: busca otra entrada de la misma colección que reclame este slug.
   *
   * `id` y `slug` son independientes por diseño (el id no cambia aunque el
   * slug se edite, ver pruneStaleCollectionFiles en exportService), pero nada
   * impedía que dos entradas compartieran slug — y como el archivo exportado
   * se nombra por slug, borrar una entrada eliminaba el .md de la otra.
   * Solo aplica a `servicio`/`proyecto`: las entradas de página comparten slug
   * a propósito (34 entradas sobre 9 slugs) porque no se materializan en un
   * archivo propio.
   */
  findCollectionEntryBySlug(
    kind: string,
    slug: string,
    locale: string,
    excludeId?: string
  ): { id: string; title: string } | undefined {
    return this.db
      .prepare(
        `SELECT id, title FROM content_entries
          WHERE kind = ? AND slug = ? AND locale = ? AND id IS NOT ?
          LIMIT 1`
      )
      .get(kind, slug, locale, excludeId ?? null) as { id: string; title: string } | undefined;
  }

  /** C-1: solo las colecciones se materializan en un archivo por slug. */
  private static isCollectionKind(kind: string): boolean {
    return kind === 'servicio' || kind === 'proyecto';
  }

  private assertSlugAvailable(
    kind: string,
    slug: string,
    locale: string,
    excludeId?: string
  ): void {
    if (!ContentRepository.isCollectionKind(kind)) return;
    const clash = this.findCollectionEntryBySlug(kind, slug, locale, excludeId);
    if (clash) {
      throw new Error(
        `Ya existe una entrada de tipo "${kind}" con el slug "${slug}": «${clash.title}» (${clash.id}). Elija otro slug.`
      );
    }
  }

  private findEntryRow(id: string): EntryRow | undefined {
    return this.db
      .prepare(
        'SELECT id, kind, slug, locale, title, status, version FROM content_entries WHERE id = ?'
      )
      .get(id) as EntryRow | undefined;
  }

  private findField(entryId: string, key: string): FieldRow | undefined {
    return this.db
      .prepare(
        'SELECT entry_id, key, type, value_json, source_ref_json, updated_at FROM content_fields WHERE entry_id = ? AND key = ?'
      )
      .get(entryId, key) as FieldRow | undefined;
  }

  private hydrateEntry(row: EntryRow): CmsEntry {
    const fields = this.db
      .prepare(
        'SELECT entry_id, key, type, value_json, source_ref_json, updated_at FROM content_fields WHERE entry_id = ? ORDER BY key'
      )
      .all(row.id) as FieldRow[];

    return {
      id: row.id,
      kind: row.kind,
      slug: row.slug,
      locale: row.locale,
      title: row.title,
      status: row.status,
      version: row.version,
      fields: Object.fromEntries(
        fields.map((field) => [
          field.key,
          {
            key: field.key,
            type: field.type,
            label: fieldLabel(field.key),
            value: JSON.parse(field.value_json),
            sourceRef: field.source_ref_json ? JSON.parse(field.source_ref_json) : undefined,
            updatedAt: field.updated_at,
          },
        ])
      ),
    };
  }

  private createRevision(entryId: string, version: number, now: string): void {
    const snapshot = this.findEntry(entryId);
    if (!snapshot) return;
    this.db
      .prepare(
        'INSERT INTO revisions (id, entry_id, version, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(nanoid(), entryId, version, JSON.stringify(snapshot), now);

    // CMS-L5: every updateField()/replaceEntryFields() call stores a full
    // snapshot of the entry, and nothing ever deleted old ones — an
    // often-edited entry's revision history grew forever. listRevisions()
    // only ever displays the most recent MAX_REVISIONS_PER_ENTRY anyway, so
    // keeping more than that on disk serves no purpose.
    this.db
      .prepare(
        `DELETE FROM revisions
         WHERE entry_id = ?
           AND id NOT IN (
             SELECT id FROM revisions WHERE entry_id = ? ORDER BY version DESC LIMIT ?
           )`
      )
      .run(entryId, entryId, MAX_REVISIONS_PER_ENTRY);
  }
}
