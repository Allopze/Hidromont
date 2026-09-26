import type Database from 'better-sqlite3';

/**
 * P1-03 (auditoría 2026-09): historial de slugs de las fichas de colección y
 * redirecciones que el CMS crea al cambiar una dirección.
 *
 * El export solo conocía dos slugs de cada ficha —el derivado de su id y el
 * actual—, así que un segundo cambio de dirección, o borrar una ficha creada
 * desde el panel, dejaba su `.md` publicado, y el arranque lo reimportaba como
 * ficha nueva. Con el historial, el export poda todo slug que ya no sea el
 * vigente de una ficha publicada, y la importación no resucita lo borrado.
 */
export interface Redirect {
  from: string;
  to: string;
}

export class SlugRepository {
  constructor(private readonly db: Database.Database) {}

  /** Anota que `entryId` usa (o usó) `slug`. Idempotente. */
  record(kind: string, slug: string, entryId: string, now = new Date().toISOString()): void {
    this.db
      .prepare(
        `INSERT INTO collection_slugs (kind, slug, entry_id, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(kind, slug) DO UPDATE SET entry_id = excluded.entry_id`
      )
      .run(kind, slug, entryId, now);
  }

  /** Todos los slugs que ha tenido una ficha, incluido el actual. */
  slugsOf(kind: string, entryId: string): string[] {
    return (
      this.db
        .prepare('SELECT slug FROM collection_slugs WHERE kind = ? AND entry_id = ?')
        .all(kind, entryId) as { slug: string }[]
    ).map((r) => r.slug);
  }

  /** Todos los slugs conocidos de una colección (vigentes, antiguos y de fichas borradas). */
  allSlugs(kind: string): Set<string> {
    return new Set(
      (
        this.db.prepare('SELECT slug FROM collection_slugs WHERE kind = ?').all(kind) as {
          slug: string;
        }[]
      ).map((r) => r.slug)
    );
  }

  /** Registra los slugs vigentes de las fichas existentes (arranque). Idempotente. */
  backfill(): number {
    const antes = (
      this.db.prepare('SELECT COUNT(*) n FROM collection_slugs').get() as { n: number }
    ).n;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO collection_slugs (kind, slug, entry_id, created_at)
         SELECT kind, slug, id, ? FROM content_entries WHERE kind IN ('servicio', 'proyecto')`
      )
      .run(now);
    return (
      (this.db.prepare('SELECT COUNT(*) n FROM collection_slugs').get() as { n: number }).n - antes
    );
  }

  /**
   * Añade `from → to`. Las redirecciones que apuntaban a `from` pasan a
   * apuntar a `to` (sin cadenas), y la que salía de `to` se borra: esa
   * dirección vuelve a ser una página viva.
   */
  addRedirect(from: string, to: string, now = new Date().toISOString()): void {
    if (from === to) return;
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE redirects SET to_path = ? WHERE to_path = ?').run(to, from);
      this.db.prepare('DELETE FROM redirects WHERE from_path = ?').run(to);
      this.db.prepare('DELETE FROM redirects WHERE from_path = to_path').run();
      this.db
        .prepare(
          `INSERT INTO redirects (from_path, to_path, created_at) VALUES (?, ?, ?)
           ON CONFLICT(from_path) DO UPDATE SET to_path = excluded.to_path`
        )
        .run(from, to, now);
    });
    tx();
  }

  /** Una dirección vuelve a tener página: deja de redirigir. */
  removeRedirectFrom(from: string): void {
    this.db.prepare('DELETE FROM redirects WHERE from_path = ?').run(from);
  }

  /** La página de destino ya no existe: sus redirecciones llevarían a un 404. */
  removeRedirectsTo(to: string): void {
    this.db.prepare('DELETE FROM redirects WHERE to_path = ?').run(to);
  }

  listRedirects(): Redirect[] {
    return (
      this.db.prepare('SELECT from_path, to_path FROM redirects').all() as {
        from_path: string;
        to_path: string;
      }[]
    ).map((r) => ({ from: r.from_path, to: r.to_path }));
  }
}
