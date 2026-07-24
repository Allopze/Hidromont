/**
 * Tests de regresión para hallazgos de AUDITORIA_LOGICA_UIUX.md:
 *   - A1-004: borrar un media usado por items de galería NO borra los items
 *             (ON DELETE SET NULL → media_id NULL, item preservado).
 *   - A1-009: jobs de publish trabados en 'running' son reapados al arranque.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { createTestApp, type TestApp } from './setup';

function insertMedia(ctx: TestApp, id: string, publicPath = `/uploads/cms/${id}.jpg`): void {
  const now = new Date().toISOString();
  (ctx.db as import('better-sqlite3').Database)
    .prepare(
      `INSERT INTO media_assets (id, name, path, mime, size, alt, focal_x, focal_y, checksum, created_at, updated_at)
       VALUES (?, ?, ?, 'image/jpeg', 2048, 'alt', 0.5, 0.5, 'chk', ?, ?)`
    )
    .run(id, `${id}.jpg`, publicPath, now, now);
}

describe('A1-004 — borrar media NO elimina items de galería (SET NULL)', () => {
  let ctx: TestApp;
  let mediaId: string;
  let categoryId: string;
  let itemId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    // Login valida que el admin funciona (este bloque usa servicios directos, no HTTP).
    await ctx.login();

    mediaId = nanoid();
    insertMedia(ctx, mediaId);

    const cat = ctx.galleryService.createCategory({ name: 'Taller A1-004' });
    categoryId = cat.id;

    const item = ctx.galleryService.createItem({
      mediaId,
      categoryId,
      title: 'Item que sobrevive al borrado de media',
      alt: 'Alt descriptivo',
    });
    itemId = item.id;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('el item existe y referencia el media antes del borrado', () => {
    const item = ctx.galleryRepository.getItem(itemId);
    expect(item).toBeDefined();
    expect(item?.mediaId).toBe(mediaId);
  });

  it('deleteMedia reporta cuántos items quedaran huerfanos', () => {
    const result = ctx.mediaService.deleteMedia(mediaId);
    expect(result.orphanedGalleryItems).toBe(1);
  });

  it('el item sigue existiendo con media_id NULL (no fue borrado en cascada)', () => {
    const row = ctx.db
      .prepare('SELECT media_id FROM gallery_items WHERE id = ?')
      .get(itemId) as { media_id: string | null } | undefined;
    expect(row).toBeDefined();
    expect(row!.media_id).toBeNull();
  });

  it('listItems sigue mostrando el item (LEFT JOIN), ahora como huerfano', () => {
    const items = ctx.galleryRepository.listItems();
    const orphan = items.find((i) => i.id === itemId);
    expect(orphan).toBeDefined();
    expect(orphan!.mediaId).toBeNull();
    expect(orphan!.mediaPath).toBeNull();
  });
});

describe('A1-009 — reap stale publish jobs at startup', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('un job en running con updated_at antiguo se marca failed al reap', () => {
    // Insertar un job 'running' cuya updated_at es de hace 1 hora (> 10 min de umbral).
    const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const jobId = nanoid();
    (ctx.db as import('better-sqlite3').Database)
      .prepare(
        `INSERT INTO publish_jobs (id, status, action, logs, created_at, updated_at, completed_at)
         VALUES (?, 'running', 'publish', ?, ?, ?, NULL)`
      )
      .run(jobId, JSON.stringify(['started']), stale, stale);

    const reaped = ctx.publishJobRepository.reapStaleJobs(new Date().toISOString(), 10 * 60 * 1000);
    expect(reaped).toBe(1);

    const job = ctx.publishJobRepository.find(jobId);
    expect(job?.status).toBe('failed');
    expect(job?.action).toBe('publish');
    expect(job?.completedAt).toBeDefined();
    expect(job?.logs.some((line) => line.includes('crashed: job reaped'))).toBe(true);
  });

  it('un job en running reciente NO se reap (dentro del umbral)', () => {
    const fresh = new Date().toISOString();
    const jobId = nanoid();
    (ctx.db as import('better-sqlite3').Database)
      .prepare(
        `INSERT INTO publish_jobs (id, status, action, logs, created_at, updated_at, completed_at)
         VALUES (?, 'running', 'export', ?, ?, ?, NULL)`
      )
      .run(jobId, JSON.stringify(['started']), fresh, fresh);

    const reaped = ctx.publishJobRepository.reapStaleJobs(new Date().toISOString(), 10 * 60 * 1000);
    expect(reaped).toBe(0);

    const job = ctx.publishJobRepository.find(jobId);
    expect(job?.status).toBe('running');
    expect(job?.action).toBe('export');
  });

  it('reapStaleJobs es idempotente (segunda llamada no reap nada)', () => {
    const before = ctx.publishJobRepository.reapStaleJobs(new Date().toISOString(), 10 * 60 * 1000);
    const after = ctx.publishJobRepository.reapStaleJobs(new Date().toISOString(), 10 * 60 * 1000);
    // La primera puede reap 0 o el residual del test anterior ya reapado; la segunda siempre 0.
    expect(after).toBe(0);
    expect(before).toBeGreaterThanOrEqual(0);
  });
});

describe('A1-011 — importMissingEntries es idempotente', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('la primera llamada inserta entradas seed', () => {
    const first = ctx.contentService.importMissingEntries();
    expect(first.inserted).toBeGreaterThan(0);
  });

  it('la segunda llamada no inserta nada (entradas ya existen)', () => {
    const second = ctx.contentService.importMissingEntries();
    expect(second.inserted).toBe(0);
  });

  it('no sobrescribe ediciones: un campo editado se preserva tras re-import', () => {
    // Tomar una entrada existente y editar su primer campo.
    const entries = ctx.contentService.listEntries();
    const target = entries[0];
    expect(target).toBeDefined();
    const firstFieldKey = Object.keys(target.fields)[0];
    const editedValue = 'VALOR-EDITADO-POR-TEST';

    ctx.contentService.updateField(target.id, firstFieldKey, editedValue);

    // Re-importar no debe sobrescribir el valor editado.
    ctx.contentService.importMissingEntries();
    const after = ctx.contentService.getEntry(target.id);
    const fieldAfter = after.fields[firstFieldKey];
    expect(String(fieldAfter?.value)).toBe(editedValue);
  });
});

