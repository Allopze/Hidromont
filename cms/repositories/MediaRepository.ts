import type Database from 'better-sqlite3';

export interface MediaAsset {
  id: string;
  name: string;
  path: string;
  mime: string;
  width?: number;
  height?: number;
  size: number;
  alt?: string;
  focalX: number;
  focalY: number;
  checksum: string;
  createdAt: string;
  updatedAt: string;
}

interface MediaRow {
  id: string;
  name: string;
  path: string;
  mime: string;
  width: number | null;
  height: number | null;
  size: number;
  alt: string | null;
  focal_x: number;
  focal_y: number;
  checksum: string;
  created_at: string;
  updated_at: string;
}

export class MediaRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: MediaAsset): MediaAsset {
    this.db
      .prepare(
        `INSERT INTO media_assets
          (id, name, path, mime, width, height, size, alt, focal_x, focal_y, checksum, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.id,
        input.name,
        input.path,
        input.mime,
        input.width ?? null,
        input.height ?? null,
        input.size,
        input.alt ?? null,
        input.focalX,
        input.focalY,
        input.checksum,
        input.createdAt,
        input.updatedAt
      );
    return input;
  }

  upsertByPath(input: MediaAsset): MediaAsset {
    const existing = this.findByPath(input.path);
    if (existing) return existing;
    return this.create(input);
  }

  /**
   * @param tipo `imagen` o `video`: el selector de un campo de imagen no debe
   *   ofrecer videos, ni al revés. Sin él, todo (la pestaña Biblioteca).
   */
  list(
    limit = 100,
    offset = 0,
    q?: string,
    tipo?: 'imagen' | 'video'
  ): { items: (MediaAsset & { usageCount: number })[]; total: number } {
    const condiciones: string[] = [];
    const parametros: unknown[] = [];
    if (q) {
      const patron = `%${q}%`;
      condiciones.push('(m.name LIKE ? OR m.alt LIKE ? OR m.path LIKE ?)');
      parametros.push(patron, patron, patron);
    }
    if (tipo) {
      condiciones.push('m.mime LIKE ?');
      parametros.push(tipo === 'video' ? 'video/%' : 'image/%');
    }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const total = (
      this.db
        .prepare(`SELECT COUNT(*) as count FROM media_assets m ${where}`)
        .get(...parametros) as { count: number }
    ).count;

    const rows = this.db
      .prepare(
        `SELECT m.*, COUNT(u.media_id) AS usage_count
         FROM media_assets m
         LEFT JOIN media_usages u ON m.id = u.media_id
         ${where}
         GROUP BY m.id
         ORDER BY m.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...parametros, limit, offset) as (MediaRow & { usage_count: number })[];

    return {
      items: rows.map((row) => ({ ...this.fromRow(row), usageCount: row.usage_count })),
      total,
    };
  }

  find(id: string): MediaAsset | undefined {
    const row = this.db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id) as
      MediaRow | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  getUsages(mediaId: string): Array<{ entryId: string; fieldKey: string; updatedAt: string }> {
    return (
      this.db
        .prepare(
          'SELECT entry_id, field_key, updated_at FROM media_usages WHERE media_id = ? ORDER BY updated_at DESC'
        )
        .all(mediaId) as Array<{ entry_id: string; field_key: string; updated_at: string }>
    ).map((r) => ({ entryId: r.entry_id, fieldKey: r.field_key, updatedAt: r.updated_at }));
  }

  /** A1-004: cuenta cuantos items de galeria referencian un media (para advertir antes de borrar). */
  countGalleryItemsByMedia(mediaId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM gallery_items WHERE media_id = ?')
      .get(mediaId) as { n: number };
    return row?.n ?? 0;
  }

  findByPath(assetPath: string): MediaAsset | undefined {
    const row = this.db.prepare('SELECT * FROM media_assets WHERE path = ?').get(assetPath) as
      MediaRow | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  update(input: {
    id: string;
    alt?: string;
    focalX?: number;
    focalY?: number;
    now: string;
  }): MediaAsset {
    const existing = this.find(input.id);
    if (!existing) throw new Error(`Media asset ${input.id} not found`);

    this.db
      .prepare(
        'UPDATE media_assets SET alt = ?, focal_x = ?, focal_y = ?, updated_at = ? WHERE id = ?'
      )
      .run(
        input.alt ?? existing.alt ?? null,
        input.focalX ?? existing.focalX,
        input.focalY ?? existing.focalY,
        input.now,
        input.id
      );

    const updated = this.find(input.id);
    if (!updated) throw new Error(`Media asset ${input.id} disappeared after update`);
    return updated;
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM media_assets WHERE id = ?').run(id);
  }

  private fromRow(row: MediaRow): MediaAsset {
    return {
      id: row.id,
      name: row.name,
      path: row.path,
      mime: row.mime,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      size: row.size,
      alt: row.alt ?? undefined,
      focalX: row.focal_x,
      focalY: row.focal_y,
      checksum: row.checksum,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
