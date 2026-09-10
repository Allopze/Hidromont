/**
 * `media_assets.path` no tenía índice único, así que la misma foto podía
 * registrarse dos veces —y lo estaba, seis veces—. El daño no era la fila de
 * más: el backfill de usos casa por ruta, así que un mismo campo se atribuía a
 * varios `media_id` e inflaba el recuento de usos que el panel muestra antes de
 * dejar borrar una imagen.
 *
 * Se comprueban las dos mitades: que el índice existe y rechaza el duplicado,
 * y que si la base ya trae duplicados la migración avisa y NO crea el índice,
 * porque abortar dejaría al operador sin CMS y sin forma de arreglarlo desde la
 * interfaz.
 */
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '../db/schema';

function nuevaBase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}

function insertarMedia(db: Database.Database, id: string, path: string): void {
  db.prepare(
    `INSERT INTO media_assets (id, name, path, mime, size, checksum, created_at, updated_at)
     VALUES (?, ?, ?, 'image/webp', 1, 'chk', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`
  ).run(id, path.split('/').pop(), path);
}

describe('unicidad de media_assets.path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('el índice único existe tras migrar y rechaza una segunda fila con la misma ruta', () => {
    const db = nuevaBase();
    migrate(db);

    const indices = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='media_assets'")
      .all() as Array<{ name: string }>;
    expect(indices.map((i) => i.name)).toContain('idx_media_assets_path');

    insertarMedia(db, 'uno', '/fotos/catalogo/foto.webp');
    expect(() => insertarMedia(db, 'dos', '/fotos/catalogo/foto.webp')).toThrow(/UNIQUE/i);

    // Y una ruta distinta sí entra: el índice no bloquea el caso normal.
    expect(() => insertarMedia(db, 'tres', '/fotos/catalogo/otra.webp')).not.toThrow();
    db.close();
  });

  it('con duplicados preexistentes avisa, no crea el índice y deja la base usable', () => {
    const db = nuevaBase();
    // Primera migración: crea el esquema. Se borra el índice y se meten los
    // duplicados, que es el estado en el que estaba la base real.
    migrate(db);
    db.exec('DROP INDEX idx_media_assets_path');
    insertarMedia(db, 'uno', '/fotos/catalogo/repetida.webp');
    insertarMedia(db, 'dos', '/fotos/catalogo/repetida.webp');

    const avisos: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      avisos.push(String(chunk));
      return true;
    });

    // Segunda migración: no debe lanzar.
    expect(() => migrate(db)).not.toThrow();

    const texto = avisos.join('');
    expect(texto).toMatch(/registradas más de una vez/i);
    expect(texto).toContain('/fotos/catalogo/repetida.webp');
    // Nombra la herramienta que lo resuelve, no solo el problema.
    expect(texto).toContain('cms:merge-duplicate-media');

    const indices = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='media_assets'")
      .all() as Array<{ name: string }>;
    expect(indices.map((i) => i.name)).not.toContain('idx_media_assets_path');

    // La base sigue consultable: es lo que se protege al no abortar.
    const total = db.prepare('SELECT COUNT(*) AS n FROM media_assets').get() as { n: number };
    expect(total.n).toBe(2);
    db.close();
  });
});
