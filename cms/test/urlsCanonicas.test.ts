/**
 * P2-27 (auditoría 2026-09): cada página respondía 200 en varias direcciones.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { direccionCanonica } from '../staticSite';
import { conBarra } from '../../src/utils/enlacesConBarra.mjs';

const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-canon-'));
fs.mkdirSync(path.join(raiz, 'servicios', 'compuertas'), { recursive: true });
fs.writeFileSync(path.join(raiz, 'index.html'), '');
fs.writeFileSync(path.join(raiz, 'servicios', 'index.html'), '');
fs.writeFileSync(path.join(raiz, 'servicios', 'compuertas', 'index.html'), '');
fs.writeFileSync(path.join(raiz, 'robots.txt'), '');
afterAll(() => fs.rmSync(raiz, { recursive: true, force: true }));

describe('direccionCanonica', () => {
  it('añade la barra a una página que existe, conservando la consulta', async () => {
    expect(await direccionCanonica('/servicios/compuertas', raiz)).toBe('/servicios/compuertas/');
    expect(await direccionCanonica('/servicios?cms=1', raiz)).toBe('/servicios/?cms=1');
  });

  it('la forma con barra y los archivos se sirven tal cual', async () => {
    expect(await direccionCanonica('/servicios/compuertas/', raiz)).toBeNull();
    expect(await direccionCanonica('/', raiz)).toBeNull();
    expect(await direccionCanonica('/robots.txt', raiz)).toBeNull();
    expect(await direccionCanonica('/no-existe', raiz)).toBeNull();
  });

  it('quita index.html y colapsa las barras dobles', async () => {
    expect(await direccionCanonica('/index.html', raiz)).toBe('/');
    expect(await direccionCanonica('/servicios/compuertas/index.html', raiz)).toBe(
      '/servicios/compuertas/'
    );
    expect(await direccionCanonica('//xyz-no-existe', raiz)).toBe('/xyz-no-existe');
    expect(await direccionCanonica('/servicios//compuertas/', raiz)).toBe('/servicios/compuertas/');
  });
});

describe('conBarra', () => {
  const existe = (ruta: string) => ['/servicios', '/servicios/compuertas'].includes(ruta);
  it('añade la barra solo a enlaces internos de páginas que existen', () => {
    const html =
      '<a href="/servicios/compuertas">a</a><a href="/servicios#x">b</a><a href="/logo.png">c</a>' +
      '<a href="https://otro.cl/servicios">d</a><a href="/no-existe">e</a><a href="//cdn/x">f</a>';
    expect(conBarra(html, existe)).toBe(
      '<a href="/servicios/compuertas/">a</a><a href="/servicios/#x">b</a><a href="/logo.png">c</a>' +
        '<a href="https://otro.cl/servicios">d</a><a href="/no-existe">e</a><a href="//cdn/x">f</a>'
    );
  });
});

describe('P3-02: configuración de otros hostings', () => {
  it('/_headers, /_redirects y /.htaccess responden 404', async () => {
    const fastify = (await import('fastify')).default;
    const { registerStaticSite } = await import('../staticSite');
    const sitio = fastify({ logger: false });
    registerStaticSite(sitio);
    for (const ruta of ['/_headers', '/_redirects', '/.htaccess', '/.env']) {
      const res = await sitio.inject({ method: 'GET', url: ruta });
      expect(res.statusCode, ruta).toBe(404);
    }
    await sitio.close();
  });

  it('la CSP no autoriza servicios que el sitio no usa', async () => {
    const { buildContentSecurityPolicy } = await import('../security/headers');
    expect(buildContentSecurityPolicy([])).not.toContain('web3forms');
  });
});

describe('P3-03: caché y HEAD', () => {
  async function sitio() {
    const fastify = (await import('fastify')).default;
    const { registerStaticSite } = await import('../staticSite');
    const app = fastify({ logger: false });
    registerStaticSite(app);
    return app;
  }

  it('HEAD da la misma longitud que GET', async () => {
    const app = await sitio();
    const get = await app.inject({ method: 'GET', url: '/robots.txt' });
    const head = await app.inject({ method: 'HEAD', url: '/robots.txt' });
    expect(get.statusCode).toBe(200);
    expect(head.headers['content-length']).toBe(get.headers['content-length']);
    expect(Number(head.headers['content-length'])).toBeGreaterThan(0);
    await app.close();
  });

  it('con el ETag de vuelta responde 304 sin cuerpo', async () => {
    const app = await sitio();
    const primera = await app.inject({ method: 'GET', url: '/' });
    const etag = primera.headers.etag as string;
    expect(etag).toBeTruthy();
    expect(primera.headers['last-modified']).toBeTruthy();
    const segunda = await app.inject({
      method: 'GET',
      url: '/',
      headers: { 'if-none-match': etag },
    });
    expect(segunda.statusCode).toBe(304);
    expect(segunda.body).toBe('');
    await app.close();
  });

  it('solo lo que lleva hash o id en el nombre es inmutable', async () => {
    const app = await sitio();
    const logo = await app.inject({ method: 'GET', url: '/logo.svg' });
    if (logo.statusCode === 200) {
      expect(logo.headers['cache-control']).not.toContain('immutable');
    }
    await app.close();
  });
});
