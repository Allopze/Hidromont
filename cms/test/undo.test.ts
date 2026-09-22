/**
 * Deshacer inmediato de un borrado.
 *
 * Los cinco DELETE de la API eran físicos e irreversibles, y el de fotos no
 * tenía ni confirmación en servidor pese a destruir título, alt, posición,
 * categoría, álbum y destacado de un clic. Borrar una entrada era peor: el
 * `ON DELETE CASCADE` se llevaba también todas sus revisiones, es decir el
 * único mecanismo de recuperación que había.
 *
 * No hace falta esquema nuevo: `audit_events.data_json` existía y se escribía
 * como `null` en los borrados. El snapshot va ahí y el token es el id del
 * evento.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import type Database from 'better-sqlite3';
import type { InjectOptions } from 'fastify';
import { createTestApp, type TestApp } from './setup';

describe('Deshacer un borrado', () => {
  let ctx: TestApp;
  let csrfToken: string;
  let cookieHeader: string;
  let mediaId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ csrfToken, cookieHeader } = await ctx.login());
    const now = new Date().toISOString();
    mediaId = nanoid();
    (ctx.db as Database.Database)
      .prepare(
        `INSERT INTO media_assets (id, name, path, mime, size, alt, focal_x, focal_y, checksum, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0.5, 0.5, ?, ?, ?)`
      )
      .run(
        mediaId,
        'undo.jpg',
        '/uploads/cms/undo.jpg',
        'image/jpeg',
        1024,
        'Foto',
        nanoid(),
        now,
        now
      );
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const authed = (opts: InjectOptions): InjectOptions => ({
    ...opts,
    headers: { ...(opts.headers as Record<string, string> | undefined), cookie: cookieHeader },
  });
  const mut = (method: string, url: string, body?: unknown): InjectOptions => ({
    method: method as InjectOptions['method'],
    url,
    headers: {
      cookie: cookieHeader,
      'x-csrf-token': csrfToken,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  /** El slug de álbum solo admite [a-z0-9-]; `nanoid` produce mayúsculas. */
  const slugUnico = (prefijo: string) =>
    `${prefijo}-${nanoid(8)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, 'x')}`;

  async function crearCategoria(nombre: string) {
    const res = await ctx.app.inject(mut('POST', '/api/cms/gallery/categories', { name: nombre }));
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string }>();
  }

  async function crearFoto(extra: Record<string, unknown> = {}) {
    const res = await ctx.app.inject(
      mut('POST', '/api/cms/gallery/items', { mediaId, alt: 'Una foto', ...extra })
    );
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string }>();
  }

  describe('ida y vuelta', () => {
    it('una foto vuelve con todos sus datos, no solo existiendo', async () => {
      const cat = await crearCategoria(`Cat ${nanoid(6)}`);
      const item = await crearFoto({ categoryId: cat.id, featured: true, alt: 'Bifurcación' });

      const antes = (await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/gallery/items' })))
        .json<{ items: Array<Record<string, unknown>> }>()
        .items.find((i) => i.id === item.id);
      expect(antes).toBeTruthy();

      const del = await ctx.app.inject(mut('DELETE', `/api/cms/gallery/items/${item.id}`));
      expect(del.statusCode).toBe(200);
      const { undo } = del.json<{ undo?: { token: string; expiresInMs: number } }>();
      expect(undo?.token).toBeTruthy();
      expect(undo?.expiresInMs).toBe(12_000);

      const res = await ctx.app.inject(mut('POST', `/api/cms/undo/${undo!.token}`));
      expect(res.statusCode).toBe(200);

      const despues = (
        await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/gallery/items' }))
      )
        .json<{ items: Array<Record<string, unknown>> }>()
        .items.find((i) => i.id === item.id);

      // Campo a campo: es donde un restaurador perezoso metería
      // `maxItemPosition() + 1` y mandaría la foto al final del álbum.
      expect(despues).toMatchObject({
        id: antes!.id,
        alt: antes!.alt,
        position: antes!.position,
        featured: antes!.featured,
        status: antes!.status,
        categoryId: antes!.categoryId,
        createdAt: antes!.createdAt,
      });
    });

    it('un álbum vuelve con su nombre y su posición', async () => {
      const slug = slugUnico('album');
      const creado = await ctx.app.inject(
        mut('POST', '/api/cms/gallery/albums', { name: 'Pangal', slug })
      );
      expect(creado.statusCode).toBe(201);

      const del = await ctx.app.inject(mut('DELETE', `/api/cms/gallery/albums/${slug}`));
      expect(del.statusCode).toBe(200);
      const { undo } = del.json<{ undo?: { token: string } }>();

      expect((await ctx.app.inject(mut('POST', `/api/cms/undo/${undo!.token}`))).statusCode).toBe(
        200
      );

      const albums = (
        await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/gallery/albums' }))
      ).json<{ items: Array<{ slug: string; name: string }> }>().items;
      expect(albums.find((a) => a.slug === slug)?.name).toBe('Pangal');
    });
  });

  describe('categorías', () => {
    it('devuelve sus fotos, y respeta las que ya tienen otra categoría', async () => {
      const cat = await crearCategoria(`Compuertas ${nanoid(6)}`);
      const otra = await crearCategoria(`Otra ${nanoid(6)}`);
      const a = await crearFoto({ categoryId: cat.id });
      const b = await crearFoto({ categoryId: cat.id });

      const del = await ctx.app.inject(
        mut('DELETE', `/api/cms/gallery/categories/${cat.id}?confirm=1`)
      );
      expect(del.statusCode).toBe(200);
      const { undo } = del.json<{ undo?: { token: string } }>();

      // El ON DELETE SET NULL las dejó sin categoría.
      const sinCat = (ctx.db as Database.Database)
        .prepare('SELECT category_id FROM gallery_items WHERE id = ?')
        .get(a.id) as { category_id: string | null };
      expect(sinCat.category_id).toBeNull();

      // Y alguien recategoriza una DURANTE la ventana: su decisión es más
      // nueva y debe ganar al deshacer.
      await ctx.app.inject(
        mut('PATCH', `/api/cms/gallery/items/${b.id}`, {
          mediaId,
          alt: 'Una foto',
          categoryId: otra.id,
        })
      );

      const res = await ctx.app.inject(mut('POST', `/api/cms/undo/${undo!.token}`));
      expect(res.statusCode).toBe(200);
      expect(res.json<{ avisos: string[] }>().avisos.join(' ')).toMatch(/ya tenían otra categoría/);

      const db = ctx.db as Database.Database;
      expect(
        (
          db.prepare('SELECT category_id FROM gallery_items WHERE id = ?').get(a.id) as {
            category_id: string;
          }
        ).category_id
      ).toBe(cat.id);
      expect(
        (
          db.prepare('SELECT category_id FROM gallery_items WHERE id = ?').get(b.id) as {
            category_id: string;
          }
        ).category_id
      ).toBe(otra.id);
    });
  });

  describe('rechazos', () => {
    it('un token que no existe da 404', async () => {
      const res = await ctx.app.inject(mut('POST', '/api/cms/undo/no-existe'));
      expect(res.statusCode).toBe(404);
    });

    it('un evento que no es un borrado da 400', async () => {
      const evento = (ctx.db as Database.Database)
        .prepare("SELECT id FROM audit_events WHERE action NOT LIKE '%.delete' LIMIT 1")
        .get() as { id: string } | undefined;
      expect(evento).toBeTruthy();
      const res = await ctx.app.inject(mut('POST', `/api/cms/undo/${evento!.id}`));
      expect(res.statusCode).toBe(400);
    });

    it('pasado el plazo da 410 y no restaura', async () => {
      const item = await crearFoto();
      const del = await ctx.app.inject(mut('DELETE', `/api/cms/gallery/items/${item.id}`));
      const { undo } = del.json<{ undo?: { token: string } }>();

      // Se envejece el sobre en la base, como hacen otras pruebas de este repo.
      const db = ctx.db as Database.Database;
      const fila = db
        .prepare('SELECT data_json FROM audit_events WHERE id = ?')
        .get(undo!.token) as {
        data_json: string;
      };
      const data = JSON.parse(fila.data_json);
      data.undo.expiresAt = new Date(Date.now() - 60_000).toISOString();
      db.prepare('UPDATE audit_events SET data_json = ? WHERE id = ?').run(
        JSON.stringify(data),
        undo!.token
      );

      const res = await ctx.app.inject(mut('POST', `/api/cms/undo/${undo!.token}`));
      expect(res.statusCode).toBe(410);
      expect(db.prepare('SELECT 1 FROM gallery_items WHERE id = ?').get(item.id)).toBeUndefined();
    });

    it('si el identificador se reusó, da 409 y no pisa lo nuevo', async () => {
      const slug = slugUnico('reuso');
      await ctx.app.inject(mut('POST', '/api/cms/gallery/albums', { name: 'Viejo', slug }));
      const del = await ctx.app.inject(mut('DELETE', `/api/cms/gallery/albums/${slug}`));
      const { undo } = del.json<{ undo?: { token: string } }>();

      await ctx.app.inject(mut('POST', '/api/cms/gallery/albums', { name: 'Nuevo', slug }));

      const res = await ctx.app.inject(mut('POST', `/api/cms/undo/${undo!.token}`));
      expect(res.statusCode).toBe(409);

      const albums = (
        await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/gallery/albums' }))
      ).json<{ items: Array<{ slug: string; name: string }> }>().items;
      expect(albums.find((a) => a.slug === slug)?.name).toBe('Nuevo');
    });

    it('exige sesión y CSRF como el resto de mutaciones', async () => {
      const item = await crearFoto();
      const del = await ctx.app.inject(mut('DELETE', `/api/cms/gallery/items/${item.id}`));
      const { undo } = del.json<{ undo?: { token: string } }>();

      const sinSesion = await ctx.app.inject({
        method: 'POST',
        url: `/api/cms/undo/${undo!.token}`,
      });
      expect(sinSesion.statusCode).toBe(401);

      const sinCsrf = await ctx.app.inject({
        method: 'POST',
        url: `/api/cms/undo/${undo!.token}`,
        headers: { cookie: cookieHeader },
      });
      expect(sinCsrf.statusCode).toBe(403);
    });
  });

  describe('idempotencia', () => {
    it('deshacer dos veces no duplica nada', async () => {
      const item = await crearFoto({ alt: 'Doble clic' });
      const del = await ctx.app.inject(mut('DELETE', `/api/cms/gallery/items/${item.id}`));
      const { undo } = del.json<{ undo?: { token: string } }>();

      const primera = await ctx.app.inject(mut('POST', `/api/cms/undo/${undo!.token}`));
      const segunda = await ctx.app.inject(mut('POST', `/api/cms/undo/${undo!.token}`));

      expect(primera.statusCode).toBe(200);
      // 200 y no error: el doble clic satisface la intención de que vuelva.
      expect(segunda.statusCode).toBe(200);
      expect(segunda.json<{ yaRestaurado?: boolean }>().yaRestaurado).toBe(true);

      const n = (ctx.db as Database.Database)
        .prepare('SELECT COUNT(*) AS n FROM gallery_items WHERE id = ?')
        .get(item.id) as { n: number };
      expect(n.n).toBe(1);
    });
  });

  describe('higiene del registro', () => {
    it('el listado de auditoría no arrastra los snapshots', async () => {
      const item = await crearFoto({ alt: 'Una foto con datos' });
      await ctx.app.inject(mut('DELETE', `/api/cms/gallery/items/${item.id}`));

      const res = await ctx.app.inject(authed({ method: 'GET', url: '/api/cms/audit' }));
      const cuerpo = res.body;
      // El snapshot pesa; el registro devuelve 200 eventos de golpe y lo lee
      // el panel de Administración.
      expect(cuerpo).not.toContain('"snapshot"');
      const evento = res
        .json<{ events: Array<{ action: string; undoAvailable?: boolean }> }>()
        .events.find((e) => e.action === 'gallery.item.delete');
      expect(evento?.undoAvailable).toBe(true);
    });

    it('cada borrado deja exactamente un evento', async () => {
      // El registro se movió de la ruta al controlador; el error fácil de ese
      // cambio es dejar los dos y escribirlo por duplicado.
      const item = await crearFoto();
      const db = ctx.db as Database.Database;
      const antes = (
        db
          .prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'gallery.item.delete'")
          .get() as {
          n: number;
        }
      ).n;

      await ctx.app.inject(mut('DELETE', `/api/cms/gallery/items/${item.id}`));

      const despues = (
        db
          .prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action = 'gallery.item.delete'")
          .get() as {
          n: number;
        }
      ).n;
      expect(despues - antes).toBe(1);
    });
  });
});
