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

  // For mutations without a body (DELETE, no-body POST)
  const authedMutNoBody = (opts: Record<string, unknown>) => ({
    ...opts,
    headers: {
      ...((opts.headers as Record<string, string>) ?? {}),
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

  describe('GET /api/cms/entries?q= (M-1)', () => {
    it('busca por título, slug e id', async () => {
      // El overlay pintaba las 40 entradas de golpe sin buscador; el servidor
      // paginaba pero no sabía buscar.
      const crear = (id: string, title: string, slug: string) =>
        ctx.app.inject(
          authedMut({
            method: 'POST',
            url: '/api/cms/entries',
            body: JSON.stringify({ id, kind: 'page', slug, title }),
          })
        );
      await crear('busca.alfa', 'Central Alfa', '/alfa');
      await crear('busca.beta', 'Central Beta', '/beta');

      const porTitulo = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/entries?q=Alfa' })
      );
      const r1 = porTitulo.json<{ entries: Array<{ id: string }>; total: number }>();
      expect(r1.entries.map((e) => e.id)).toEqual(['busca.alfa']);
      expect(r1.total).toBe(1);

      const porSlug = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/entries?q=/beta' })
      );
      expect(porSlug.json<{ entries: Array<{ id: string }> }>().entries.map((e) => e.id)).toEqual([
        'busca.beta',
      ]);

      const porId = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/entries?q=busca.' })
      );
      expect(porId.json<{ total: number }>().total).toBe(2);
    });

    it('combina la búsqueda con el filtro por tipo', async () => {
      await ctx.app.inject(
        authedMut({
          method: 'POST',
          url: '/api/cms/entries',
          body: JSON.stringify({
            id: 'busca.gamma',
            kind: 'proyecto',
            slug: 'central-gamma',
            title: 'Central Gamma',
          }),
        })
      );
      const res = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/entries?kind=page&q=Central' })
      );
      const ids = res.json<{ entries: Array<{ id: string }> }>().entries.map((e) => e.id);
      expect(ids).not.toContain('busca.gamma');
      expect(ids).toContain('busca.alfa');
    });

    it('devuelve vacío sin error cuando nada coincide', async () => {
      const res = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/entries?q=noexistenadaasi' })
      );
      expect(res.statusCode).toBe(200);
      expect(res.json<{ entries: unknown[]; total: number }>()).toMatchObject({
        entries: [],
        total: 0,
      });
    });
  });

  describe('POST /api/cms/entries', () => {
    it('creates a new entry', async () => {
      const res = await ctx.app.inject(
        authedMut({
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
        })
      );
      expect(res.statusCode).toBe(201);
      const entry = res.json<{ id: string; fields: Record<string, { value: unknown }> }>();
      expect(entry.id).toBe('test.new-page');
      expect(entry.fields.title.value).toBe('Hola');
      expect(entry.fields.body.value).toBe('Contenido de prueba');
    });

    /**
     * B-8: el validador aceptaba un tercer estado, `pending_review`, que el
     * panel nunca ofrecía. Se retiró en vez de exponerlo, porque el export
     * filtra por `published` y ese estado despublicaba igual que `draft` bajo
     * un nombre que prometía una revisión que nadie hace. Este test fija que
     * el conjunto aceptado sea el que la interfaz sabe manejar.
     */
    it('rechaza un estado que la interfaz no ofrece', async () => {
      const res = await ctx.app.inject(
        authedMut({
          method: 'POST',
          url: '/api/cms/entries',
          body: JSON.stringify({
            id: 'test.en-revision',
            kind: 'page',
            slug: '/en-revision',
            title: 'En revisión',
            status: 'pending_review',
            fields: { title: { type: 'text', value: 'Hola' } },
          }),
        })
      );
      expect(res.statusCode).toBe(400);
      // Y la entrada no se creó a medias.
      const buscar = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/entries/test.en-revision' })
      );
      expect(buscar.statusCode).toBe(404);
    });

    // C-1: el archivo exportado se nombra por slug, así que dos entradas de
    // colección con el mismo slug se pisan al exportar y borrar una elimina el
    // .md de la otra. Reproducido en auditoría con pérdida real de contenido.
    it('rechaza un slug de colección ya usado y nombra el conflicto (C-1)', async () => {
      const crear = (id: string) =>
        ctx.app.inject(
          authedMut({
            method: 'POST',
            url: '/api/cms/entries',
            body: JSON.stringify({
              id,
              kind: 'proyecto',
              slug: 'obra-compartida',
              title: `Obra ${id}`,
              status: 'published',
            }),
          })
        );

      const primera = await crear('test.obra-a');
      expect(primera.statusCode).toBe(201);
      // P1-02: el id de una ficha de colección lo decide el servidor, con la
      // forma que usan las plantillas del sitio (`proyectos.<slug>`).
      expect(primera.json<{ id: string }>().id).toBe('proyectos.obra-compartida');

      const choque = await crear('test.obra-b');
      expect(choque.statusCode).toBe(400);
      const { error } = choque.json<{ error: string }>();
      // El mensaje debe llegar íntegro: nombra la entrada en conflicto para que
      // el editor sepa cuál es. BaseController lo sustituía por un genérico.
      expect(error).toMatch(/obra-compartida/);
      expect(error).toMatch(/proyectos\.obra-compartida/);
    });

    it('permite que dos páginas compartan slug (C-1, no-regresión)', async () => {
      // 34 entradas de tipo page comparten 9 slugs a propósito: no se
      // materializan en un archivo por slug, así que el índice único NO
      // debe alcanzarlas.
      for (const id of ['test.pagina-a', 'test.pagina-b']) {
        const res = await ctx.app.inject(
          authedMut({
            method: 'POST',
            url: '/api/cms/entries',
            body: JSON.stringify({ id, kind: 'page', slug: '/compartida', title: id }),
          })
        );
        expect(res.statusCode).toBe(201);
      }
    });

    it('rechaza renombrar una entrada a un slug de colección ocupado (C-1)', async () => {
      await ctx.app.inject(
        authedMut({
          method: 'POST',
          url: '/api/cms/entries',
          body: JSON.stringify({
            id: 'test.obra-c',
            kind: 'proyecto',
            slug: 'obra-propia',
            title: 'Obra C',
          }),
        })
      );

      const res = await ctx.app.inject(
        authedMut({
          method: 'PATCH',
          url: '/api/cms/entries/proyectos.obra-propia',
          body: JSON.stringify({ slug: 'obra-compartida' }),
        })
      );
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: string }>().error).toMatch(/obra-compartida/);
    });

    it('returns 400 on duplicate id', async () => {
      const res = await ctx.app.inject(
        authedMut({
          method: 'POST',
          url: '/api/cms/entries',
          body: JSON.stringify({
            id: 'test.new-page', // already created above
            kind: 'page',
            slug: '/test-page-2',
            title: 'Duplicado',
          }),
        })
      );
      expect(res.statusCode).toBe(400);
    });

    it('returns 400 on invalid id characters', async () => {
      const res = await ctx.app.inject(
        authedMut({
          method: 'POST',
          url: '/api/cms/entries',
          body: JSON.stringify({
            id: 'INVALID ID!',
            kind: 'page',
            slug: '/x',
            title: 'X',
          }),
        })
      );
      expect(res.statusCode).toBe(400);
    });

    it('inyecta campos requeridos del schema al crear un servicio (CMS-003)', async () => {
      const res = await ctx.app.inject(
        authedMut({
          method: 'POST',
          url: '/api/cms/entries',
          body: JSON.stringify({
            id: 'servicio.nuevo-test',
            kind: 'servicio',
            slug: 'nuevo-test',
            title: 'Servicio de prueba',
            // No se envían fields: el servidor debe completar la plantilla.
          }),
        })
      );
      expect(res.statusCode).toBe(201);
      const entry = res.json<{ fields: Record<string, { value: unknown }> }>();
      // El schema Zod de servicios exige titulo, resumen, icono y orden.
      expect(entry.fields.titulo.value).toBe('Servicio de prueba');
      // P1-02: sin textos de relleno que acabarían publicados, y con todos los
      // campos editables del tipo, para que el formulario los ofrezca.
      expect(entry.fields.resumen.value).toBe('');
      expect(entry.fields.icono.value).toBe('pipe');
      expect(entry.fields.orden.value).toBe(100);
      for (const key of ['tipos', 'aplicaciones', 'normas', 'body']) {
        expect(entry.fields[key], key).toBeDefined();
      }
    });

    it('inyecta campos requeridos del schema al crear un proyecto (CMS-003)', async () => {
      const res = await ctx.app.inject(
        authedMut({
          method: 'POST',
          url: '/api/cms/entries',
          body: JSON.stringify({
            id: 'proyecto.nuevo-test',
            kind: 'proyecto',
            slug: 'nuevo-test-proyecto',
            title: 'Proyecto de prueba',
          }),
        })
      );
      expect(res.statusCode).toBe(201);
      const entry = res.json<{ fields: Record<string, { value: unknown }> }>();
      expect(entry.fields.nombre.value).toBe('Proyecto de prueba');
      expect(entry.fields.alcance.value).toBe('');
      for (const key of [
        'cliente',
        'servicio',
        'diametro',
        'longitud',
        'peso',
        'acero',
        'normas',
      ]) {
        expect(entry.fields[key], key).toBeDefined();
      }
      expect(entry.fields.categoria.value).toBe('tuberias');
      expect(entry.fields.tipo.value).toBe('banco');
    });
  });

  describe('GET /api/cms/entries/:id', () => {
    it('returns entry by id', async () => {
      const res = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/entries/test.new-page' })
      );
      expect(res.statusCode).toBe(200);
      expect(res.json<{ id: string }>().id).toBe('test.new-page');
    });

    it('returns 404 for unknown entry', async () => {
      const res = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/entries/unknown.entry' })
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/cms/entries/:id/fields/:key', () => {
    it('updates a field value', async () => {
      const res = await ctx.app.inject(
        authedMut({
          method: 'PATCH',
          url: '/api/cms/entries/test.new-page/fields/title',
          body: JSON.stringify({ value: 'Actualizado' }),
        })
      );
      expect(res.statusCode).toBe(200);
      const entry = res.json<{ fields: Record<string, { value: string }> }>();
      expect(entry.fields.title.value).toBe('Actualizado');
    });

    it('rejects field update when value type does not match field schema (H-09)', async () => {
      const res = await ctx.app.inject(
        authedMut({
          method: 'PATCH',
          url: '/api/cms/entries/servicio.nuevo-test/fields/orden',
          body: JSON.stringify({ value: 'not-a-number' }),
        })
      );
      expect(res.statusCode).toBe(400);
      expect(res.json<{ error: string }>().error).toMatch(/debe ser numérico/i);
    });

    it('returns 400 when field does not exist', async () => {
      const res = await ctx.app.inject(
        authedMut({
          method: 'PATCH',
          url: '/api/cms/entries/test.new-page/fields/nonexistent',
          body: JSON.stringify({ value: 'x' }),
        })
      );
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/cms/entries pagination (H-16)', () => {
    it('returns paginated entries with metadata', async () => {
      const res = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/entries?page=1&limit=2' })
      );
      expect(res.statusCode).toBe(200);
      const data = res.json<{
        entries: unknown[];
        total: number;
        page: number;
        limit: number;
        pages: number;
      }>();
      expect(Array.isArray(data.entries)).toBe(true);
      expect(typeof data.total).toBe('number');
      expect(data.page).toBe(1);
      expect(data.limit).toBe(2);
      expect(typeof data.pages).toBe('number');
    });
  });

  describe('PATCH /api/cms/entries/:id (metadata)', () => {
    it('updates title and status', async () => {
      const res = await ctx.app.inject(
        authedMut({
          method: 'PATCH',
          url: '/api/cms/entries/test.new-page',
          body: JSON.stringify({ title: 'Nuevo título', status: 'published' }),
        })
      );
      expect(res.statusCode).toBe(200);
      const entry = res.json<{ title: string; status: string }>();
      expect(entry.title).toBe('Nuevo título');
      expect(entry.status).toBe('published');
    });
  });

  describe('Revisions', () => {
    it('GET /api/cms/revisions/:entryId returns revision list', async () => {
      const res = await ctx.app.inject(
        authed({
          method: 'GET',
          url: '/api/cms/revisions/test.new-page',
        })
      );
      expect(res.statusCode).toBe(200);
      const body = res.json<{ revisions: Array<{ id: string; version: number }> }>();
      expect(Array.isArray(body.revisions)).toBe(true);
      expect(body.revisions.length).toBeGreaterThan(0);
    });

    it('POST restore/:revisionId restores entry to that state', async () => {
      // Get current revisions
      const revisionsRes = await ctx.app.inject(
        authed({
          method: 'GET',
          url: '/api/cms/revisions/test.new-page',
        })
      );
      const { revisions } = revisionsRes.json<{
        revisions: Array<{ id: string; version: number }>;
      }>();
      // Restore to first (oldest) revision
      const oldest = revisions[revisions.length - 1];

      const restoreRes = await ctx.app.inject(
        authedMutNoBody({
          method: 'POST',
          url: `/api/cms/revisions/test.new-page/restore/${oldest.id}`,
        })
      );
      expect(restoreRes.statusCode).toBe(200);
      expect(restoreRes.json<{ ok: boolean }>().ok).toBe(true);
    });
  });

  describe('DELETE /api/cms/entries/:id', () => {
    it('deletes an entry and its fields', async () => {
      // Create entry to delete
      await ctx.app.inject(
        authedMut({
          method: 'POST',
          url: '/api/cms/entries',
          body: JSON.stringify({
            id: 'test.to-delete',
            kind: 'page',
            slug: '/delete-me',
            title: 'Delete me',
          }),
        })
      );

      const delRes = await ctx.app.inject(
        authedMutNoBody({
          method: 'DELETE',
          url: '/api/cms/entries/test.to-delete',
        })
      );
      expect(delRes.statusCode).toBe(200);

      // Entry should be gone
      const getRes = await ctx.app.inject(
        authed({ method: 'GET', url: '/api/cms/entries/test.to-delete' })
      );
      expect(getRes.statusCode).toBe(404);
    });

    it('returns 404 when deleting nonexistent entry', async () => {
      const res = await ctx.app.inject(
        authedMutNoBody({
          method: 'DELETE',
          url: '/api/cms/entries/does.not.exist',
        })
      );
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/cms/entries?kind=page', () => {
    it('filters entries by kind', async () => {
      const res = await ctx.app.inject(
        authed({
          method: 'GET',
          url: '/api/cms/entries?kind=page',
        })
      );
      expect(res.statusCode).toBe(200);
      const entries = res.json<{ entries: Array<{ kind: string }> }>().entries;
      expect(entries.every((e) => e.kind === 'page')).toBe(true);
    });
  });
});
