/**
 * «Publicar» de punta a punta sobre `cms/routes/cmsRoutes.ts` de verdad.
 *
 * P1-09 (auditoría 2026-09): ninguna prueba ejercitaba una publicación real —
 * las e2e interceptan `POST /api/cms/publish` y el sandbox publica con
 * `false`—, y por eso el bloqueo P0-01 (quitar una foto dejaba el botón
 * «Publicar» inutilizable) pasó todas las suites.
 *
 * Aquí se registra el cableado real contra una base nueva y una raíz de
 * contenido temporal (copia de src/content y src/data), así que exportar no
 * toca el repositorio. El comando de comprobación es `true`: lo que se prueba
 * es la tubería export → job, no el build de Astro.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-publicar-'));
const contentRoot = path.join(dir, 'content-root');
for (const rel of ['src/content', 'src/data']) {
  fs.cpSync(path.join(repoRoot, rel), path.join(contentRoot, rel), { recursive: true });
}
// Base nueva: la galería versionada tiene fotos que esta base no conoce.
const galeriaCopia = path.join(contentRoot, 'src', 'data', 'gallery.json');
fs.writeFileSync(
  galeriaCopia,
  JSON.stringify({ ...JSON.parse(fs.readFileSync(galeriaCopia, 'utf8')), items: [] })
);

// El config lee el entorno al importarse: fijarlo antes del import dinámico.
process.env.CMS_DATABASE_PATH = path.join(dir, 'cms.sqlite');
process.env.CMS_CONTENT_ROOT_DIR = contentRoot;
process.env.CMS_UPLOAD_DIR = path.join(dir, 'uploads');
process.env.CMS_BACKUP_DIR = path.join(dir, 'backups');
process.env.CMS_PUBLISH_CHECK_COMMAND = 'true';
process.env.CMS_ADMIN_EMAIL = 'publicar@test.local';
process.env.CMS_ADMIN_PASSWORD = 'Publicar-Test-Pass-123!';

let app: FastifyInstance;
let H: Record<string, string>;

const leerJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(contentRoot, rel), 'utf8'));

beforeAll(async () => {
  const { registerCmsRoutes } = await import('../routes/cmsRoutes');
  app = fastify({ logger: false });
  await registerCmsRoutes(app);
  await app.ready();
  const login = await app.inject({
    method: 'POST',
    url: '/api/cms/login',
    payload: { email: process.env.CMS_ADMIN_EMAIL, password: process.env.CMS_ADMIN_PASSWORD },
  });
  expect(login.statusCode).toBe(200);
  H = {
    cookie: login.cookies.map((c) => `${c.name}=${c.value}`).join('; '),
    'x-csrf-token': login.json().csrfToken,
  };
}, 60_000);

afterAll(async () => {
  await app?.close();
  const { getDb } = await import('../db/connection');
  getDb().close();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function publicar() {
  return app.inject({ method: 'POST', url: '/api/cms/publish', headers: H });
}

describe('Publicar (rutas reales, raíz temporal)', () => {
  it('un texto guardado llega a cms-content.json al publicar', async () => {
    const entry = (
      await app.inject({ method: 'GET', url: '/api/cms/entries/home.hero', headers: H })
    ).json();
    const nuevo = `${entry.fields.title.value} · publicado en prueba`;
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/cms/entries/home.hero/fields/title',
      headers: H,
      payload: { value: nuevo, expectedVersion: entry.version },
    });
    expect(patch.statusCode).toBe(200);

    const res = await publicar();
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().job.status).toBe('succeeded');
    expect(leerJson('src/data/cms-content.json').entries['home.hero'].fields.title.value).toBe(
      nuevo
    );
  });

  it('P0-01: quitar u ocultar una foto no bloquea las publicaciones siguientes', async () => {
    // El arranque registra public/fotos en la biblioteca: se usan esos medios.
    const { getDb } = await import('../db/connection');
    const medios = getDb()
      .prepare(`SELECT id FROM media_assets WHERE path LIKE '/fotos/curadas/%.webp' LIMIT 3`)
      .all() as { id: string }[];
    expect(medios).toHaveLength(3);
    const ids: string[] = [];
    for (const [i, medio] of medios.entries()) {
      const creada = await app.inject({
        method: 'POST',
        url: '/api/cms/gallery/items',
        headers: H,
        payload: { mediaId: medio.id, alt: `Foto de prueba ${i}`, status: 'published' },
      });
      expect(creada.statusCode, creada.body).toBe(201);
      ids.push(creada.json().id);
    }

    expect((await publicar()).statusCode).toBe(200);
    expect(leerJson('src/data/gallery.json').items).toHaveLength(3);

    const borrado = await app.inject({
      method: 'DELETE',
      url: `/api/cms/gallery/items/${ids[0]}`,
      headers: H,
    });
    expect(borrado.statusCode).toBe(200);
    const oculta = await app.inject({
      method: 'PATCH',
      url: `/api/cms/gallery/items/${ids[1]}`,
      headers: H,
      payload: { status: 'draft' },
    });
    expect(oculta.statusCode).toBe(200);

    for (let vez = 0; vez < 2; vez += 1) {
      const res = await publicar();
      expect(res.statusCode, res.body).toBe(200);
    }
    expect(leerJson('src/data/gallery.json').items.map((i: { id: string }) => i.id)).toEqual([
      ids[2],
    ]);
  });
});

describe('P1-05: borrar una imagen en uso no publica imágenes rotas', () => {
  it('avisa aunque el uso no esté registrado, y al confirmar vacía el campo', async () => {
    const { getDb } = await import('../db/connection');
    const medio = getDb()
      .prepare(
        `SELECT id, path FROM media_assets WHERE path LIKE '/fotos/curadas/%.webp' LIMIT 1 OFFSET 5`
      )
      .get() as { id: string; path: string };
    // Sin mediaId: el uso no queda en media_usages (como 28 de 70 en la base local).
    const entry = (
      await app.inject({
        method: 'GET',
        url: '/api/cms/entries/service-gallery.compuertas',
        headers: H,
      })
    ).json();
    const puesto = await app.inject({
      method: 'PATCH',
      url: '/api/cms/entries/service-gallery.compuertas/fields/gallery1',
      headers: H,
      payload: { value: medio.path, expectedVersion: entry.version },
    });
    expect(puesto.statusCode, puesto.body).toBe(200);

    const sinConfirmar = await app.inject({
      method: 'DELETE',
      url: `/api/cms/media/${medio.id}`,
      headers: H,
    });
    expect(sinConfirmar.statusCode).toBe(409);
    expect(sinConfirmar.json().error).toMatch(/service-gallery\.compuertas\.gallery1/);

    const confirmado = await app.inject({
      method: 'DELETE',
      url: `/api/cms/media/${medio.id}?confirm=1`,
      headers: H,
    });
    expect(confirmado.statusCode, confirmado.body).toBe(200);
    const despues = (
      await app.inject({
        method: 'GET',
        url: '/api/cms/entries/service-gallery.compuertas',
        headers: H,
      })
    ).json();
    expect(despues.fields.gallery1.value).toBe('');
  });

  it('la publicación lista los campos que apuntan a archivos que no existen', async () => {
    const entry = (
      await app.inject({
        method: 'GET',
        url: '/api/cms/entries/service-gallery.compuertas',
        headers: H,
      })
    ).json();
    // P3-12: la API ya no acepta una ruta que no existe…
    const rechazo = await app.inject({
      method: 'PATCH',
      url: '/api/cms/entries/service-gallery.compuertas/fields/gallery2',
      headers: H,
      payload: { value: '/fotos/no-existe-auditoria.webp', expectedVersion: entry.version },
    });
    expect(rechazo.statusCode).toBe(400);
    expect(rechazo.json().error).toMatch(/No hay ningún archivo/);
    // …pero un archivo puede desaparecer después de elegirlo: se simula
    // escribiendo la ruta directamente en la base.
    const { getDb } = await import('../db/connection');
    getDb()
      .prepare(`UPDATE content_fields SET value_json = ? WHERE entry_id = ? AND key = ?`)
      .run(
        JSON.stringify('/fotos/no-existe-auditoria.webp'),
        'service-gallery.compuertas',
        'gallery2'
      );
    const res = await publicar();
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().exported.missingFiles).toContain(
      'service-gallery.compuertas.gallery2 → /fotos/no-existe-auditoria.webp'
    );
  });
});

describe('P2-04: errores con su estado y un motivo en palabras', () => {
  it('restaurar una revisión inexistente da 404, no el 500 crudo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/revisions/home.hero/restore/no-existe',
      headers: H,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).not.toMatch(/Internal Server Error/);
  });

  it('dos exportaciones a la vez: la segunda recibe 409 con «en curso»', async () => {
    const [a, b] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/cms/export', headers: H }),
      app.inject({ method: 'POST', url: '/api/cms/export', headers: H }),
    ]);
    const estados = [a.statusCode, b.statusCode].sort();
    expect(estados).toEqual([200, 409]);
    const rechazada = a.statusCode === 409 ? a : b;
    expect(rechazada.json().error).toMatch(/en curso/);
  });

  it('un fallo de compilación se explica y lleva el identificador del job', async () => {
    const { explicarFalloDePublicacion } = await import('../services/publishService');
    const datos = explicarFalloDePublicacion(
      Object.assign(new Error('Command failed'), {
        stdout:
          '[InvalidContentEntryDataError] proyectos → ch-besaya data does not match collection schema.\n  **orden**: Expected type "number", received "null"',
      }),
      'job-1'
    );
    expect(datos.statusCode).toBe(422);
    expect(datos.mensajeUsuario).toMatch(/Una ficha tiene un dato que el sitio no acepta/);
    expect(datos.mensajeUsuario).toMatch(/orden/);
    expect(datos.extra).toEqual({ job: 'job-1' });

    const ocupado = explicarFalloDePublicacion(
      Object.assign(new Error('x'), { stdout: '# Ya hay otro build en curso (ver .build.lock)' }),
      'job-2'
    );
    expect(ocupado.statusCode).toBe(409);
  });
});

describe('P2-24: el contador de cambios cuenta reordenar la galería y borrar fotos', () => {
  it('reordenar fotos aparece como cambio pendiente de publicar', async () => {
    expect((await publicar()).statusCode).toBe(200);
    const antes = (
      await app.inject({ method: 'GET', url: '/api/cms/publish/pending', headers: H })
    ).json();
    expect(antes.cambios.map((c: { clave: string }) => c.clave)).not.toContain('galeria-orden');

    const items = (
      await app.inject({ method: 'GET', url: '/api/cms/gallery/items', headers: H })
    ).json();
    const ids = (items.items ?? items).map((i: { id: string }) => i.id).reverse();
    const orden = await app.inject({
      method: 'POST',
      url: '/api/cms/gallery/items/reorder',
      headers: H,
      payload: { ids },
    });
    expect(orden.statusCode, orden.body).toBe(200);
    const despues = (
      await app.inject({ method: 'GET', url: '/api/cms/publish/pending', headers: H })
    ).json();
    const cambio = despues.cambios.find((c: { clave: string }) => c.clave === 'galeria-orden');
    expect(cambio?.detalle).toContain('orden de las fotos');
  });
});
