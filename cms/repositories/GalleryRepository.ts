import type Database from 'better-sqlite3';

export interface GalleryCategory {
  id: string;
  name: string;
  slug: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryItem {
  id: string;
  mediaId: string;
  categoryId: string | null;
  title: string;
  alt: string;
  caption: string | null;
  position: number;
  featured: boolean;
  status: 'published' | 'draft';
  createdAt: string;
  updatedAt: string;
}

export interface GalleryItemWithMedia extends GalleryItem {
  mediaPath: string;
  mediaMime: string;
  mediaWidth: number | null;
  mediaHeight: number | null;
  mediaAlt: string | null;
  mediaFocalX: number;
  mediaFocalY: number;
  categorySlug: string | null;
  categoryName: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: string;
  media_id: string;
  category_id: string | null;
  title: string;
  alt: string;
  caption: string | null;
  position: number;
  featured: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ItemWithMediaRow extends ItemRow {
  media_path: string;
  media_mime: string;
  media_width: number | null;
  media_height: number | null;
  media_alt: string | null;
  media_focal_x: number;
  media_focal_y: number;
  category_slug: string | null;
  category_name: string | null;
}

function fromCategoryRow(row: CategoryRow): GalleryCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromItemWithMediaRow(row: ItemWithMediaRow): GalleryItemWithMedia {
  return {
    id: row.id,
    mediaId: row.media_id,
    categoryId: row.category_id,
    title: row.title,
    alt: row.alt,
    caption: row.caption,
    position: row.position,
    featured: row.featured === 1,
    status: row.status as 'published' | 'draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mediaPath: row.media_path,
    mediaMime: row.media_mime,
    mediaWidth: row.media_width,
    mediaHeight: row.media_height,
    mediaAlt: row.media_alt,
    mediaFocalX: row.media_focal_x,
    mediaFocalY: row.media_focal_y,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
  };
}

export class GalleryRepository {
  constructor(private readonly db: Database.Database) {}

  // ── Categories ──────────────────────────────────────────────

  listCategories(): GalleryCategory[] {
    const rows = this.db
      .prepare('SELECT * FROM gallery_categories ORDER BY position ASC')
      .all() as CategoryRow[];
    return rows.map(fromCategoryRow);
  }

  getCategory(id: string): GalleryCategory | undefined {
    const row = this.db
      .prepare('SELECT * FROM gallery_categories WHERE id = ?')
      .get(id) as CategoryRow | undefined;
    return row ? fromCategoryRow(row) : undefined;
  }

  getCategoryBySlug(slug: string): GalleryCategory | undefined {
    const row = this.db
      .prepare('SELECT * FROM gallery_categories WHERE slug = ?')
      .get(slug) as CategoryRow | undefined;
    return row ? fromCategoryRow(row) : undefined;
  }

  createCategory(input: { id: string; name: string; slug: string; position: number; createdAt: string; updatedAt: string }): GalleryCategory {
    this.db
      .prepare(
        'INSERT INTO gallery_categories (id, name, slug, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(input.id, input.name, input.slug, input.position, input.createdAt, input.updatedAt);
    return input;
  }

  updateCategory(id: string, input: { name?: string; slug?: string }): GalleryCategory {
    const existing = this.getCategory(id);
    if (!existing) throw new Error(`Categoría ${id} no encontrada`);

    const name = input.name ?? existing.name;
    const slug = input.slug ?? existing.slug;
    const updatedAt = new Date().toISOString();

    this.db
      .prepare('UPDATE gallery_categories SET name = ?, slug = ?, updated_at = ? WHERE id = ?')
      .run(name, slug, updatedAt, id);

    return { ...existing, name, slug, updatedAt };
  }

  deleteCategory(id: string): void {
    this.db.prepare('DELETE FROM gallery_categories WHERE id = ?').run(id);
  }

  reorderCategories(ids: string[]): void {
    const stmt = this.db.prepare('UPDATE gallery_categories SET position = ?, updated_at = ? WHERE id = ?');
    const now = new Date().toISOString();
    const txn = this.db.transaction(() => {
      ids.forEach((id, index) => stmt.run(index, now, id));
    });
    txn();
  }

  maxCategoryPosition(): number {
    const row = this.db.prepare('SELECT MAX(position) as maxPos FROM gallery_categories').get() as { maxPos: number | null };
    return row.maxPos ?? -1;
  }

  // ── Items ───────────────────────────────────────────────────

  listItems(opts?: { categoryId?: string; status?: string }): GalleryItemWithMedia[] {
    let sql = `
      SELECT gi.*,
             m.path AS media_path, m.mime AS media_mime, m.width AS media_width,
             m.height AS media_height, m.alt AS media_alt, m.focal_x AS media_focal_x,
             m.focal_y AS media_focal_y,
             gc.slug AS category_slug, gc.name AS category_name
      FROM gallery_items gi
      JOIN media_assets m ON gi.media_id = m.id
      LEFT JOIN gallery_categories gc ON gi.category_id = gc.id
    `;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (opts?.categoryId) {
      conditions.push('gi.category_id = ?');
      params.push(opts.categoryId);
    }
    if (opts?.status) {
      conditions.push('gi.status = ?');
      params.push(opts.status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY gi.position ASC, gi.created_at DESC';

    const rows = this.db.prepare(sql).all(...params) as ItemWithMediaRow[];
    return rows.map(fromItemWithMediaRow);
  }

  getItem(id: string): GalleryItemWithMedia | undefined {
    const row = this.db
      .prepare(`
        SELECT gi.*,
               m.path AS media_path, m.mime AS media_mime, m.width AS media_width,
               m.height AS media_height, m.alt AS media_alt, m.focal_x AS media_focal_x,
               m.focal_y AS media_focal_y,
               gc.slug AS category_slug, gc.name AS category_name
        FROM gallery_items gi
        JOIN media_assets m ON gi.media_id = m.id
        LEFT JOIN gallery_categories gc ON gi.category_id = gc.id
        WHERE gi.id = ?
      `)
      .get(id) as ItemWithMediaRow | undefined;
    return row ? fromItemWithMediaRow(row) : undefined;
  }

  createItem(input: {
    id: string;
    mediaId: string;
    categoryId?: string | null;
    title: string;
    alt: string;
    caption?: string | null;
    position: number;
    featured: boolean;
    status: 'published' | 'draft';
    createdAt: string;
    updatedAt: string;
  }): GalleryItemWithMedia {
    this.db
      .prepare(
        'INSERT INTO gallery_items (id, media_id, category_id, title, alt, caption, position, featured, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.id,
        input.mediaId,
        input.categoryId ?? null,
        input.title,
        input.alt,
        input.caption ?? null,
        input.position,
        input.featured ? 1 : 0,
        input.status,
        input.createdAt,
        input.updatedAt
      );

    const item = this.getItem(input.id);
    if (!item) throw new Error('Error al crear item de galería');
    return item;
  }

  updateItem(
    id: string,
    input: {
      mediaId?: string;
      categoryId?: string | null;
      title?: string;
      alt?: string;
      caption?: string | null;
      featured?: boolean;
      status?: 'published' | 'draft';
    }
  ): GalleryItemWithMedia {
    const existing = this.db
      .prepare('SELECT * FROM gallery_items WHERE id = ?')
      .get(id) as ItemRow | undefined;
    if (!existing) throw new Error(`Item ${id} no encontrado`);

    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE gallery_items SET
          media_id = ?, category_id = ?, title = ?, alt = ?, caption = ?,
          featured = ?, status = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.mediaId ?? existing.media_id,
        input.categoryId !== undefined ? input.categoryId : existing.category_id,
        input.title ?? existing.title,
        input.alt ?? existing.alt,
        input.caption !== undefined ? input.caption : existing.caption,
        input.featured !== undefined ? (input.featured ? 1 : 0) : existing.featured,
        input.status ?? existing.status,
        updatedAt,
        id
      );

    const item = this.getItem(id);
    if (!item) throw new Error('Error al actualizar item de galería');
    return item;
  }

  deleteItem(id: string): void {
    this.db.prepare('DELETE FROM gallery_items WHERE id = ?').run(id);
  }

  reorderItems(ids: string[]): void {
    const stmt = this.db.prepare('UPDATE gallery_items SET position = ?, updated_at = ? WHERE id = ?');
    const now = new Date().toISOString();
    const txn = this.db.transaction(() => {
      ids.forEach((id, index) => stmt.run(index, now, id));
    });
    txn();
  }

  maxItemPosition(): number {
    const row = this.db.prepare('SELECT MAX(position) as maxPos FROM gallery_items').get() as { maxPos: number | null };
    return row.maxPos ?? -1;
  }

  /** For export: all published items with media details */
  listPublishedForExport(): GalleryItemWithMedia[] {
    return this.listItems({ status: 'published' });
  }
}
