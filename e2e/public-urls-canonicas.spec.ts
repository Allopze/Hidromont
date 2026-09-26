/**
 * P2-27 (auditoría 2026-09): cada página respondía 200 en varias direcciones
 * y el enlazado interno iba a la forma sin barra. Se prueba contra el
 * servidor que sirve el sitio compilado (el del CMS), no contra `astro dev`.
 */
import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const CMS_URL = process.env.CMS_URL ?? 'http://localhost:8787';

test.skip(!fs.existsSync('dist/index.html'), 'hace falta un build en dist/');

for (const [desde, hacia] of [
  ['/servicios/compuertas', '/servicios/compuertas/'],
  ['/servicios/compuertas/index.html', '/servicios/compuertas/'],
  ['/index.html', '/'],
  ['//xyz-no-existe', '/xyz-no-existe'],
  ['/empresa?utm=1', '/empresa/?utm=1'],
  ['/proyectos/ch-dorias', '/proyectos/ch-doiras/'],
]) {
  test(`${desde} redirige a ${hacia}`, async ({ request }) => {
    const res = await request.get(`${CMS_URL}${desde}`, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toBe(hacia);
  });
}

test('la forma canónica responde 200 y la página de error, 404', async ({ request }) => {
  expect(
    (await request.get(`${CMS_URL}/servicios/compuertas/`, { maxRedirects: 0 })).status()
  ).toBe(200);
  expect((await request.get(`${CMS_URL}/404.html`, { maxRedirects: 0 })).status()).toBe(404);
});

test('los enlaces internos del HTML compilado van con barra', () => {
  const html = fs.readFileSync('dist/index.html', 'utf8');
  const sinBarra = [...html.matchAll(/href="(\/(?!\/)[^"?#]*)"/g)]
    .map((m) => m[1])
    .filter((ruta) => ruta !== '/' && !ruta.endsWith('/') && !/\.[a-z0-9]+$/i.test(ruta))
    .filter((ruta) => fs.existsSync(`dist${decodeURIComponent(ruta)}/index.html`));
  expect(sinBarra).toEqual([]);
});
