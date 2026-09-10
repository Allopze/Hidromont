/**
 * C-1 — El archivo .md de una colección se nombra por slug, no por id.
 *
 * En auditoría se reprodujo la pérdida real: crear una entrada de prueba con
 * el slug de un proyecto existente y borrarla eliminó
 * `src/content/proyectos/ch-pangal.md`, que pertenecía al proyecto de verdad.
 *
 * El índice único parcial de `migrate()` impide llegar a ese estado desde
 * ahora, pero las bases anteriores pueden tenerlo ya, y la migración no crea
 * el índice cuando detecta duplicados preexistentes. Estos tests cubren esa
 * segunda línea de defensa: se suelta el índice a propósito para simular una
 * base heredada y se comprueba que el borrado respeta el archivo ajeno.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../db/schema';
import { ContentRepository } from '../repositories/ContentRepository';
import { ContentService } from '../services/contentService';

describe('C-1 — borrado de entradas de colección con slug compartido', () => {
  let db: Database.Database;
  let rootDir: string;
  let repo: ContentRepository;
  let service: ContentService;
  let proyectosDir: string;

  const SLUG = 'obra-compartida';

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db);
    // Simula una base anterior al índice único (o una en la que la migración
    // no lo creó por haber encontrado duplicados).
    db.exec('DROP INDEX IF EXISTS idx_content_entries_collection_slug');

    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-c1-'));
    proyectosDir = path.join(rootDir, 'src', 'content', 'proyectos');
    fs.mkdirSync(proyectosDir, { recursive: true });
    fs.writeFileSync(path.join(proyectosDir, `${SLUG}.md`), '---\nnombre: Obra\n---\n');

    repo = new ContentRepository(db);
    service = new ContentService(repo, rootDir);

    const now = new Date().toISOString();
    for (const id of ['proyectos.real', 'proyectos.intruso']) {
      repo.upsertEntry({
        id,
        kind: 'proyecto',
        slug: SLUG,
        locale: 'es-CL',
        title: id,
        status: 'published',
        fields: [{ key: 'nombre', type: 'text', value: 'Obra' }],
        now,
      });
    }
  });

  afterEach(() => {
    db.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('borrar una de las dos entradas conserva el .md que la otra reclama', () => {
    service.deleteEntry('proyectos.intruso');

    expect(repo.findEntry('proyectos.intruso')).toBeUndefined();
    expect(repo.findEntry('proyectos.real')).toBeDefined();
    expect(fs.existsSync(path.join(proyectosDir, `${SLUG}.md`))).toBe(true);
  });

  it('borrar la última entrada que reclama el slug sí elimina el .md', () => {
    service.deleteEntry('proyectos.intruso');
    service.deleteEntry('proyectos.real');

    expect(fs.existsSync(path.join(proyectosDir, `${SLUG}.md`))).toBe(false);
  });

  it('no toca nada fuera de la raíz inyectada', () => {
    // Sin rootDir inyectable, deleteEntry resolvía contra config.rootDir y
    // borraba archivos del repositorio real durante los tests.
    service.deleteEntry('proyectos.intruso');
    service.deleteEntry('proyectos.real');
    expect(
      fs.existsSync(path.join(process.cwd(), 'src', 'content', 'proyectos', `${SLUG}.md`))
    ).toBe(false);
  });
});
