/**
 * Fase 1 de la auditoría del 2026-09-28: registros de publicación acotados y
 * respaldos que no se comen las copias de otras herramientas.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate } from '../db/schema';
import { PublishJobRepository } from '../repositories/PublishJobRepository';
import { BackupService } from '../services/backupService';

function base() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

describe('M-07: registros de publicación', () => {
  it('guarda el principio y el final de una salida larga y corta las líneas enormes', () => {
    const repo = new PublishJobRepository(base());
    const job = repo.start({ action: 'publish', now: new Date().toISOString() });
    const lineas = Array.from({ length: 1000 }, (_, i) => `linea ${i}`);
    lineas[500] = 'x'.repeat(5000);
    lineas.push('# terminó en 12 s · código 0');
    const fin = repo.finish({
      id: job.id,
      status: 'succeeded',
      logs: lineas,
      now: new Date().toISOString(),
    });

    expect(fin.logs.length).toBeLessThan(260);
    expect(fin.logs[0]).toBe('linea 0');
    expect(fin.logs.at(-1)).toBe('# terminó en 12 s · código 0');
    expect(fin.logs.some((l) => /línea\(s\) omitida\(s\)/.test(l))).toBe(true);
    expect(Math.max(...fin.logs.map((l) => l.length))).toBeLessThan(600);
  });

  it('poda los trabajos viejos pero conserva la última publicación correcta', () => {
    const db = base();
    const repo = new PublishJobRepository(db);
    const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();
    const crear = (dias: number, action: 'publish' | 'export', status: 'succeeded' | 'failed') => {
      const j = repo.start({ action, now: hace(dias) });
      repo.finish({ id: j.id, status, logs: [], now: hace(dias) });
      return j.id;
    };
    const ultimaCorrecta = crear(200, 'publish', 'succeeded');
    const fallidaVieja = crear(150, 'publish', 'failed');
    const exportViejo = crear(120, 'export', 'succeeded');
    const reciente = crear(1, 'publish', 'failed');
    const enCurso = repo.start({ action: 'publish', now: hace(300) }).id;

    expect(repo.prune(90)).toBe(2);
    const quedan = repo.list(50).map((j) => j.id);
    expect(quedan).toEqual(expect.arrayContaining([ultimaCorrecta, reciente, enCurso]));
    expect(quedan).not.toContain(fallidaVieja);
    expect(quedan).not.toContain(exportViejo);
  });
});

describe('B-09: rotación de respaldos', () => {
  const dirs: string[] = [];
  afterEach(() => dirs.splice(0).forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

  it('solo cuenta y rota los respaldos propios, no las copias antes-de-sync', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-backups-'));
    dirs.push(dir);
    fs.writeFileSync(path.join(dir, 'antes-de-sync-2026-09-01T00-00-00-hidromont-cms.sqlite'), '');
    fs.writeFileSync(path.join(dir, 'hidromont-cms-2026-09-01T00-00-00.sqlite'), '');
    fs.writeFileSync(path.join(dir, 'otra-cosa.sqlite'), '');

    const servicio = new BackupService(base(), dir);
    expect(servicio.listBackups().map((b) => b.file)).toEqual([
      'hidromont-cms-2026-09-01T00-00-00.sqlite',
    ]);
  });
});
