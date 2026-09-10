import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { createTestApp, type TestApp } from './setup';

describe('Media API', () => {
  let ctx: TestApp;
  let csrfToken: string;
  let cookieHeader: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ csrfToken, cookieHeader } = await ctx.login());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const authed = (opts: Record<string, unknown>) => ({
    ...opts,
    headers: {
      ...((opts.headers as Record<string, string>) ?? {}),
      cookie: cookieHeader,
    },
  });

  const authedMut = (opts: Record<string, unknown>) => ({
    ...opts,
    headers: {
      ...((opts.headers as Record<string, string>) ?? {}),
      cookie: cookieHeader,
      'x-csrf-token': csrfToken,
      'content-type': 'application/json',
    },
  });

  const authedMutNoBody = (opts: Record<string, unknown>) => ({
    ...opts,
    headers: {
      ...((opts.headers as Record<string, string>) ?? {}),
      cookie: cookieHeader,
      'x-csrf-token': csrfToken,
    },
  });

  describe('GET /api/cms/media', () => {
    it('returns items array', async () => {
      const res = await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/media' }));
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json<{ items: unknown[] }>().items)).toBe(true);
    });

    it('requires authentication', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/cms/media' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/cms/media/:id (alt + focal)', () => {
    it('updates media metadata', async () => {
      // Insert a media asset directly through the service for testing
      const now = new Date().toISOString();
      const id = nanoid();
      (ctx.db as import('better-sqlite3').Database)
        .prepare(
          `INSERT INTO media_assets (id, name, path, mime, size, alt, focal_x, focal_y, checksum, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0.5, 0.5, 'abc123', ?, ?)`
        )
        .run(id, 'test.jpg', '/uploads/cms/test.jpg', 'image/jpeg', 1024, 'original alt', now, now);

      const res = await ctx.app.inject(
        authedMut({
          method: 'PATCH',
          url: `/api/cms/media/${id}`,
          body: JSON.stringify({ alt: 'nuevo alt', focalX: 0.3, focalY: 0.7 }),
        })
      );
      expect(res.statusCode).toBe(200);
      const asset = res.json<{ alt: string; focalX: number; focalY: number }>();
      expect(asset.alt).toBe('nuevo alt');
      expect(asset.focalX).toBeCloseTo(0.3);
      expect(asset.focalY).toBeCloseTo(0.7);
    });
  });

  describe('DELETE /api/cms/media/:id', () => {
    it('removes asset from DB', async () => {
      const now = new Date().toISOString();
      const id = nanoid();
      // Insert asset not in uploads/cms so file deletion is skipped
      (ctx.db as import('better-sqlite3').Database)
        .prepare(
          `INSERT INTO media_assets (id, name, path, mime, size, alt, focal_x, focal_y, checksum, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0.5, 0.5, 'def456', ?, ?)`
        )
        .run(id, 'logo.svg', '/logos-clientes/logo.svg', 'image/svg+xml', 512, null, now, now);

      const delRes = await ctx.app.inject(
        authedMutNoBody({
          method: 'DELETE',
          url: `/api/cms/media/${id}`,
        })
      );
      expect(delRes.statusCode).toBe(200);
      expect(delRes.json<{ ok: boolean }>().ok).toBe(true);

      // Asset should be gone
      const listRes = await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/media' }));
      const items = listRes.json<{ items: Array<{ id: string }> }>().items;
      expect(items.find((i) => i.id === id)).toBeUndefined();
    });

    it('returns 404 on unknown id', async () => {
      const res = await ctx.app.inject(
        authedMutNoBody({
          method: 'DELETE',
          url: '/api/cms/media/nonexistent-id',
        })
      );
      expect([400, 404]).toContain(res.statusCode);
    });
  });

  describe('A-4 — borrado en dos pasos de una imagen en uso', () => {
    it('rechaza con 409 y dice dónde se usa; con confirm=1 la borra', async () => {
      const now = new Date().toISOString();
      const mediaId = nanoid();
      ctx.db
        .prepare(
          `INSERT INTO media_assets (id, name, path, mime, size, alt, focal_x, focal_y, checksum, created_at, updated_at)
           VALUES (?, 'en-uso.jpg', ?, 'image/jpeg', 1024, 'alt', 0.5, 0.5, 'chk', ?, ?)`
        )
        .run(mediaId, `/uploads/cms/${mediaId}.jpg`, now, now);
      // media_usages.entry_id tiene FK contra content_entries.
      ctx.db
        .prepare(
          `INSERT INTO content_entries (id, kind, slug, locale, title, status, version, created_at, updated_at)
           VALUES ('home.hero', 'page', '/', 'es-CL', 'Hero', 'published', 1, ?, ?)`
        )
        .run(now, now);
      ctx.db
        .prepare(
          `INSERT INTO media_usages (media_id, entry_id, field_key, updated_at) VALUES (?, ?, ?, ?)`
        )
        .run(mediaId, 'home.hero', 'image', now);

      const rechazo = await ctx.app.inject(
        authedMutNoBody({ method: 'DELETE', url: `/api/cms/media/${mediaId}` })
      );
      expect(rechazo.statusCode).toBe(409);
      const { error } = rechazo.json<{ error: string }>();
      expect(error).toMatch(/en uso/i);
      expect(error).toMatch(/home\.hero\.image/);

      // Sigue en la base: el rechazo no debe haber borrado nada.
      expect(ctx.mediaService.findMedia(mediaId)).toBeDefined();

      const confirmado = await ctx.app.inject(
        authedMutNoBody({ method: 'DELETE', url: `/api/cms/media/${mediaId}?confirm=1` })
      );
      expect(confirmado.statusCode).toBe(200);
      expect(ctx.mediaService.findMedia(mediaId)).toBeUndefined();
    });
  });

  describe('GET /api/cms/media pagination (H-16)', () => {
    it('returns paginated media items list', async () => {
      const res = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/media?page=1&limit=5' })
      );
      expect(res.statusCode).toBe(200);
      const data = res.json<{ items: unknown[]; total: number; page: number; limit: number }>();
      expect(Array.isArray(data.items)).toBe(true);
      expect(typeof data.total).toBe('number');
      expect(data.page).toBe(1);
      expect(data.limit).toBe(5);
    });
  });
});
