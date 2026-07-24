import { getDb } from './connection';

export function migrate(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      csrf_token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS content_entries (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      slug TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'es-CL',
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_fields (
      entry_id TEXT NOT NULL,
      key TEXT NOT NULL,
      type TEXT NOT NULL,
      value_json TEXT NOT NULL,
      source_ref_json TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (entry_id, key),
      FOREIGN KEY (entry_id) REFERENCES content_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      mime TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      size INTEGER NOT NULL,
      alt TEXT,
      focal_x REAL DEFAULT 0.5,
      focal_y REAL DEFAULT 0.5,
      checksum TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (entry_id) REFERENCES content_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS publish_jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      action TEXT NOT NULL DEFAULT 'publish',
      logs TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      data_json TEXT,
      ip TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      ip TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0,
      reset_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_usages (
      media_id TEXT NOT NULL,
      entry_id TEXT NOT NULL,
      field_key TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (media_id, entry_id, field_key),
      FOREIGN KEY (media_id) REFERENCES media_assets(id) ON DELETE CASCADE,
      FOREIGN KEY (entry_id) REFERENCES content_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gallery_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery_items (
      id TEXT PRIMARY KEY,
      media_id TEXT,
      category_id TEXT,
      title TEXT NOT NULL,
      alt TEXT NOT NULL,
      caption TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (media_id) REFERENCES media_assets(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES gallery_categories(id) ON DELETE SET NULL
    );
  `);

  // A1-004: migrar bases de datos existentes del esquema anterior (media_id NOT NULL
  // + ON DELETE CASCADE) al nuevo (media_id NULLABLE + ON DELETE SET NULL). SQLite no
  // soporta ALTER para cambiar NOT NULL ni la accion ON DELETE de una FK, asi que se
  // recrea la tabla. Es idempotente: si ya esta migrada, no hace nada.
  migrateGalleryItemsOnDeleteSetNull(db);

  // A1-009: anade la columna updated_at a publish_jobs para soportar reap de jobs
  // trabados en 'running' tras un crash. Idempotente.
  migratePublishJobsUpdatedAt(db);

  // A1-010: anade la columna action a publish_jobs (antes la accion iba serializada
  // dentro del JSON de logs, dificultando queries como "ultima publicacion exitosa").
  // Idempotente.
  migratePublishJobsAction(db);
}

/**
 * Migracion A1-004: convierte gallery_items.media_id de `NOT NULL ... ON DELETE CASCADE`
 * a `NULL ... ON DELETE SET NULL`. Antes, borrar un media_asset usado por items de
 * galeria borraba los items en cascada (perdida silenciosa de contenido). Ahora los
 * items se conservan con media_id=NULL y se excluyen de la exportacion hasta que se
 * les reasigne un media valido.
 *
 * Idempotente: detecta via pragma si la FK actual ya es SET NULL y salta.
 */
function migrateGalleryItemsOnDeleteSetNull(db: ReturnType<typeof getDb>): void {
  // Usar PRAGMA (no la forma funcioń pragma_*) para evitar el parser de comillas.
  // pragma_foreign_key_list devuelve una fila por FK con columna "on_delete".
  const fk = db
    .prepare('PRAGMA foreign_key_list(gallery_items)')
    .all() as Array<{ on_delete: string | null; table: string | null }>;

  // Buscar la FK cuya tabla referenciada sea media_assets. Si ya es SET NULL, nada que hacer.
  const mediaFk = fk.find((row) => row.table === 'media_assets');
  if (!mediaFk) return;
  if (mediaFk.on_delete === 'SET NULL') return;

  db.exec(`
    BEGIN;
    CREATE TABLE gallery_items_new (
      id TEXT PRIMARY KEY,
      media_id TEXT,
      category_id TEXT,
      title TEXT NOT NULL,
      alt TEXT NOT NULL,
      caption TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (media_id) REFERENCES media_assets(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES gallery_categories(id) ON DELETE SET NULL
    );
    INSERT INTO gallery_items_new (id, media_id, category_id, title, alt, caption, position, featured, status, created_at, updated_at)
      SELECT id, media_id, category_id, title, alt, caption, position, featured, status, created_at, updated_at FROM gallery_items;
    DROP TABLE gallery_items;
    ALTER TABLE gallery_items_new RENAME TO gallery_items;
    COMMIT;
  `);
}

/**
 * Migracion A1-009: anade la columna updated_at a publish_jobs para poder detectar
 * jobs trabados en 'running' tras un crash del proceso. Idempotente.
 */
function migratePublishJobsUpdatedAt(db: ReturnType<typeof getDb>): void {
  const cols = db.prepare('PRAGMA table_info(publish_jobs)').all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === 'updated_at')) return;
  // Backfill: los jobs existentes toman created_at como updated_at (mejor que nada).
  db.exec(`ALTER TABLE publish_jobs ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
           UPDATE publish_jobs SET updated_at = created_at WHERE updated_at = '';`);
}

/**
 * Migracion A1-010: anade la columna action a publish_jobs y backfilla desde el
 * JSON de logs existente (campo `action` dentro del blob) para no perder el tipo de
 * los jobs historicos. Idempotente.
 */
function migratePublishJobsAction(db: ReturnType<typeof getDb>): void {
  const cols = db.prepare('PRAGMA table_info(publish_jobs)').all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === 'action')) return;
  db.exec(`ALTER TABLE publish_jobs ADD COLUMN action TEXT NOT NULL DEFAULT 'publish';`);
  // Backfill: intentar leer action del JSON de logs; si falla, queda 'publish' (default).
  const rows = db.prepare('SELECT id, logs FROM publish_jobs').all() as Array<{ id: string; logs: string }>;
  const update = db.prepare('UPDATE publish_jobs SET action = ? WHERE id = ?');
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.logs) as { action?: string } | string[];
      const action = Array.isArray(parsed) ? 'publish' : (parsed.action === 'export' ? 'export' : 'publish');
      update.run(action, row.id);
    } catch {
      // logs corrupto: deja el default 'publish'.
    }
  }
}
