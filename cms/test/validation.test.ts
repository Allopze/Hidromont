/**
 * A-1 — Los errores de validación deben decir qué campo falla y por qué.
 *
 * En auditoría los seis casos de abajo devolvían el mismo texto:
 * «Error al procesar la solicitud». La causa era que `handleError` comparaba
 * `error.message` contra expresiones en español, y el `message` de un
 * ZodError es el JSON serializado de sus issues.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './setup';

describe('A-1 — errores de validación legibles', () => {
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

  const authedMut = (opts: Record<string, unknown>) => ({
    ...opts,
    headers: {
      ...((opts.headers as Record<string, string>) ?? {}),
      cookie: cookieHeader,
      'x-csrf-token': csrfToken,
      'content-type': 'application/json',
    },
  });

  const entrada = (extra: Record<string, unknown>) =>
    JSON.stringify({ id: 'test.valida', kind: 'page', slug: '/valida', title: 'Título', ...extra });

  it('ningún error de validación devuelve ya el mensaje genérico', async () => {
    const casos: Array<{ nombre: string; req: Record<string, unknown>; campo: string }> = [
      {
        nombre: 'id con mayúsculas y espacios',
        req: { method: 'POST', url: '/api/cms/entries', body: entrada({ id: 'AUDIT MAYUS' }) },
        campo: 'id',
      },
      {
        nombre: 'kind fuera del enum',
        req: { method: 'POST', url: '/api/cms/entries', body: entrada({ kind: 'inventado' }) },
        campo: 'kind',
      },
      {
        nombre: 'title de 5000 caracteres',
        req: {
          method: 'POST',
          url: '/api/cms/entries',
          body: entrada({ title: 'A'.repeat(5000) }),
        },
        campo: 'title',
      },
      {
        nombre: 'slug con retroceso de directorio',
        req: { method: 'POST', url: '/api/cms/entries', body: entrada({ slug: '../fuera' }) },
        campo: 'slug',
      },
      {
        nombre: 'alt vacío en un item de galería',
        req: {
          method: 'POST',
          url: '/api/cms/gallery/items',
          body: JSON.stringify({ mediaId: 'x', alt: '' }),
        },
        campo: 'alt',
      },
      {
        nombre: 'correo mal formado en el login',
        req: {
          method: 'POST',
          url: '/api/cms/login',
          body: JSON.stringify({ email: 'noesemail', password: 'x' }),
        },
        campo: 'email',
      },
    ];

    const fallos: string[] = [];
    for (const caso of casos) {
      const res = await ctx.app.inject(authedMut(caso.req));
      const body = res.json<{ error: string; details?: Array<{ field: string }> }>();

      if (res.statusCode !== 400)
        fallos.push(`${caso.nombre}: status ${res.statusCode}, esperaba 400`);
      if (/Error al procesar la solicitud/.test(body.error))
        fallos.push(`${caso.nombre}: sigue devolviendo el mensaje genérico`);
      if (!body.error?.includes(caso.campo))
        fallos.push(
          `${caso.nombre}: el mensaje no nombra el campo "${caso.campo}" → ${body.error}`
        );
      if (!body.details?.some((d) => d.field === caso.campo))
        fallos.push(`${caso.nombre}: details no incluye el campo "${caso.campo}"`);
    }
    expect(fallos).toEqual([]);
  });

  it('traduce los mensajes incorporados de Zod al castellano', async () => {
    const res = await ctx.app.inject(
      authedMut({
        method: 'POST',
        url: '/api/cms/entries',
        body: entrada({ title: 'A'.repeat(5000) }),
      })
    );
    const { details } = res.json<{ details: Array<{ field: string; message: string }> }>();
    expect(details[0].message).toBe('No puede superar 240 caracteres.');
  });

  it('conserva intactos los mensajes que el schema escribe a mano', async () => {
    const res = await ctx.app.inject(
      authedMut({ method: 'POST', url: '/api/cms/entries', body: entrada({ id: 'MAL' }) })
    );
    const { details } = res.json<{ details: Array<{ message: string }> }>();
    expect(details[0].message).toMatch(/^ID debe contener solo letras minúsculas/);
  });
});

describe('A-3 — control de concurrencia optimista', () => {
  let ctx: TestApp;
  let csrfToken: string;
  let cookieHeader: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ csrfToken, cookieHeader } = await ctx.login());
    await ctx.app.inject({
      method: 'POST',
      url: '/api/cms/entries',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: 'test.concurrente',
        kind: 'page',
        slug: '/concurrente',
        title: 'Concurrente',
        fields: { titulo: { type: 'text', value: 'inicial' } },
      }),
    });
  });

  afterAll(async () => {
    await ctx.app.close();
    ctx.cleanup();
  });

  const patch = (value: string, expectedVersion?: number) =>
    ctx.app.inject({
      method: 'PATCH',
      url: '/api/cms/entries/test.concurrente/fields/titulo',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        value,
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
      }),
    });

  it('acepta la escritura que trae la versión vigente', async () => {
    const res = await patch('primera', 1);
    expect(res.statusCode).toBe(200);
    expect(res.json<{ version: number }>().version).toBe(2);
  });

  it('rechaza con 409 una segunda escritura sobre una versión ya superada', async () => {
    // Es el escenario de dos pestañas: la segunda cargó la entrada en v1 y
    // guarda cuando el servidor ya va por v2. Antes ganaba sin avisar.
    const res = await patch('segunda', 1);
    expect(res.statusCode).toBe(409);
    expect(res.json<{ error: string }>().error).toMatch(/Conflicto de edición/i);
  });

  it('sigue aceptando escrituras sin expectedVersion (formulario de colección)', async () => {
    const res = await patch('sin version');
    expect(res.statusCode).toBe(200);
  });
});
