/**
 * Regresión CMS-002: el export sólo debe escribir contenido publicado.
 * Un borrador (status 'draft') nunca debe aparecer en cms-content.json.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentRepository } from '../repositories/ContentRepository';
import { ExportService } from '../services/exportService';

const SCHEMA_SQL = `
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
  CREATE TABLE IF NOT EXISTS revisions (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (entry_id) REFERENCES content_entries(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS media_usages (
    media_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    field_key TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (media_id, entry_id, field_key)
  );
`;

describe('ExportService — filtro de status (CMS-002)', () => {
  let db: Database.Database;
  let tmpRoot: string;
  let exportService: ExportService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-export-'));
    fs.mkdirSync(path.join(tmpRoot, 'src', 'data'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'src', 'content', 'servicios'), { recursive: true });

    const repo = new ContentRepository(db);
    const now = new Date().toISOString();
    repo.upsertEntry({
      id: 'home.hero',
      kind: 'page',
      slug: '/',
      locale: 'es-CL',
      title: 'Hero publicado',
      status: 'published',
      now,
      fields: [{ key: 'title', type: 'text', value: 'Título publicado' }],
    });
    repo.upsertEntry({
      id: 'home.draft',
      kind: 'page',
      slug: '/',
      locale: 'es-CL',
      title: 'Hero borrador',
      status: 'draft',
      now,
      fields: [{ key: 'title', type: 'text', value: 'Título borrador' }],
    });

    exportService = new ExportService(repo, tmpRoot);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('incluye entradas publicadas y excluye borradores del cms-content.json', async () => {
    await exportService.exportContent();
    const json = JSON.parse(
      fs.readFileSync(path.join(tmpRoot, 'src', 'data', 'cms-content.json'), 'utf-8')
    ) as { entries: Record<string, unknown> };

    expect(json.entries['home.hero']).toBeDefined();
    expect(json.entries['home.draft']).toBeUndefined();
  });
});

describe('ExportService — CMS-3: exporta colecciones publicadas nunca editadas', () => {
  let db: Database.Database;
  let tmpRoot: string;
  let exportService: ExportService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-export-cms3-'));
    fs.mkdirSync(path.join(tmpRoot, 'src', 'data'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'src', 'content', 'proyectos'), { recursive: true });

    const repo = new ContentRepository(db);
    const now = new Date().toISOString();
    // createEntry (not upsertEntry) starts at version 1, matching how a real
    // proyecto/servicio is bulk-imported (contentSeed.ts) or created via the
    // CMS and published without ever individually editing a field afterward.
    repo.createEntry({
      id: 'proj.never-edited',
      kind: 'proyecto',
      slug: 'never-edited',
      locale: 'es-CL',
      title: 'Never Edited',
      status: 'published',
      fields: [{ key: 'nombre', type: 'text', value: 'Never Edited' }],
      now,
    });

    exportService = new ExportService(repo, tmpRoot);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('exporta el .md aunque la entrada siga en version 1', async () => {
    const result = await exportService.exportContent();
    expect(result.files).toContain('src/content/proyectos/never-edited.md');
    expect(
      fs.existsSync(path.join(tmpRoot, 'src', 'content', 'proyectos', 'never-edited.md'))
    ).toBe(true);
  });
});

describe('ExportService — CMS-10: omite entradas de proyecto con categoria/tipo inválidos', () => {
  let db: Database.Database;
  let tmpRoot: string;
  let exportService: ExportService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-export-cms10-'));
    fs.mkdirSync(path.join(tmpRoot, 'src', 'data'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'src', 'content', 'proyectos'), { recursive: true });

    const repo = new ContentRepository(db);
    const now = new Date().toISOString();
    repo.createEntry({
      id: 'proj.bad-categoria',
      kind: 'proyecto',
      slug: 'bad-categoria',
      locale: 'es-CL',
      title: 'Bad Categoria',
      status: 'published',
      fields: [
        { key: 'nombre', type: 'text', value: 'Bad Categoria' },
        { key: 'categoria', type: 'text', value: 'not-a-real-category' },
      ],
      now,
    });
    repo.createEntry({
      id: 'proj.good',
      kind: 'proyecto',
      slug: 'good',
      locale: 'es-CL',
      title: 'Good',
      status: 'published',
      fields: [
        { key: 'nombre', type: 'text', value: 'Good' },
        { key: 'categoria', type: 'text', value: 'tuberias' },
      ],
      now,
    });

    exportService = new ExportService(repo, tmpRoot);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('omite la entrada con categoria invalida sin afectar a las demas', async () => {
    const result = await exportService.exportContent();
    expect(result.files).not.toContain('src/content/proyectos/bad-categoria.md');
    expect(
      fs.existsSync(path.join(tmpRoot, 'src', 'content', 'proyectos', 'bad-categoria.md'))
    ).toBe(false);
    expect(result.files).toContain('src/content/proyectos/good.md');
    expect(fs.existsSync(path.join(tmpRoot, 'src', 'content', 'proyectos', 'good.md'))).toBe(true);
  });
});

describe('ExportService — slugs con subdirectorio (A1-001)', () => {
  let db: Database.Database;
  let tmpRoot: string;
  let exportService: ExportService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-export-subdir-'));
    fs.mkdirSync(path.join(tmpRoot, 'src', 'data'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'src', 'content', 'proyectos'), { recursive: true });

    const repo = new ContentRepository(db);
    const now = new Date().toISOString();
    // Entrada de proyecto con slug que contiene un subdirectorio (`tanques/316l`).
    // El validador admite `/` en slugs; el export debe crear el directorio padre.
    repo.upsertEntry({
      id: 'proj.tanques-316l',
      kind: 'proyecto',
      slug: 'tanques/316l',
      locale: 'es-CL',
      title: 'Tanque 316L',
      status: 'published',
      now,
      fields: [{ key: 'nombre', type: 'text', value: 'Tanque 316L' }],
    });

    exportService = new ExportService(repo, tmpRoot);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('crea el subdirectorio del slug y escribe el .md sin lanzar ENOENT', async () => {
    const result = await exportService.exportContent();
    const expectedFile = path.join(tmpRoot, 'src', 'content', 'proyectos', 'tanques', '316l.md');
    expect(result.files).toContain('src/content/proyectos/tanques/316l.md');
    expect(fs.existsSync(expectedFile)).toBe(true);
    // Atomic write: no debe quedar un .tmp residual.
    expect(fs.existsSync(`${expectedFile}.tmp`)).toBe(false);
  });
});

describe('ExportService — slugs con caracteres especiales (A1-005)', () => {
  // El validador admite `/^[a-z0-9/._-]+$/` (puntos, guiones bajos, barras, guiones).
  // Cubrimos los casos de slug con punto y con guion bajo, que deben escribir un
  // archivo .md con el nombre literal (sin normalizacion).
  let db: Database.Database;
  let tmpRoot: string;
  let exportService: ExportService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-export-special-'));
    fs.mkdirSync(path.join(tmpRoot, 'src', 'data'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'src', 'content', 'servicios'), { recursive: true });

    const repo = new ContentRepository(db);
    const now = new Date().toISOString();
    repo.upsertEntry({
      id: 'srv.tanques.glp',
      kind: 'servicio',
      slug: 'tanques.glp',
      locale: 'es-CL',
      title: 'Tanques GLP',
      status: 'published',
      now,
      fields: [{ key: 'titulo', type: 'text', value: 'Tanques GLP' }],
    });
    repo.upsertEntry({
      id: 'srv.valvula_marca',
      kind: 'servicio',
      slug: 'valvula_marca',
      locale: 'es-CL',
      title: 'Válvula Marca',
      status: 'published',
      now,
      fields: [{ key: 'titulo', type: 'text', value: 'Válvula Marca' }],
    });

    exportService = new ExportService(repo, tmpRoot);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('slug con punto escribe tanques.glp.md literal', async () => {
    const result = await exportService.exportContent();
    expect(result.files).toContain('src/content/servicios/tanques.glp.md');
    expect(fs.existsSync(path.join(tmpRoot, 'src', 'content', 'servicios', 'tanques.glp.md'))).toBe(
      true
    );
  });

  it('slug con guion bajo escribe valvula_marca.md literal', async () => {
    const result = await exportService.exportContent();
    expect(result.files).toContain('src/content/servicios/valvula_marca.md');
    expect(
      fs.existsSync(path.join(tmpRoot, 'src', 'content', 'servicios', 'valvula_marca.md'))
    ).toBe(true);
  });
});

/**
 * A-5 — El export debe ser idempotente.
 *
 * Un `POST /api/cms/publish` sobre un árbol limpio producía
 * `15 files changed, 246 insertions(+), 223 deletions(-)` sin haber editado
 * nada: los dos JSON llevaban `new Date()`, y el frontmatter se reordenaba
 * porque su orden lo decidía el `ORDER BY key` del repositorio en vez del
 * exportador. El ruido enterraba los cambios de verdad en el diff.
 */
describe('ExportService — idempotencia (A-5)', () => {
  let db: Database.Database;
  let tmpRoot: string;
  let exportService: ExportService;

  function snapshotTree(dir: string): Map<string, string> {
    const out = new Map<string, string>();
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) walk(full);
        else out.set(path.relative(dir, full), fs.readFileSync(full, 'utf-8'));
      }
    };
    walk(dir);
    return out;
  }

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-export-idem-'));
    fs.mkdirSync(path.join(tmpRoot, 'src', 'data'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'src', 'content', 'proyectos'), { recursive: true });

    const repo = new ContentRepository(db);
    const now = new Date().toISOString();

    // Se siembra un caso que ejercita las tres causas observadas: claves en
    // orden no alfabético, un valor que dispara el entrecomillado de js-yaml
    // y un texto largo con acentos que fuerza el plegado en bloque `>-`.
    repo.upsertEntry({
      id: 'proyectos.idempotente',
      kind: 'proyecto',
      slug: 'idempotente',
      locale: 'es-CL',
      title: 'Obra idempotente',
      status: 'published',
      now,
      fields: [
        { key: 'nombre', type: 'text', value: 'Obra idempotente' },
        { key: 'longitud', type: 'text', value: '1.200 m, incluidos 132 m en pique' },
        {
          key: 'alcance',
          type: 'textarea',
          value:
            'Reparación y sustitución de tuberías forzadas Ø 1.000 y Ø 700. Ingeniería, ' +
            'suministro, fabricación y montaje para la reparación de tramos existentes.',
        },
        { key: 'categoria', type: 'text', value: 'tuberias' },
        { key: 'tipo', type: 'text', value: 'banco' },
        { key: 'orden', type: 'number', value: 25 },
      ],
    });
    repo.upsertEntry({
      id: 'home.hero',
      kind: 'page',
      slug: '/',
      locale: 'es-CL',
      title: 'Hero',
      status: 'published',
      now,
      fields: [{ key: 'title', type: 'text', value: 'Título' }],
    });

    exportService = new ExportService(repo, tmpRoot);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('una segunda exportación no cambia ningún byte', async () => {
    await exportService.exportContent();
    const primera = snapshotTree(tmpRoot);
    expect(primera.size).toBeGreaterThan(0);

    await exportService.exportContent();
    const segunda = snapshotTree(tmpRoot);

    const distintos = [...segunda.keys()].filter((f) => segunda.get(f) !== primera.get(f));
    expect(distintos).toEqual([]);
  });

  it('el frontmatter sale en orden canónico, no en el que llegó', async () => {
    await exportService.exportContent();
    const md = fs.readFileSync(
      path.join(tmpRoot, 'src', 'content', 'proyectos', 'idempotente.md'),
      'utf-8'
    );
    const claves = [...md.matchAll(/^([a-z]+):/gm)].map((m) => m[1]);
    expect(claves).toEqual([...claves].sort());
  });

  it('un campo editado llega al .md exportado', async () => {
    await exportService.exportContent();
    const repo = new ContentRepository(db);
    repo.updateField('proyectos.idempotente', 'nombre', 'Nombre Editado', new Date().toISOString());
    await exportService.exportContent();

    const md = fs.readFileSync(
      path.join(tmpRoot, 'src', 'content', 'proyectos', 'idempotente.md'),
      'utf-8'
    );
    expect(md).toContain('nombre: Nombre Editado');
  });
});
