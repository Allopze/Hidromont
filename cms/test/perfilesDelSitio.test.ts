/**
 * P2-01 (auditoría 2026-09): el sitio público y el editor salen de builds
 * distintos (`dist` y `dist-editor`) y el servidor elige por dominio.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fastify from 'fastify';
import { afterAll, describe, expect, it } from 'vitest';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-perfiles-'));
const dist = path.join(dir, 'dist');
for (const [carpeta, texto] of [
  [dist, 'publico'],
  [`${dist}-editor`, 'editor'],
]) {
  fs.mkdirSync(carpeta, { recursive: true });
  fs.writeFileSync(path.join(carpeta, 'index.html'), `<p>${texto}</p>`);
}
process.env.CMS_STATIC_DIR = dist;

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('dos perfiles del sitio', () => {
  it('cada dominio recibe su build y la API solo responde en editor.* y en local', async () => {
    const { apiFueraDeEsteHost, distParaHost, registerStaticSite } = await import('../staticSite');
    expect(distParaHost('hidromontchile.cl')).toBe(dist);
    expect(distParaHost('editor.hidromontchile.cl')).toBe(`${dist}-editor`);
    expect(apiFueraDeEsteHost('hidromontchile.cl')).toBe(true);
    expect(apiFueraDeEsteHost('www.hidromontchile.cl')).toBe(true);
    expect(apiFueraDeEsteHost('editor.hidromontchile.cl')).toBe(false);
    expect(apiFueraDeEsteHost('127.0.0.1')).toBe(false);
    expect(apiFueraDeEsteHost('localhost')).toBe(false);

    const app = fastify({ logger: false });
    registerStaticSite(app);
    const pedir = (host: string) => app.inject({ method: 'GET', url: '/', headers: { host } });
    expect((await pedir('hidromontchile.cl')).body).toContain('publico');
    expect((await pedir('editor.hidromontchile.cl')).body).toContain('editor');
    await app.close();
  });

  it('sin dist-editor todos los dominios ven dist, y la API no se cierra', async () => {
    fs.rmSync(`${dist}-editor`, { recursive: true, force: true });
    const { apiFueraDeEsteHost, distParaHost } = await import('../staticSite');
    expect(distParaHost('editor.hidromontchile.cl')).toBe(dist);
    expect(apiFueraDeEsteHost('hidromontchile.cl')).toBe(false);
  });
});
