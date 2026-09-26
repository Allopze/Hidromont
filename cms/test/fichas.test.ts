/**
 * Ciclo de vida de una ficha de colección sobre las rutas reales (P1-02, P1-03,
 * auditoría 2026-09).
 *
 * Antes: un proyecto creado desde el panel nacía con id `proyecto.<slug>` (la
 * página pide `proyectos.<slug>`), sin cliente ni datos técnicos, sin foto ni
 * galería; cambiarle la dirección dejaba el `.md` viejo publicado, le quitaba
 * las fotos y la URL vieja daba 404; borrarlo dejaba su `.md`, que el arranque
 * reimportaba como ficha nueva.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-fichas-'));
const contentRoot = path.join(dir, 'content-root');
for (const rel of ['src/content', 'src/data']) {
  fs.cpSync(path.join(repoRoot, rel), path.join(contentRoot, rel), { recursive: true });
}
const galeria = path.join(contentRoot, 'src', 'data', 'gallery.json');
fs.writeFileSync(
  galeria,
  JSON.stringify({ ...JSON.parse(fs.readFileSync(galeria, 'utf8')), items: [] })
);

process.env.CMS_DATABASE_PATH = path.join(dir, 'cms.sqlite');
process.env.CMS_CONTENT_ROOT_DIR = contentRoot;
process.env.CMS_UPLOAD_DIR = path.join(dir, 'uploads');
process.env.CMS_BACKUP_DIR = path.join(dir, 'backups');
process.env.CMS_PUBLISH_CHECK_COMMAND = 'true';
process.env.CMS_ADMIN_EMAIL = 'fichas@test.local';
process.env.CMS_ADMIN_PASSWORD = 'Fichas-Test-Pass-123!';

let app: FastifyInstance;
let H: Record<string, string>;

async function arrancar() {
  const { registerCmsRoutes } = await import('../routes/cmsRoutes');
  app = fastify({ logger: false });
  await registerCmsRoutes(app);
  await app.ready();
  const login = await app.inject({
    method: 'POST',
    url: '/api/cms/login',
    payload: { email: process.env.CMS_ADMIN_EMAIL, password: process.env.CMS_ADMIN_PASSWORD },
  });
  H = {
    cookie: login.cookies.map((c) => `${c.name}=${c.value}`).join('; '),
    'x-csrf-token': login.json().csrfToken,
  };
}

const md = (slug: string) => path.join(contentRoot, 'src', 'content', 'proyectos', `${slug}.md`);
const get = (url: string) => app.inject({ method: 'GET', url, headers: H });
const patch = (url: string, payload: unknown) =>
  app.inject({ method: 'PATCH', url, headers: H, payload: payload as object });
const publicar = () => app.inject({ method: 'POST', url: '/api/cms/publish', headers: H });

beforeAll(arrancar, 60_000);

afterAll(async () => {
  await app?.close();
  const { getDb } = await import('../db/connection');
  getDb().close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('Ficha de proyecto creada desde el panel', () => {
  it('nace con el id del sitio, todos sus campos y foto y galería editables', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/cms/entries',
      headers: H,
      payload: {
        id: 'proyecto.obra-auditoria', // lo que mandaba el panel: el servidor lo corrige
        kind: 'proyecto',
        slug: 'obra-auditoria',
        title: 'Obra Auditoría',
        status: 'published',
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().id).toBe('proyectos.obra-auditoria');

    // Lo que pide la página al pulsar: id construido por slug.
    expect((await get('/api/cms/entries/proyectos.obra-auditoria')).statusCode).toBe(200);
    for (const [url, value] of [
      ['/api/cms/entries/proyectos.obra-auditoria/fields/cliente', 'Colbún'],
      ['/api/cms/entries/proyectos.obra-auditoria/fields/diametro', 'Ø 2.200'],
      [
        '/api/cms/entries/project-image.obra-auditoria/fields/image',
        '/fotos/curadas/compuertas.webp',
      ],
      [
        '/api/cms/entries/project-gallery.obra-auditoria/fields/gallery1',
        '/fotos/curadas/valvulas.webp',
      ],
    ] as const) {
      const r = await patch(url, { value });
      expect(r.statusCode, `${url}: ${r.body}`).toBe(200);
    }

    expect((await publicar()).statusCode).toBe(200);
    const texto = fs.readFileSync(md('obra-auditoria'), 'utf8');
    expect(texto).toContain('cliente: Colbún');
    // Los opcionales vacíos no llegan al .md (el schema del sitio los rechazaría).
    expect(texto).not.toMatch(/^servicio:/m);
    expect(texto).not.toMatch(/^mandante:/m);
    const cms = JSON.parse(
      fs.readFileSync(path.join(contentRoot, 'src/data/cms-content.json'), 'utf8')
    );
    expect(cms.entries['project-image.obra-auditoria'].fields.image.value).toBe(
      '/fotos/curadas/compuertas.webp'
    );
  });

  it('un servicio creado en el panel se puede asignar a un proyecto', async () => {
    const creado = await app.inject({
      method: 'POST',
      url: '/api/cms/entries',
      headers: H,
      payload: {
        kind: 'servicio',
        slug: 'servicio-auditoria',
        title: 'Servicio Auditoría',
        id: 'x',
        status: 'published',
      },
    });
    expect(creado.statusCode, creado.body).toBe(201);
    const schema = (await get('/api/cms/schema')).json();
    expect(schema.enumFields.proyecto.servicio.map((o: { value: string }) => o.value)).toContain(
      'servicio-auditoria'
    );
    const r = await patch('/api/cms/entries/proyectos.obra-auditoria/fields/servicio', {
      value: 'servicio-auditoria',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(
      (
        await patch('/api/cms/entries/proyectos.obra-auditoria/fields/servicio', {
          value: 'no-existe',
        })
      ).statusCode
    ).toBe(400);
  });

  it('cambiar la dirección dos veces lleva consigo las fotos, poda los .md y redirige', async () => {
    for (const slug of ['obra-auditoria-2', 'obra-auditoria-3']) {
      const r = await patch('/api/cms/entries/proyectos.obra-auditoria', { slug });
      expect(r.statusCode, r.body).toBe(200);
    }
    expect((await publicar()).statusCode).toBe(200);

    expect(fs.existsSync(md('obra-auditoria'))).toBe(false);
    expect(fs.existsSync(md('obra-auditoria-2'))).toBe(false);
    expect(fs.existsSync(md('obra-auditoria-3'))).toBe(true);

    // La foto y la galería siguen a la ficha; la página nueva las encuentra.
    const img = (await get('/api/cms/entries/project-image.obra-auditoria-3')).json();
    expect(img.fields.image.value).toBe('/fotos/curadas/compuertas.webp');
    expect((await get('/api/cms/entries/project-image.obra-auditoria')).statusCode).toBe(404);
    // Editar en contexto la página nueva funciona (id por slug).
    expect((await get('/api/cms/entries/proyectos.obra-auditoria-3')).statusCode).toBe(200);

    const { SlugRepository } = await import('../repositories/SlugRepository');
    const { getDb } = await import('../db/connection');
    const redir = new SlugRepository(getDb()).listRedirects();
    expect(redir).toEqual(
      expect.arrayContaining([
        { from: '/proyectos/obra-auditoria', to: '/proyectos/obra-auditoria-3' },
        { from: '/proyectos/obra-auditoria-2', to: '/proyectos/obra-auditoria-3' },
      ])
    );

    // El servidor del sitio sirve el 301, con y sin barra final, y en un solo
    // salto a la forma canónica, con barra (P2-27).
    const { registerStaticSite } = await import('../staticSite');
    const sitio = fastify({ logger: false });
    registerStaticSite(sitio);
    for (const [pedida, destino] of [
      ['/proyectos/obra-auditoria', '/proyectos/obra-auditoria-3/'],
      ['/proyectos/obra-auditoria-2/', '/proyectos/obra-auditoria-3/'],
    ]) {
      const res = await sitio.inject({ method: 'GET', url: pedida });
      expect(res.statusCode, pedida).toBe(301);
      expect(res.headers.location).toBe(destino);
    }
    await sitio.close();
  });

  it('borrar un servicio citado pide confirmación y el proyecto deja de enlazarlo', async () => {
    const sin = await app.inject({
      method: 'DELETE',
      url: '/api/cms/entries/servicios.servicio-auditoria',
      headers: H,
    });
    expect(sin.statusCode).toBe(409);
    expect(sin.json().error).toMatch(/Obra Auditoría/);
    const con = await app.inject({
      method: 'DELETE',
      url: '/api/cms/entries/servicios.servicio-auditoria?confirm=1',
      headers: H,
    });
    expect(con.statusCode, con.body).toBe(200);
    expect((await publicar()).statusCode).toBe(200);
    expect(fs.readFileSync(md('obra-auditoria-3'), 'utf8')).not.toMatch(/^servicio:/m);
  });

  it('borrar la ficha quita su .md y un reinicio no la resucita', async () => {
    const r = await app.inject({
      method: 'DELETE',
      url: '/api/cms/entries/proyectos.obra-auditoria-3',
      headers: H,
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(fs.existsSync(md('obra-auditoria-3'))).toBe(false);
    const { SlugRepository } = await import('../repositories/SlugRepository');
    const { getDb } = await import('../db/connection');
    expect(new SlugRepository(getDb()).listRedirects()).toEqual([]);

    // El .md reaparece (p. ej. traído por git) y se reinicia el CMS.
    fs.writeFileSync(
      md('obra-auditoria-2'),
      '---\nnombre: Resto\nalcance: x\ncategoria: tuberias\n---\n'
    );
    await app.close();
    await arrancar();
    expect((await get('/api/cms/entries/proyectos.obra-auditoria-2')).statusCode).toBe(404);
    // Y la siguiente publicación lo poda.
    expect((await publicar()).statusCode).toBe(200);
    expect(fs.existsSync(md('obra-auditoria-2'))).toBe(false);
  });
});

describe('P1-04 / P2-15: el CMS no acepta lo que el sitio no puede publicar', () => {
  it('rechaza direcciones con barra o punto', async () => {
    for (const slug of ['tanques/316l', 'tanques.glp', 'Con Espacios']) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/cms/entries',
        headers: H,
        payload: { id: 'x', kind: 'proyecto', slug, title: 'Prueba' },
      });
      expect(res.statusCode, slug).toBe(400);
    }
  });

  it('no deja vaciar «Orden» ni los textos obligatorios, y recorta espacios', async () => {
    const orden = await patch('/api/cms/entries/proyectos.ch-besaya/fields/orden', { value: null });
    expect(orden.statusCode).toBe(400);
    expect(orden.json().error).toMatch(/obligatorio/);

    const seo = await patch('/api/cms/entries/proyectos.index.hero/fields/seoTitle', {
      value: '   ',
    });
    expect(seo.statusCode).toBe(400);

    const cliente = await patch('/api/cms/entries/proyectos.ch-besaya/fields/cliente', {
      value: '  Colbún S.A.  ',
    });
    expect(cliente.statusCode, cliente.body).toBe(200);
    const entrada = (await get('/api/cms/entries/proyectos.ch-besaya')).json();
    expect(entrada.fields.cliente.value).toBe('Colbún S.A.');
  });
});
