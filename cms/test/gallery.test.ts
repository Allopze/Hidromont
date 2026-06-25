import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { createTestApp, type TestApp } from './setup';

describe('Gallery API', () => {
  let ctx: TestApp;
  let csrfToken: string;
  let cookieHeader: string;
  let mediaId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ csrfToken, cookieHeader } = await ctx.login());

    // Insert a test media asset for gallery items
    const now = new Date().toISOString();
    mediaId = nanoid();
    (ctx.db as import('better-sqlite3').Database)
      .prepare(
        `INSERT INTO media_assets (id, name, path, mime, size, alt, focal_x, focal_y, checksum, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0.5, 0.5, 'test123', ?, ?)`
      )
      .run(mediaId, 'test-gallery.jpg', '/uploads/cms/test-gallery.jpg', 'image/jpeg', 2048, 'Test gallery image', now, now);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const authed = (opts: Record<string, unknown>) => ({
    ...opts,
    headers: {
      ...(opts.headers as Record<string, string> ?? {}),
      cookie: cookieHeader,
    },
  });

  const authedMut = (body: unknown) => ({
    method: 'POST',
    headers: {
      cookie: cookieHeader,
      'x-csrf-token': csrfToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const authedMutWith = (opts: Record<string, unknown>) => ({
    ...opts,
    headers: {
      ...(opts.headers as Record<string, string> ?? {}),
      cookie: cookieHeader,
      'x-csrf-token': csrfToken,
      ...(opts.method !== 'DELETE' ? { 'content-type': 'application/json' } : {}),
    },
  });

  // ── Categories ──────────────────────────────────────────────

  describe('Categories', () => {
    let catId: string;

    it('GET /api/cms/gallery/categories requires auth', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/cms/gallery/categories' });
      expect(res.statusCode).toBe(401);
    });

    it('POST /api/cms/gallery/categories creates a category', async () => {
      const res = await ctx.app.inject({
        ...authedMut({ name: 'Montaje en Obra' }),
        url: '/api/cms/gallery/categories',
      } as Parameters<typeof ctx.app.inject>[0]);
      expect(res.statusCode).toBe(201);
      const cat = res.json<{ id: string; name: string; slug: string }>();
      expect(cat.name).toBe('Montaje en Obra');
      expect(cat.slug).toBe('montaje-en-obra');
      catId = cat.id;
    });

    it('POST rejects duplicate slug', async () => {
      const res = await ctx.app.inject({
        ...authedMut({ name: 'Montaje', slug: 'montaje-en-obra' }),
        url: '/api/cms/gallery/categories',
      } as Parameters<typeof ctx.app.inject>[0]);
      expect(res.statusCode).toBe(400);
    });

    it('GET /api/cms/gallery/categories lists categories', async () => {
      const res = await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/gallery/categories' }));
      expect(res.statusCode).toBe(200);
      const data = res.json<{ items: Array<{ id: string }> }>();
      expect(data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/cms/gallery/categories/:id updates name', async () => {
      const res = await ctx.app.inject(authedMutWith({
        method: 'PATCH',
        url: `/api/cms/gallery/categories/${catId}`,
        body: JSON.stringify({ name: 'Montaje Industrial' }),
      }) as Parameters<typeof ctx.app.inject>[0]);
      expect(res.statusCode).toBe(200);
      expect(res.json<{ name: string }>().name).toBe('Montaje Industrial');
    });

    it('DELETE /api/cms/gallery/categories/:id removes it', async () => {
      const res = await ctx.app.inject(authedMutWith({
        method: 'DELETE',
        url: `/api/cms/gallery/categories/${catId}`,
      }) as Parameters<typeof ctx.app.inject>[0]);
      expect(res.statusCode).toBe(200);
      expect(res.json<{ ok: boolean }>().ok).toBe(true);
    });
  });

  // ── Items ───────────────────────────────────────────────────

  describe('Items', () => {
    let itemId: string;
    let catId: string;

    beforeAll(async () => {
      // Create a category for items
      const catRes = await ctx.app.inject({
        ...authedMut({ name: 'Tuberías Forzadas' }),
        url: '/api/cms/gallery/categories',
      } as Parameters<typeof ctx.app.inject>[0]);
      catId = catRes.json<{ id: string }>().id;
    });

    it('POST /api/cms/gallery/items creates an item', async () => {
      const res = await ctx.app.inject({
        ...authedMut({
          mediaId,
          title: 'Tubería en taller',
          alt: 'Tubería forzada en proceso de fabricación',
          categoryId: catId,
          featured: true,
        }),
        url: '/api/cms/gallery/items',
      } as Parameters<typeof ctx.app.inject>[0]);
      expect(res.statusCode).toBe(201);
      const item = res.json<{ id: string; title: string; featured: boolean; categoryName: string }>();
      expect(item.title).toBe('Tubería en taller');
      expect(item.featured).toBe(true);
      expect(item.categoryName).toBe('Tuberías Forzadas');
      itemId = item.id;
    });

    it('POST rejects missing mediaId', async () => {
      const res = await ctx.app.inject({
        ...authedMut({ title: 'No media', alt: 'Test' }),
        url: '/api/cms/gallery/items',
      } as Parameters<typeof ctx.app.inject>[0]);
      expect(res.statusCode).toBe(400);
    });

    it('GET /api/cms/gallery/items lists items', async () => {
      const res = await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/gallery/items' }));
      expect(res.statusCode).toBe(200);
      const data = res.json<{ items: Array<{ id: string; mediaPath: string }> }>();
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      expect(data.items[0].mediaPath).toBeTruthy();
    });

    it('GET /api/cms/gallery/items?categoryId= filters by category', async () => {
      const res = await ctx.app.inject(authed({
        method: 'GET',
        url: `/api/cms/gallery/items?categoryId=${catId}`,
      }));
      expect(res.statusCode).toBe(200);
      const data = res.json<{ items: Array<{ categoryId: string | null }> }>();
      data.items.forEach((item) => {
        expect(item.categoryId).toBe(catId);
      });
    });

    it('GET /api/cms/gallery/items/:id returns single item', async () => {
      const res = await ctx.app.inject(authed({ method: 'GET', url: `/api/cms/gallery/items/${itemId}` }));
      expect(res.statusCode).toBe(200);
      expect(res.json<{ id: string }>().id).toBe(itemId);
    });

    it('PATCH /api/cms/gallery/items/:id updates fields', async () => {
      const res = await ctx.app.inject(authedMutWith({
        method: 'PATCH',
        url: `/api/cms/gallery/items/${itemId}`,
        body: JSON.stringify({ title: 'Tubería actualizada', featured: false }),
      }) as Parameters<typeof ctx.app.inject>[0]);
      expect(res.statusCode).toBe(200);
      const item = res.json<{ title: string; featured: boolean }>();
      expect(item.title).toBe('Tubería actualizada');
      expect(item.featured).toBe(false);
    });

    it('POST /api/cms/gallery/items/reorder reorders items', async () => {
      // Create a second item
      const res2 = await ctx.app.inject({
        ...authedMut({ mediaId, title: 'Segunda imagen', alt: 'Alt test' }),
        url: '/api/cms/gallery/items',
      } as Parameters<typeof ctx.app.inject>[0]);
      const itemId2 = res2.json<{ id: string }>().id;

      const reorderRes = await ctx.app.inject(authedMutWith({
        method: 'POST',
        url: '/api/cms/gallery/items/reorder',
        body: JSON.stringify({ ids: [itemId2, itemId] }),
      }) as Parameters<typeof ctx.app.inject>[0]);
      expect(reorderRes.statusCode).toBe(200);

      // Verify order
      const listRes = await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/gallery/items' }));
      const items = listRes.json<{ items: Array<{ id: string }> }>().items;
      const idx1 = items.findIndex((i) => i.id === itemId2);
      const idx2 = items.findIndex((i) => i.id === itemId);
      expect(idx1).toBeLessThan(idx2);
    });

    it('DELETE /api/cms/gallery/items/:id removes item', async () => {
      const res = await ctx.app.inject(authedMutWith({
        method: 'DELETE',
        url: `/api/cms/gallery/items/${itemId}`,
      }) as Parameters<typeof ctx.app.inject>[0]);
      expect(res.statusCode).toBe(200);

      // Verify gone
      const getRes = await ctx.app.inject(authed({ method: 'GET', url: `/api/cms/gallery/items/${itemId}` }));
      expect(getRes.statusCode).toBe(404);
    });
  });

  // ── Validation ──────────────────────────────────────────────

  describe('Validation', () => {
    it('rejects category with invalid slug', async () => {
      const res = await ctx.app.inject({
        ...authedMut({ name: 'Test', slug: 'INVALID SLUG!' }),
        url: '/api/cms/gallery/categories',
      } as Parameters<typeof ctx.app.inject>[0]);
      expect(res.statusCode).toBe(400);
    });

    it('rejects reorder with empty ids', async () => {
      const res = await ctx.app.inject(authedMutWith({
        method: 'POST',
        url: '/api/cms/gallery/items/reorder',
        body: JSON.stringify({ ids: [] }),
      }) as Parameters<typeof ctx.app.inject>[0]);
      expect(res.statusCode).toBe(400);
    });
  });
});
