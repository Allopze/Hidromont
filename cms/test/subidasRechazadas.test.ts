/**
 * M-01 (auditoría 2026-09-28): un archivo rechazado por ser inseguro o estar
 * dañado respondía 500 «Inténtalo de nuevo». Es un problema del archivo, no
 * del servidor: debe ser un 400 que diga qué pasa.
 */
import fs from 'node:fs';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolvePublicAssetPath } from '../config/unifiedConfig';
import { createTestApp, type TestApp } from './setup';

function multipart(nombre: string, tipo: string, contenido: Buffer) {
  const limite = '----hm-prueba';
  const cuerpo = Buffer.concat([
    Buffer.from(
      `--${limite}\r\nContent-Disposition: form-data; name="file"; filename="${nombre}"\r\nContent-Type: ${tipo}\r\n\r\n`
    ),
    contenido,
    Buffer.from(`\r\n--${limite}--\r\n`),
  ]);
  return { cuerpo, tipo: `multipart/form-data; boundary=${limite}` };
}

describe('M-01: subidas rechazadas', () => {
  let ctx: TestApp;
  let sesion: { csrfToken: string; cookieHeader: string };
  const creados: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    sesion = await ctx.login();
  });

  afterAll(async () => {
    for (const ruta of creados) fs.rmSync(resolvePublicAssetPath(ruta), { force: true });
    await ctx.app.close();
    ctx.cleanup();
  });

  async function subir(nombre: string, tipo: string, contenido: Buffer) {
    const { cuerpo, tipo: contentType } = multipart(nombre, tipo, contenido);
    return ctx.app.inject({
      method: 'POST',
      url: '/api/cms/media',
      headers: {
        cookie: sesion.cookieHeader,
        'x-csrf-token': sesion.csrfToken,
        'content-type': contentType,
      },
      body: cuerpo,
    });
  }

  it.each([
    [
      'un SVG con script',
      'icono.svg',
      'image/svg+xml',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      /scripts/,
    ],
    [
      'un SVG que enlaza fuera',
      'logo.svg',
      'image/svg+xml',
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://x.test/a.png"/></svg>'
      ),
      /externos/,
    ],
    ['un .mp4 que no es video', 'cabecera.mp4', 'video/mp4', Buffer.from('solo texto'), /video/],
  ])('%s → 400 con el motivo', async (_caso, nombre, tipo, contenido, motivo) => {
    const res = await subir(nombre, tipo, contenido);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(motivo);
    expect(res.json().error).not.toMatch(/Inténtalo de nuevo/);
  });

  it('un JPEG cortado a medias → 400 «dañada o incompleta»', async () => {
    const jpeg = await sharp({
      create: { width: 800, height: 600, channels: 3, background: '#3366aa' },
    })
      .jpeg()
      .toBuffer();
    const res = await subir(
      'foto.jpg',
      'image/jpeg',
      jpeg.subarray(0, Math.floor(jpeg.length / 3))
    );
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/dañada o incompleta/);
  });

  it('una foto válida sigue entrando (201)', async () => {
    const jpeg = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#aa6633' },
    })
      .jpeg()
      .toBuffer();
    const res = await subir('buena.jpg', 'image/jpeg', jpeg);
    expect(res.statusCode).toBe(201);
    creados.push(res.json().path);
  });
});
