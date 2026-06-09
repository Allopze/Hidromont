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
      logs TEXT NOT NULL,
      created_at TEXT NOT NULL,
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
  `);
}
