/**
 * Pruebas contra `cms/routes/cmsRoutes.ts` de verdad.
 *
 * El resto de la suite usa `setup.ts`, que monta su propia tabla de rutas.
 * Eso las hace rápidas y aisladas, pero deja el archivo real sin cubrir: una
 * expresión regular borró 25 de sus 43 rutas y las 322 pruebas siguieron en
 * verde. Aquí se registra el archivo real contra una base temporal y se fija
 * lo que no puede cambiar sin que alguien lo decida: qué rutas existen, cuáles
 * son públicas, que las de escritura exigen CSRF y que la auditoría se escribe.
 *
 * Qué NO se prueba aquí, a propósito: nada que escriba en disco fuera de la
 * base. `registerCmsRoutes` resuelve las rutas de contenido contra la raíz
 * real del repositorio, así que borrar una ficha o exportar desde este archivo
 * tocaría `src/content` de verdad. Esos flujos siguen en las suites de
 * `setup.ts`, que sí aíslan la raíz.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// El config y la conexión leen el entorno al importarse: hay que fijarlo antes
// del import dinámico. `process.loadEnvFile` no pisa variables ya definidas,
// así que el .env local no puede redirigir esto a la base de desarrollo.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-rutas-'));
process.env.CMS_DATABASE_PATH = path.join(dir, 'cms.sqlite');
process.env.CMS_ADMIN_EMAIL = 'rutas@test.local';
process.env.CMS_ADMIN_PASSWORD = 'Rutas-Test-Pass-123!';

let app: FastifyInstance;
const rutas: string[] = [];

beforeAll(async () => {
  const { registerCmsRoutes } = await import('../routes/cmsRoutes');
  app = fastify({ logger: false });
  app.addHook('onRoute', (r) => {
    const metodos = Array.isArray(r.method) ? r.method : [r.method];
    for (const m of metodos) {
      // Fastify añade HEAD a cada GET por su cuenta; no es una decisión de
      // este archivo y solo duplicaría la lista.
      if (m !== 'HEAD') rutas.push(`${m} ${r.url}`);
    }
  });
  await registerCmsRoutes(app);
  await app.ready();
}, 60_000);

afterAll(async () => {
  await app?.close();
  const { getDb } = await import('../db/connection');
  getDb().close();
  fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * La lista completa, escrita a mano. Si una ruta aparece o desaparece, esta
 * prueba falla y obliga a decidir si era intencionado: justo lo que habría
 * delatado el borrado accidental de 25 rutas.
 */
const RUTAS_ESPERADAS = [
  'GET /api/cms/health',
  'POST /api/cms/login',
  'POST /api/cms/logout',
  'GET /api/cms/session',
  'POST /api/cms/password',
  'GET /api/cms/manifest',
  'GET /api/cms/entries',
  'POST /api/cms/entries',
  'GET /api/cms/entries/:id',
  'PATCH /api/cms/entries/:id',
  'PATCH /api/cms/entries/:id/fields/:key',
  'DELETE /api/cms/entries/:id',
  'POST /api/cms/undo/:token',
  'GET /api/cms/audit',
  'GET /api/cms/media',
  'GET /api/cms/media/:id',
  'POST /api/cms/media',
  'PATCH /api/cms/media/:id',
  'DELETE /api/cms/media/:id',
  'POST /api/cms/export',
  'POST /api/cms/publish',
  'GET /api/cms/publish/jobs',
  'GET /api/cms/publish/jobs/:id',
  'GET /api/cms/publish/pending',
  'GET /api/cms/revisions/:entryId',
  'POST /api/cms/revisions/:entryId/restore/:revisionId',
  'POST /api/cms/backup',
  'GET /api/cms/backup/list',
  'GET /api/cms/schema',
  'GET /api/cms/gallery/albums',
  'POST /api/cms/gallery/albums',
  'PATCH /api/cms/gallery/albums/:slug',
  'DELETE /api/cms/gallery/albums/:slug',
  'POST /api/cms/gallery/albums/reorder',
  'GET /api/cms/gallery/categories',
  'POST /api/cms/gallery/categories',
  'PATCH /api/cms/gallery/categories/:id',
  'DELETE /api/cms/gallery/categories/:id',
  'POST /api/cms/gallery/categories/reorder',
  'GET /api/cms/gallery/items',
  'GET /api/cms/gallery/items/:id',
  'POST /api/cms/gallery/items',
  'PATCH /api/cms/gallery/items/:id',
  'DELETE /api/cms/gallery/items/:id',
  'POST /api/cms/gallery/items/reorder',
];

/** Las únicas rutas que responden sin sesión. Cada una tiene su motivo. */
const PUBLICAS = new Set([
  'GET /api/cms/health', // monitorización; no devuelve datos del negocio
  'POST /api/cms/login',
  'GET /api/cms/session', // el overlay pregunta si hay sesión antes de pintar
]);

// Solo las rutas de la API: CORS registra OPTIONS por su cuenta.
const propias = () => rutas.filter((r) => /^(GET|POST|PATCH|DELETE) \/api\/cms/.test(r));

function partir(ruta: string) {
  const [method, url] = ruta.split(' ') as ['GET' | 'POST' | 'PATCH' | 'DELETE', string];
  // Los parámetros se rellenan con un valor cualquiera: la autenticación
  // corre antes que el controlador, así que no hace falta que exista.
  return { method, url: url.replace(/:[a-zA-Z]+/g, 'x') };
}

async function iniciarSesion() {
  const res = await app.inject({
    method: 'POST',
    url: '/api/cms/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: process.env.CMS_ADMIN_EMAIL, password: process.env.CMS_ADMIN_PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  const csrfToken = res.json<{ csrfToken: string }>().csrfToken;
  const cookie = ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .map((c) => c.split(';')[0])
    .join('; ');
  return { csrfToken, cookie };
}

describe('cmsRoutes.ts: inventario', () => {
  it('registra exactamente las rutas esperadas', () => {
    expect([...propias()].sort()).toEqual([...RUTAS_ESPERADAS].sort());
  });

  it('la tabla de setup.ts no prueba rutas que no existen', async () => {
    // setup.ts duplica la tabla. Si una ruta desaparece de aquí pero sigue
    // allí, sus pruebas pasarían contra algo que producción ya no tiene. No se
    // exige paridad total: setup.ts omite export, backup y otras a propósito.
    const { createTestApp } = await import('./setup');
    const t = await createTestApp();
    try {
      const inventadas = t.routes.filter((r) => !propias().includes(r));
      expect(inventadas).toEqual([]);
    } finally {
      await t.app.close();
      t.cleanup();
    }
  });
});

describe('cmsRoutes.ts: autenticación y CSRF', () => {
  it('toda ruta no pública responde 401 sin sesión', async () => {
    const abiertas: string[] = [];
    for (const r of propias()) {
      if (PUBLICAS.has(r)) continue;
      const res = await app.inject(partir(r));
      if (res.statusCode !== 401) abiertas.push(`${r} → ${res.statusCode}`);
    }
    expect(abiertas).toEqual([]);
  });

  it('toda ruta de escritura con sesión rechaza la petición sin token CSRF', async () => {
    const { cookie } = await iniciarSesion();
    const sinGuarda: string[] = [];
    for (const r of propias()) {
      if (r.startsWith('GET ') || PUBLICAS.has(r)) continue;
      const res = await app.inject({ ...partir(r), headers: { cookie } });
      if (res.statusCode !== 403) sinGuarda.push(`${r} → ${res.statusCode}`);
    }
    expect(sinGuarda).toEqual([]);
  });
});

describe('cmsRoutes.ts: auditoría', () => {
  async function eventos(cookie: string) {
    const res = await app.inject({ method: 'GET', url: '/api/cms/audit', headers: { cookie } });
    return res.json<{ events: { action: string; entityId?: string }[] }>().events;
  }

  it('registra el inicio de sesión', async () => {
    const { cookie } = await iniciarSesion();
    expect((await eventos(cookie)).some((e) => e.action === 'login.success')).toBe(true);
  });

  it('registra la edición de un campo', async () => {
    const { cookie, csrfToken } = await iniciarSesion();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/cms/entries/contact.form/fields/subject',
      headers: { cookie, 'x-csrf-token': csrfToken, 'content-type': 'application/json' },
      payload: { value: 'Asunto de prueba' },
    });
    expect(res.statusCode).toBe(200);
    const e = (await eventos(cookie)).find((x) => x.action === 'field.update');
    expect(e?.entityId).toBe('contact.form');
  });

  it('borrar una categoría de galería ofrece deshacer, y deshacer la devuelve', async () => {
    // Una categoría y no un ítem: el ítem exige un medio subido, y subirlo
    // escribiría en disco. La ruta de deshacer es la misma para las dos.
    const { cookie, csrfToken } = await iniciarSesion();
    const cabeceras = { cookie, 'x-csrf-token': csrfToken };

    const creada = await app.inject({
      method: 'POST',
      url: '/api/cms/gallery/categories',
      headers: { ...cabeceras, 'content-type': 'application/json' },
      payload: { name: 'Prueba de rutas' },
    });
    expect(creada.statusCode).toBe(201);
    const id = creada.json<{ id: string }>().id;

    const borrada = await app.inject({
      method: 'DELETE',
      url: `/api/cms/gallery/categories/${id}`,
      headers: cabeceras,
    });
    expect(borrada.statusCode).toBe(200);
    const token = borrada.json<{ undo?: { token: string } }>().undo?.token;
    expect(token).toBeTruthy();

    const deshecha = await app.inject({
      method: 'POST',
      url: `/api/cms/undo/${token}`,
      headers: cabeceras,
    });
    expect(deshecha.statusCode).toBe(200);

    const lista = await app.inject({
      method: 'GET',
      url: '/api/cms/gallery/categories',
      headers: { cookie },
    });
    const categorias = lista.json<{ items: { id: string; name: string }[] }>().items;
    expect(categorias.find((c) => c.id === id)?.name).toBe('Prueba de rutas');
  });
});
