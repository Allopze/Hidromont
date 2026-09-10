import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import type { InjectOptions } from 'fastify';
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
      .run(
        mediaId,
        'test-gallery.jpg',
        '/uploads/cms/test-gallery.jpg',
        'image/jpeg',
        2048,
        'Test gallery image',
        now,
        now
      );
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  // Helpers que devuelven opciones tipadas para app.inject (sin `as any`).
  const authed = (opts: InjectOptions): InjectOptions => ({
    ...opts,
    headers: {
      ...(opts.headers as Record<string, string> | undefined),
      cookie: cookieHeader,
    },
  });

  const authedMut = (body: unknown): InjectOptions => ({
    method: 'POST',
    headers: {
      cookie: cookieHeader,
      'x-csrf-token': csrfToken,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const authedMutWith = (opts: InjectOptions): InjectOptions => ({
    ...opts,
    headers: {
      ...(opts.headers as Record<string, string> | undefined),
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
      });
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
      });
      expect(res.statusCode).toBe(400);
    });

    it('GET /api/cms/gallery/categories lists categories', async () => {
      const res = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/gallery/categories' })
      );
      expect(res.statusCode).toBe(200);
      const data = res.json<{ items: Array<{ id: string }> }>();
      expect(data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/cms/gallery/categories/:id updates name', async () => {
      const res = await ctx.app.inject(
        authedMutWith({
          method: 'PATCH',
          url: `/api/cms/gallery/categories/${catId}`,
          body: JSON.stringify({ name: 'Montaje Industrial' }),
        })
      );
      expect(res.statusCode).toBe(200);
      expect(res.json<{ name: string }>().name).toBe('Montaje Industrial');
    });

    it('DELETE /api/cms/gallery/categories/:id removes it', async () => {
      const res = await ctx.app.inject(
        authedMutWith({
          method: 'DELETE',
          url: `/api/cms/gallery/categories/${catId}`,
        })
      );
      expect(res.statusCode).toBe(200);
      expect(res.json<{ ok: boolean }>().ok).toBe(true);
    });
  });

  // ── Albums (GAL-19) ─────────────────────────────────────────

  describe('Albums', () => {
    it('GET /api/cms/gallery/albums requires auth', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/cms/gallery/albums' });
      expect(res.statusCode).toBe(401);
    });

    it('POST /api/cms/gallery/albums creates an album', async () => {
      const res = await ctx.app.inject({
        ...authedMut({ name: 'C.H. Pangal' }),
        url: '/api/cms/gallery/albums',
      });
      expect(res.statusCode).toBe(201);
      const album = res.json<{ slug: string; name: string; itemCount: number }>();
      expect(album.slug).toBe('c-h-pangal');
      expect(album.itemCount).toBe(0);
    });

    it('POST rejects duplicate slug', async () => {
      const res = await ctx.app.inject({
        ...authedMut({ name: 'Otro nombre', slug: 'c-h-pangal' }),
        url: '/api/cms/gallery/albums',
      });
      expect(res.statusCode).toBe(400);
    });

    it('PATCH renombra el álbum sin tocar el slug', async () => {
      const res = await ctx.app.inject(
        authedMutWith({
          method: 'PATCH',
          url: '/api/cms/gallery/albums/c-h-pangal',
          body: JSON.stringify({ name: 'Central Hidroeléctrica Pangal' }),
        })
      );
      expect(res.statusCode).toBe(200);
      const album = res.json<{ slug: string; name: string }>();
      expect(album).toMatchObject({ slug: 'c-h-pangal', name: 'Central Hidroeléctrica Pangal' });
    });

    it('PATCH sobre un álbum inexistente responde 404', async () => {
      const res = await ctx.app.inject(
        authedMutWith({
          method: 'PATCH',
          url: '/api/cms/gallery/albums/no-existe',
          body: JSON.stringify({ name: 'Fantasma' }),
        })
      );
      expect(res.statusCode).toBe(404);
    });

    it('DELETE se niega mientras el álbum tenga fotos', async () => {
      const created = await ctx.app.inject({
        ...authedMut({
          mediaId,
          alt: 'Foto del álbum',
          projectSlug: 'c-h-pangal',
        }),
        url: '/api/cms/gallery/items',
      });
      expect(created.statusCode).toBe(201);
      const itemId = created.json<{ id: string }>().id;

      const blocked = await ctx.app.inject(
        authedMutWith({ method: 'DELETE', url: '/api/cms/gallery/albums/c-h-pangal' })
      );
      expect(blocked.statusCode).toBe(409);
      expect(blocked.json<{ error: string }>().error).toMatch(/1 foto/);

      // Con el álbum vacío, el borrado procede.
      await ctx.app.inject(
        authedMutWith({ method: 'DELETE', url: `/api/cms/gallery/items/${itemId}` })
      );
      const res = await ctx.app.inject(
        authedMutWith({ method: 'DELETE', url: '/api/cms/gallery/albums/c-h-pangal' })
      );
      expect(res.statusCode).toBe(200);
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
      });
      catId = catRes.json<{ id: string }>().id;
    });

    it('POST /api/cms/gallery/items creates an item', async () => {
      const res = await ctx.app.inject({
        ...authedMut({
          mediaId,
          alt: 'Tubería forzada en proceso de fabricación',
          categoryId: catId,
          featured: true,
        }),
        url: '/api/cms/gallery/items',
      });
      expect(res.statusCode).toBe(201);
      const item = res.json<{ id: string; alt: string; featured: boolean; categoryName: string }>();
      expect(item.alt).toBe('Tubería forzada en proceso de fabricación');
      expect(item.featured).toBe(true);
      expect(item.categoryName).toBe('Tuberías Forzadas');
      itemId = item.id;
    });

    it('POST rejects missing mediaId', async () => {
      const res = await ctx.app.inject({
        ...authedMut({ alt: 'Test' }),
        url: '/api/cms/gallery/items',
      });
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
      const res = await ctx.app.inject(
        authed({
          method: 'GET',
          url: `/api/cms/gallery/items?categoryId=${catId}`,
        })
      );
      expect(res.statusCode).toBe(200);
      const data = res.json<{ items: Array<{ categoryId: string | null }> }>();
      data.items.forEach((item) => {
        expect(item.categoryId).toBe(catId);
      });
    });

    it('GET /api/cms/gallery/items/:id returns single item', async () => {
      const res = await ctx.app.inject(
        authed({ method: 'GET', url: `/api/cms/gallery/items/${itemId}` })
      );
      expect(res.statusCode).toBe(200);
      expect(res.json<{ id: string }>().id).toBe(itemId);
    });

    it('PATCH /api/cms/gallery/items/:id updates fields', async () => {
      const res = await ctx.app.inject(
        authedMutWith({
          method: 'PATCH',
          url: `/api/cms/gallery/items/${itemId}`,
          body: JSON.stringify({ alt: 'Tubería actualizada en obra', featured: false }),
        })
      );
      expect(res.statusCode).toBe(200);
      const item = res.json<{ alt: string; featured: boolean }>();
      expect(item.alt).toBe('Tubería actualizada en obra');
      expect(item.featured).toBe(false);
    });

    it('POST /api/cms/gallery/items/reorder reorders items', async () => {
      // Create a second item
      const res2 = await ctx.app.inject({
        ...authedMut({ mediaId, alt: 'Alt test' }),
        url: '/api/cms/gallery/items',
      });
      const itemId2 = res2.json<{ id: string }>().id;

      const reorderRes = await ctx.app.inject(
        authedMutWith({
          method: 'POST',
          url: '/api/cms/gallery/items/reorder',
          body: JSON.stringify({ ids: [itemId2, itemId] }),
        })
      );
      expect(reorderRes.statusCode).toBe(200);

      // Verify order
      const listRes = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/gallery/items' })
      );
      const items = listRes.json<{ items: Array<{ id: string }> }>().items;
      const idx1 = items.findIndex((i) => i.id === itemId2);
      const idx2 = items.findIndex((i) => i.id === itemId);
      expect(idx1).toBeLessThan(idx2);
    });

    it('DELETE /api/cms/gallery/items/:id removes item', async () => {
      const res = await ctx.app.inject(
        authedMutWith({
          method: 'DELETE',
          url: `/api/cms/gallery/items/${itemId}`,
        })
      );
      expect(res.statusCode).toBe(200);

      // Verify gone
      const getRes = await ctx.app.inject(
        authed({ method: 'GET', url: `/api/cms/gallery/items/${itemId}` })
      );
      expect(getRes.statusCode).toBe(404);
    });
  });

  // ── Validation ──────────────────────────────────────────────

  describe('Validation', () => {
    it('rejects category with invalid slug', async () => {
      const res = await ctx.app.inject({
        ...authedMut({ name: 'Test', slug: 'INVALID SLUG!' }),
        url: '/api/cms/gallery/categories',
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects reorder with empty ids', async () => {
      const res = await ctx.app.inject(
        authedMutWith({
          method: 'POST',
          url: '/api/cms/gallery/items/reorder',
          body: JSON.stringify({ ids: [] }),
        })
      );
      expect(res.statusCode).toBe(400);
    });
  });
});

/**
 * M-3 — Borrar una agrupación con fotos dentro debe avisar de la consecuencia.
 *
 * Los álbumes ya rechazaban el borrado, pero contando solo las fotos
 * publicadas: un álbum con todas sus fotos en borrador se eliminaba y las
 * dejaba con un `project_slug` que ya no existía. Las categorías no tenían
 * ninguna guarda: la FK es ON DELETE SET NULL, así que borrarlas dejaba a sus
 * fotos sin categoría —fuera de todos los filtros de la galería— con una
 * confirmación que no mencionaba nada.
 */
describe('M-3 — guardas al borrar agrupaciones con fotos', () => {
  let ctx: TestApp;
  let csrfToken: string;
  let cookieHeader: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ csrfToken, cookieHeader } = await ctx.login());
  });

  afterAll(async () => {
    await ctx.app.close();
    ctx.cleanup();
  });

  const del = (url: string) =>
    ctx.app.inject({
      method: 'DELETE',
      url,
      headers: { cookie: cookieHeader, 'x-csrf-token': csrfToken },
    });

  function nuevoMedia(): string {
    const id = nanoid();
    const now = new Date().toISOString();
    ctx.db
      .prepare(
        `INSERT INTO media_assets (id, name, path, mime, size, alt, focal_x, focal_y, checksum, created_at, updated_at)
         VALUES (?, ?, ?, 'image/webp', 1024, 'alt', 0.5, 0.5, ?, ?, ?)`
      )
      .run(id, `${id}.webp`, `/uploads/cms/${id}.webp`, id, now, now);
    return id;
  }

  it('un álbum con todas sus fotos en borrador no se puede borrar', () => {
    ctx.galleryService.createAlbum({ name: 'Solo borradores', slug: 'solo-borradores' });
    ctx.galleryService.createItem({
      mediaId: nuevoMedia(),
      projectSlug: 'solo-borradores',
      alt: 'Foto en borrador',
      status: 'draft',
    });

    expect(() => ctx.galleryService.deleteAlbum('solo-borradores')).toThrow(/1 foto/i);
    expect(ctx.galleryService.listAlbums().some((a) => a.slug === 'solo-borradores')).toBe(true);
  });

  it('una categoría con fotos se rechaza con 409 y dice cuántas', async () => {
    const cat = ctx.galleryService.createCategory({ name: 'Con fotos M3' });
    ctx.galleryService.createItem({
      mediaId: nuevoMedia(),
      categoryId: cat.id,
      alt: 'Foto categorizada',
    });

    const res = await del(`/api/cms/gallery/categories/${cat.id}`);
    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: string }>().error).toMatch(/1 foto/i);
    expect(ctx.galleryService.listCategories().some((c) => c.id === cat.id)).toBe(true);
  });

  it('con confirm=1 la borra y sus fotos quedan sin categoría', async () => {
    const cat = ctx.galleryService.createCategory({ name: 'Confirmada M3' });
    const item = ctx.galleryService.createItem({
      mediaId: nuevoMedia(),
      categoryId: cat.id,
      alt: 'Foto que se queda sin categoría',
    });

    const res = await del(`/api/cms/gallery/categories/${cat.id}?confirm=1`);
    expect(res.statusCode).toBe(200);
    expect(ctx.galleryService.listCategories().some((c) => c.id === cat.id)).toBe(false);
    // La foto sobrevive: la FK es SET NULL, no CASCADE.
    expect(ctx.galleryService.getItem(item.id).categoryId).toBeNull();
  });

  it('una categoría vacía se borra sin pedir confirmación', async () => {
    const cat = ctx.galleryService.createCategory({ name: 'Vacía M3' });
    const res = await del(`/api/cms/gallery/categories/${cat.id}`);
    expect(res.statusCode).toBe(200);
  });
});
