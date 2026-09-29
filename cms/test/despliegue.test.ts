/**
 * Fase 4 del plan de mejora (auditoría 2026-09-28, M-04): el despliegue
 * compila con el mismo contenido que el servidor da por bueno, y no arranca
 * con una publicación en marcha.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrate } from '../db/schema';
import { ContentRepository } from '../repositories/ContentRepository';
import { PublishJobRepository } from '../repositories/PublishJobRepository';
import { SlugRepository } from '../repositories/SlugRepository';
import { reconciliarBase } from '../services/reconciliacion';
import { createTestApp, type TestApp } from './setup';
import { cerrojoVivo, publicacionEnMarcha } from '../../scripts/publicacion-en-curso.mjs';

describe('reconciliarBase', () => {
  let ctx: TestApp;
  const reconciliar = () =>
    reconciliarBase({
      db: ctx.db,
      contentService: ctx.contentService,
      contentRepository: new ContentRepository(ctx.db),
      slugRepository: new SlugRepository(ctx.db),
      auditRepository: ctx.auditRepository,
    });

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
    ctx.cleanup();
  });

  it('siembra una base vacía y lo dice, y una segunda pasada no cambia nada', () => {
    const primera = reconciliar();
    expect(primera.estabaVacia).toBe(true);
    expect(primera.huboCambios).toBe(true);
    expect(primera.inserted).toBeGreaterThan(0);

    const segunda = reconciliar();
    expect(segunda.estabaVacia).toBe(false);
    expect(segunda.huboCambios).toBe(false);
  });

  it('una base anterior al código recupera las claves nuevas y retira las obsoletas', () => {
    // Una clave que el código nuevo trae y la base vieja no tiene…
    ctx.db
      .prepare("DELETE FROM content_fields WHERE entry_id = 'home.hero' AND key = 'title'")
      .run();
    // …y una ficha que el código ya no lee (ENTRADAS_RETIRADAS).
    ctx.contentService.createEntry({
      id: 'calidad.hero',
      kind: 'page',
      slug: '/calidad',
      title: 'Hero calidad',
    });

    const r = reconciliar();
    expect(r.fieldsInserted).toBeGreaterThanOrEqual(1);
    expect(r.retiradas).toContain('calidad.hero');
    expect(ctx.contentService.getEntry('home.hero').fields.title).toBeDefined();
    expect(reconciliar().huboCambios).toBe(false);
  });
});

describe('publicacion-en-curso.mjs', () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

  it('un cerrojo de un proceso vivo bloquea; uno huérfano, no', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-lock-'));
    dirs.push(dir);
    const lock = path.join(dir, '.build.lock');
    expect(cerrojoVivo(lock)).toBeNull();
    fs.writeFileSync(lock, String(process.pid));
    expect(cerrojoVivo(lock)).toBe(process.pid);
    fs.writeFileSync(lock, '999999999');
    expect(cerrojoVivo(lock)).toBeNull();
  });

  it('una publicación en marcha reciente bloquea; una colgada hace rato, no', () => {
    const db = new Database(':memory:');
    migrate(db);
    const repo = new PublishJobRepository(db);
    expect(publicacionEnMarcha(db, Date.now(), 60_000)).toBeNull();

    const job = repo.start({ action: 'publish', now: new Date().toISOString() });
    expect(publicacionEnMarcha(db, Date.now(), 60_000)).toBe(job.id);
    // Diez minutos después sin actualizarse, con un margen de uno: colgada.
    expect(publicacionEnMarcha(db, Date.now() + 10 * 60_000, 60_000)).toBeNull();
  });
});
