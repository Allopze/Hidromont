import type Database from 'better-sqlite3';

export interface GalleryCategory {
  id: string;
  name: string;
  slug: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/** GAL-19: un álbum de la galería (una obra o proyecto con sus fotos). */
export interface GalleryAlbum {
  slug: string;
  name: string;
  position: number;
  /** Fotos publicadas que lo referencian. Calculado, no almacenado. */
  itemCount: number;
}

export interface GalleryItem {
  id: string;
  mediaId: string | null;
  categoryId: string | null;
  projectSlug: string | null;
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
  // Opcionales: un item huerfano (media_id NULL tras borrar el media, A1-004) no tiene
  // informacion de media asociada hasta que se le reasigne uno.
  mediaPath: string | null;
  mediaMime: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  mediaAlt: string | null;
  mediaFocalX: number | null;
  mediaFocalY: number | null;
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

interface AlbumRow {
  slug: string;
  name: string;
  position: number;
  item_count: number;
}

function fromAlbumRow(row: AlbumRow): GalleryAlbum {
  return {
    slug: row.slug,
    name: row.name,
    position: row.position,
    itemCount: row.item_count,
  };
}

interface ItemRow {
  id: string;
  media_id: string;
  category_id: string | null;
  project_slug: string | null;
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
    projectSlug: row.project_slug ?? null,
    title: row.title,
    alt: row.alt,
    caption: row.caption,
    position: row.position,
    featured: row.featured === 1,
    status: row.status as 'published' | 'draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mediaPath: row.media_path ?? null,
    mediaMime: row.media_mime ?? null,
    mediaWidth: row.media_width ?? null,
    mediaHeight: row.media_height ?? null,
    mediaAlt: row.media_alt ?? null,
    mediaFocalX: row.media_focal_x ?? null,
    mediaFocalY: row.media_focal_y ?? null,
    categorySlug: row.category_slug ?? null,
    categoryName: row.category_name ?? null,
  };
}

export class GalleryRepository {
  constructor(private readonly db: Database.Database) {}

  /**
   * A-5: marca de tiempo más reciente de todo lo que entra en gallery.json,
   * para que el export sea idempotente. Antes el archivo llevaba
   * `new Date()` y cambiaba en cada pasada aunque nada se hubiera editado.
   */
  maxUpdatedAt(): string {
    const row = this.db
      .prepare(
        `SELECT MAX(t) AS max_updated FROM (
           SELECT MAX(updated_at) AS t FROM gallery_items
           UNION ALL SELECT MAX(updated_at) FROM gallery_categories
           UNION ALL SELECT MAX(updated_at) FROM gallery_albums
         )`
      )
      .get() as { max_updated: string | null };
    return row?.max_updated ?? '1970-01-01T00:00:00.000Z';
  }

  // ── Albums (GAL-19) ─────────────────────────────────────────
  //
  // El slug es la clave: es lo que gallery_items.project_slug referencia y lo
  // que el CTA del visor usa para enlazar a /proyectos/<slug>. Por eso no hay
  // `updateSlug`: renombrar el slug rompería esa relación en silencio. Para
  // mover fotos de álbum se cambia project_slug en cada foto, no el álbum.

  listAlbums(): GalleryAlbum[] {
    const rows = this.db
      .prepare(
        `SELECT a.slug, a.name, a.position,
                (SELECT COUNT(*) FROM gallery_items i
                  WHERE i.project_slug = a.slug AND i.status = 'published') AS item_count
           FROM gallery_albums a
          ORDER BY a.position ASC, a.name ASC`
      )
      .all() as AlbumRow[];
    return rows.map(fromAlbumRow);
  }

  getAlbum(slug: string): GalleryAlbum | undefined {
    const row = this.db
      .prepare(
        `SELECT a.slug, a.name, a.position,
                (SELECT COUNT(*) FROM gallery_items i
                  WHERE i.project_slug = a.slug AND i.status = 'published') AS item_count
           FROM gallery_albums a WHERE a.slug = ?`
      )
      .get(slug) as AlbumRow | undefined;
    return row ? fromAlbumRow(row) : undefined;
  }

  createAlbum(input: { slug: string; name: string; position: number; now: string }): GalleryAlbum {
    this.db
      .prepare(
        'INSERT INTO gallery_albums (slug, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(input.slug, input.name, input.position, input.now, input.now);
    return { slug: input.slug, name: input.name, position: input.position, itemCount: 0 };
  }

  updateAlbum(slug: string, input: { name?: string; position?: number; now: string }): void {
    const existing = this.getAlbum(slug);
    if (!existing) throw new Error(`Álbum ${slug} no encontrado`);
    this.db
      .prepare('UPDATE gallery_albums SET name = ?, position = ?, updated_at = ? WHERE slug = ?')
      .run(input.name ?? existing.name, input.position ?? existing.position, input.now, slug);
  }

  /** Solo borra álbumes vacíos: si tuviera fotos, quedarían sin agrupación. */
  deleteAlbum(slug: string): void {
    const album = this.getAlbum(slug);
    if (!album) throw new Error(`Álbum ${slug} no encontrado`);

    // M-3: `itemCount` cuenta solo las publicadas, así que un álbum con todas
    // sus fotos en borrador se borraba y las dejaba con un project_slug que ya
    // no existe. Aquí se cuentan todas.
    const total = (
      this.db
        .prepare('SELECT COUNT(*) AS n FROM gallery_items WHERE project_slug = ?')
        .get(slug) as { n: number }
    ).n;
    if (total > 0) {
      const borradores = total - album.itemCount;
      const detalle =
        borradores > 0 ? ` (${album.itemCount} publicada(s) y ${borradores} en borrador)` : '';
      throw new Error(
        `El álbum "${album.name}" tiene ${total} foto(s)${detalle}. Muévelas o bórralas antes de eliminarlo.`
      );
    }
    this.db.prepare('DELETE FROM gallery_albums WHERE slug = ?').run(slug);
  }

  /** M-3: cuántas fotos quedarían sin categoría al borrarla. */
  /**
   * Los ids de las fotos de una categoría.
   *
   * `countItemsByCategory` solo dice cuántas; para poder devolverlas a su
   * categoría al deshacer hace falta saber cuáles, porque el
   * `ON DELETE SET NULL` las deja indistinguibles de las que nunca tuvieron.
   */
  listItemIdsByCategory(categoryId: string): string[] {
    return (
      this.db
        .prepare('SELECT id FROM gallery_items WHERE category_id = ? ORDER BY position ASC')
        .all(categoryId) as Array<{ id: string }>
    ).map((r) => r.id);
  }

  /** Devuelve una foto a su categoría, solo si sigue sin ninguna. */
  relinkItemCategory(itemId: string, categoryId: string, now: string): boolean {
    // El `AND category_id IS NULL` importa: si el operador recategorizó la
    // foto durante la ventana de deshacer, su decisión es más nueva y manda.
    const r = this.db
      .prepare(
        'UPDATE gallery_items SET category_id = ?, updated_at = ? WHERE id = ? AND category_id IS NULL'
      )
      .run(categoryId, now, itemId);
    return r.changes > 0;
  }

  /** La fila cruda de un álbum, con sus fechas. `getAlbum` no las expone. */
  getAlbumRow(
    slug: string
  ):
    | { slug: string; name: string; position: number; createdAt: string; updatedAt: string }
    | undefined {
    const row = this.db
      .prepare(
        'SELECT slug, name, position, created_at, updated_at FROM gallery_albums WHERE slug = ?'
      )
      .get(slug) as
      | { slug: string; name: string; position: number; created_at: string; updated_at: string }
      | undefined;
    return row
      ? {
          slug: row.slug,
          name: row.name,
          position: row.position,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }
      : undefined;
  }

  /** Reinserta un álbum tal como estaba. */
  restoreAlbum(input: {
    slug: string;
    name: string;
    position: number;
    createdAt: string;
    updatedAt: string;
  }): void {
    this.db
      .prepare(
        'INSERT INTO gallery_albums (slug, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(input.slug, input.name, input.position, input.createdAt, input.updatedAt);
  }

  /** ¿Sigue existiendo este medio? Al restaurar una foto puede haber volado. */
  mediaExists(mediaId: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM media_assets WHERE id = ?').get(mediaId);
  }

  categoryExists(categoryId: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM gallery_categories WHERE id = ?').get(categoryId);
  }

  countItemsByCategory(categoryId: string): number {
    return (
      this.db
        .prepare('SELECT COUNT(*) AS n FROM gallery_items WHERE category_id = ?')
        .get(categoryId) as { n: number }
    ).n;
  }

  reorderAlbums(slugs: string[], now: string): void {
    const update = this.db.prepare(
      'UPDATE gallery_albums SET position = ?, updated_at = ? WHERE slug = ?'
    );
    this.db.transaction(() => {
      slugs.forEach((slug, index) => update.run(index, now, slug));
    })();
  }

  // ── Categories ──────────────────────────────────────────────

  listCategories(): GalleryCategory[] {
    const rows = this.db
      .prepare('SELECT * FROM gallery_categories ORDER BY position ASC')
      .all() as CategoryRow[];
    return rows.map(fromCategoryRow);
  }

  getCategory(id: string): GalleryCategory | undefined {
    const row = this.db.prepare('SELECT * FROM gallery_categories WHERE id = ?').get(id) as
      CategoryRow | undefined;
    return row ? fromCategoryRow(row) : undefined;
  }

  getCategoryBySlug(slug: string): GalleryCategory | undefined {
    const row = this.db.prepare('SELECT * FROM gallery_categories WHERE slug = ?').get(slug) as
      CategoryRow | undefined;
    return row ? fromCategoryRow(row) : undefined;
  }

  createCategory(input: {
    id: string;
    name: string;
    slug: string;
    position: number;
    createdAt: string;
    updatedAt: string;
  }): GalleryCategory {
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
    const stmt = this.db.prepare(
      'UPDATE gallery_categories SET position = ?, updated_at = ? WHERE id = ?'
    );
    const now = new Date().toISOString();
    const txn = this.db.transaction(() => {
      ids.forEach((id, index) => stmt.run(index, now, id));
    });
    txn();
  }

  maxCategoryPosition(): number {
    const row = this.db.prepare('SELECT MAX(position) as maxPos FROM gallery_categories').get() as {
      maxPos: number | null;
    };
    return row.maxPos ?? -1;
  }

  // ── Items ───────────────────────────────────────────────────

  listItems(opts?: { categoryId?: string; status?: string }): GalleryItemWithMedia[] {
    // LEFT JOIN media_assets para que los items huerfanos (media_id NULL tras borrar
    // el media, ver A1-004) sigan visibles en el admin y el operador pueda reasignarles
    // un media. La exportacion (listPublishedForExport) filtra los huerfanos.
    let sql = `
      SELECT gi.*,
             m.path AS media_path, m.mime AS media_mime, m.width AS media_width,
             m.height AS media_height, m.alt AS media_alt, m.focal_x AS media_focal_x,
             m.focal_y AS media_focal_y,
             gc.slug AS category_slug, gc.name AS category_name
      FROM gallery_items gi
      LEFT JOIN media_assets m ON gi.media_id = m.id
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
      .prepare(
        `
        SELECT gi.*,
               m.path AS media_path, m.mime AS media_mime, m.width AS media_width,
               m.height AS media_height, m.alt AS media_alt, m.focal_x AS media_focal_x,
               m.focal_y AS media_focal_y,
               gc.slug AS category_slug, gc.name AS category_name
        FROM gallery_items gi
        LEFT JOIN media_assets m ON gi.media_id = m.id
        LEFT JOIN gallery_categories gc ON gi.category_id = gc.id
        WHERE gi.id = ?
      `
      )
      .get(id) as ItemWithMediaRow | undefined;
    return row ? fromItemWithMediaRow(row) : undefined;
  }

  createItem(input: {
    id: string;
    mediaId: string;
    categoryId?: string | null;
    projectSlug?: string | null;
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
        'INSERT INTO gallery_items (id, media_id, category_id, project_slug, title, alt, caption, position, featured, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        input.id,
        input.mediaId,
        input.categoryId ?? null,
        input.projectSlug ?? null,
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
      projectSlug?: string | null;
      title?: string;
      alt?: string;
      caption?: string | null;
      featured?: boolean;
      status?: 'published' | 'draft';
    }
  ): GalleryItemWithMedia {
    const existing = this.db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(id) as
      ItemRow | undefined;
    if (!existing) throw new Error(`Item ${id} no encontrado`);

    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE gallery_items SET
          media_id = ?, category_id = ?, project_slug = ?, title = ?, alt = ?, caption = ?,
          featured = ?, status = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.mediaId ?? existing.media_id,
        input.categoryId !== undefined ? input.categoryId : existing.category_id,
        input.projectSlug !== undefined ? input.projectSlug : existing.project_slug,
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
    const stmt = this.db.prepare(
      'UPDATE gallery_items SET position = ?, updated_at = ? WHERE id = ?'
    );
    const now = new Date().toISOString();
    const txn = this.db.transaction(() => {
      ids.forEach((id, index) => stmt.run(index, now, id));
    });
    txn();
  }

  maxItemPosition(): number {
    const row = this.db.prepare('SELECT MAX(position) as maxPos FROM gallery_items').get() as {
      maxPos: number | null;
    };
    return row.maxPos ?? -1;
  }

  /** For export: all published items with media details */
  listPublishedForExport(): GalleryItemWithMedia[] {
    return this.listItems({ status: 'published' });
  }
}
