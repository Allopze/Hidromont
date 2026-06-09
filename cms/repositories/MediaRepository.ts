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

  list(): MediaAsset[] {
    return (this.db.prepare('SELECT * FROM media_assets ORDER BY created_at DESC').all() as MediaRow[]).map(
      (row) => this.fromRow(row)
    );
  }

  find(id: string): MediaAsset | undefined {
    const row = this.db.prepare('SELECT * FROM media_assets WHERE id = ?').get(id) as MediaRow | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  findByPath(assetPath: string): MediaAsset | undefined {
    const row = this.db.prepare('SELECT * FROM media_assets WHERE path = ?').get(assetPath) as MediaRow | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  update(input: { id: string; alt?: string; focalX?: number; focalY?: number; now: string }): MediaAsset {
    const existing = this.find(input.id);
    if (!existing) throw new Error(`Media asset ${input.id} not found`);

    this.db
      .prepare('UPDATE media_assets SET alt = ?, focal_x = ?, focal_y = ?, updated_at = ? WHERE id = ?')
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
