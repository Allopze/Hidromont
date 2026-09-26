/**
 * P3-08 (auditoría 2026-09): derivados huérfanos, respaldos con sesiones y sin
 * rotación, y la ficha `galeria.items` que avisaba en cada publicación.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, describe, expect, it } from 'vitest';
import { migrate } from '../db/schema';
import { ContentRepository } from '../repositories/ContentRepository';
import { BackupService } from '../services/backupService';
import { ENTRADAS_RETIRADAS } from '../services/contentService';
import { ExportService } from '../services/exportService';

const temporales: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-residuos-'));
  temporales.push(d);
  return d;
};
afterAll(() => temporales.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

describe('P3-08: derivados sin referencia', () => {
  it('se borran los que no cita ningún export, y solo esos', () => {
    const raiz = tmp();
    const derivados = path.join(raiz, 'public', 'gallery', 'derived');
    fs.mkdirSync(derivados, { recursive: true });
    fs.mkdirSync(path.join(raiz, 'src', 'data'), { recursive: true });
    for (const n of ['aaaaaaaa-640.webp', 'bbbbbbbb-640.webp', 'cccccccc-360.webp', 'nota.txt']) {
      fs.writeFileSync(path.join(derivados, n), 'x');
    }
    fs.writeFileSync(
      path.join(raiz, 'src/data/gallery.json'),
      JSON.stringify({ items: [{ srcset: '/gallery/derived/aaaaaaaa-640.webp 640w' }] })
    );
    fs.writeFileSync(
      path.join(raiz, 'src/data/cms-content.json'),
      JSON.stringify({ src: '/gallery/derived/cccccccc-360.webp' })
    );
    const db = new Database(':memory:');
    migrate(db);
    const { removed } = new ExportService(new ContentRepository(db), raiz).pruneOrphanDerivatives();
    expect(removed).toEqual(['bbbbbbbb-640.webp']);
    expect(fs.readdirSync(derivados).sort()).toEqual([
      'aaaaaaaa-640.webp',
      'cccccccc-360.webp',
      'nota.txt',
    ]);
  });

  it('si ningún export cita nada, no borra (algo falló al exportar)', () => {
    const raiz = tmp();
    const derivados = path.join(raiz, 'public', 'gallery', 'derived');
    fs.mkdirSync(derivados, { recursive: true });
    fs.writeFileSync(path.join(derivados, 'aaaaaaaa-640.webp'), 'x');
    const db = new Database(':memory:');
    migrate(db);
    expect(
      new ExportService(new ContentRepository(db), raiz).pruneOrphanDerivatives().removed
    ).toEqual([]);
  });
});

describe('P3-08: respaldos', () => {
  it('la copia no lleva sesiones y se conservan las 20 más recientes', async () => {
    const dir = tmp();
    const db = new Database(path.join(dir, 'base.sqlite'));
    migrate(db);
    const ahora = new Date().toISOString();
    db.prepare(
      'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run('u', 'a@b.cl', 'x', ahora, ahora);
    db.prepare(
      'INSERT INTO sessions (id, user_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('s', 'u', 't', '2099-01-01', ahora);
    const respaldos = path.join(dir, 'respaldos');
    fs.mkdirSync(respaldos);
    for (let i = 0; i < 22; i++) {
      const f = path.join(
        respaldos,
        `hidromont-cms-2026-01-${String(i + 1).padStart(2, '0')}T00-00-00.sqlite`
      );
      fs.writeFileSync(f, '');
      const t = new Date(2026, 0, i + 1);
      fs.utimesSync(f, t, t);
    }
    const servicio = new BackupService(db, respaldos);
    const { file } = await servicio.createBackup();
    const copia = new Database(file, { readonly: true });
    expect((copia.prepare('SELECT COUNT(*) n FROM sessions').get() as { n: number }).n).toBe(0);
    expect((copia.prepare('SELECT COUNT(*) n FROM users').get() as { n: number }).n).toBe(1);
    copia.close();
    const lista = servicio.listBackups();
    expect(lista).toHaveLength(20);
    expect(lista[0].file).toBe(path.basename(file));
    db.close();
  });

  it('solo se descargan respaldos por su nombre, sin salir de la carpeta', () => {
    const servicio = new BackupService(new Database(':memory:'), tmp());
    expect(servicio.rutaDeRespaldo('../base.sqlite')).toBeNull();
    expect(servicio.rutaDeRespaldo('hidromont-cms-2026-01-01T00-00-00.sqlite')).toBeNull();
  });
});

describe('P3-08: galeria.items', () => {
  it('se retira como ficha sin uso', () => {
    expect(ENTRADAS_RETIRADAS).toContain('galeria.items');
  });
});
