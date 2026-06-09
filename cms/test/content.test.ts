import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './setup';

describe('Content API', () => {
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
      ...(opts.headers as Record<string, string> ?? {}),
      cookie: cookieHeader,
    },
  });

  const authedMut = (opts: Record<string, unknown>) => ({
    ...opts,
    headers: {
      ...(opts.headers as Record<string, string> ?? {}),
      cookie: cookieHeader,
      'x-csrf-token': csrfToken,
      'content-type': 'application/json',
    },
  });

  // For mutations without a body (DELETE, no-body POST)
  const authedMutNoBody = (opts: Record<string, unknown>) => ({
    ...opts,
    headers: {
      ...(opts.headers as Record<string, string> ?? {}),
      cookie: cookieHeader,
      'x-csrf-token': csrfToken,
    },
  });

  describe('GET /api/cms/entries', () => {
    it('returns empty list initially', async () => {
      const res = await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/entries' }));
      expect(res.statusCode).toBe(200);
      const body = res.json<{ entries: unknown[] }>();
      expect(Array.isArray(body.entries)).toBe(true);
    });
  });

  describe('POST /api/cms/entries', () => {
    it('creates a new entry', async () => {
      const res = await ctx.app.inject(authedMut({
        method: 'POST',
        url: '/api/cms/entries',
        body: JSON.stringify({
          id: 'test.new-page',
          kind: 'page',
          slug: '/test-page',
          title: 'Test Page',
          status: 'draft',
          fields: {
            title: { type: 'text', value: 'Hola' },
            body: { type: 'textarea', value: 'Contenido de prueba' },
          },
        }),
      }));
      expect(res.statusCode).toBe(201);
      const entry = res.json<{ id: string; fields: Record<string, { value: unknown }> }>();
      expect(entry.id).toBe('test.new-page');
      expect(entry.fields.title.value).toBe('Hola');
      expect(entry.fields.body.value).toBe('Contenido de prueba');
    });

    it('returns 400 on duplicate id', async () => {
      const res = await ctx.app.inject(authedMut({
        method: 'POST',
        url: '/api/cms/entries',
        body: JSON.stringify({
          id: 'test.new-page', // already created above
          kind: 'page',
          slug: '/test-page-2',
          title: 'Duplicado',
        }),
      }));
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 on invalid id characters', async () => {
      const res = await ctx.app.inject(authedMut({
        method: 'POST',
        url: '/api/cms/entries',
        body: JSON.stringify({
          id: 'INVALID ID!',
          kind: 'page',
          slug: '/x',
          title: 'X',
        }),
      }));
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/cms/entries/:id', () => {
    it('returns entry by id', async () => {
      const res = await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/entries/test.new-page' }));
      expect(res.statusCode).toBe(200);
      expect(res.json<{ id: string }>().id).toBe('test.new-page');
    });

    it('returns 404 for unknown entry', async () => {
      const res = await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/entries/unknown.entry' }));
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/cms/entries/:id/fields/:key', () => {
    it('updates a field value', async () => {
      const res = await ctx.app.inject(authedMut({
        method: 'PATCH',
        url: '/api/cms/entries/test.new-page/fields/title',
        body: JSON.stringify({ value: 'Actualizado' }),
      }));
      expect(res.statusCode).toBe(200);
      const entry = res.json<{ fields: Record<string, { value: string }> }>();
      expect(entry.fields.title.value).toBe('Actualizado');
    });

    it('returns 400 when field does not exist', async () => {
      const res = await ctx.app.inject(authedMut({
        method: 'PATCH',
        url: '/api/cms/entries/test.new-page/fields/nonexistent',
        body: JSON.stringify({ value: 'x' }),
      }));
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/cms/entries/:id (metadata)', () => {
    it('updates title and status', async () => {
      const res = await ctx.app.inject(authedMut({
        method: 'PATCH',
        url: '/api/cms/entries/test.new-page',
        body: JSON.stringify({ title: 'Nuevo título', status: 'published' }),
      }));
      expect(res.statusCode).toBe(200);
      const entry = res.json<{ title: string; status: string }>();
      expect(entry.title).toBe('Nuevo título');
      expect(entry.status).toBe('published');
    });
  });

  describe('Revisions', () => {
    it('GET /api/cms/revisions/:entryId returns revision list', async () => {
      const res = await ctx.app.inject(authed({
        method: 'GET',
        url: '/api/cms/revisions/test.new-page',
      }));
      expect(res.statusCode).toBe(200);
      const body = res.json<{ revisions: Array<{ id: string; version: number }> }>();
      expect(Array.isArray(body.revisions)).toBe(true);
      expect(body.revisions.length).toBeGreaterThan(0);
    });

    it('POST restore/:revisionId restores entry to that state', async () => {
      // Get current revisions
      const revisionsRes = await ctx.app.inject(authed({
        method: 'GET',
        url: '/api/cms/revisions/test.new-page',
      }));
      const { revisions } = revisionsRes.json<{ revisions: Array<{ id: string; version: number }> }>();
      // Restore to first (oldest) revision
      const oldest = revisions[revisions.length - 1];

      const restoreRes = await ctx.app.inject(authedMutNoBody({
        method: 'POST',
        url: `/api/cms/revisions/test.new-page/restore/${oldest.id}`,
      }));
      expect(restoreRes.statusCode).toBe(200);
      expect(restoreRes.json<{ ok: boolean }>().ok).toBe(true);
    });
  });

  describe('DELETE /api/cms/entries/:id', () => {
    it('deletes an entry and its fields', async () => {
      // Create entry to delete
      await ctx.app.inject(authedMut({
        method: 'POST',
        url: '/api/cms/entries',
        body: JSON.stringify({ id: 'test.to-delete', kind: 'page', slug: '/delete-me', title: 'Delete me' }),
      }));

      const delRes = await ctx.app.inject(authedMutNoBody({
        method: 'DELETE',
        url: '/api/cms/entries/test.to-delete',
      }));
      expect(delRes.statusCode).toBe(200);

      // Entry should be gone
      const getRes = await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/entries/test.to-delete' }));
      expect(getRes.statusCode).toBe(404);
    });

    it('returns 404 when deleting nonexistent entry', async () => {
      const res = await ctx.app.inject(authedMutNoBody({
        method: 'DELETE',
        url: '/api/cms/entries/does.not.exist',
      }));
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/cms/entries?kind=page', () => {
    it('filters entries by kind', async () => {
      const res = await ctx.app.inject(authed({
        method: 'GET',
        url: '/api/cms/entries?kind=page',
      }));
      expect(res.statusCode).toBe(200);
      const entries = res.json<{ entries: Array<{ kind: string }> }>().entries;
      expect(entries.every((e) => e.kind === 'page')).toBe(true);
    });
  });
});
