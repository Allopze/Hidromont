/**
 * Videos y SVG en la biblioteca (sep-2026).
 *
 * - Un video se acepta por su firma (MP4 `ftyp`, WebM EBML) y con su propio
 *   tope de tamaño, más alto que el de las fotos: no se recomprime.
 * - Un SVG se revisa y se guarda convertido a PNG: servido como SVG desde el
 *   mismo dominio, un script dentro sería un XSS almacenado.
 * - El servidor del sitio contesta a las peticiones parciales: Safari no
 *   reproduce un video sin 206.
 */
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esVideoReal, problemaDeSvg } from '../services/mediaService';
import { rangoPedido } from '../staticSite';
import { config, resolvePublicAssetPath } from '../config/unifiedConfig';
import { createTestApp, type TestApp } from './setup';

const mp4 = (bytes = 64) => {
  const b = Buffer.alloc(bytes);
  b.writeUInt32BE(24, 0);
  b.write('ftypisom', 4, 'latin1');
  return b;
};
const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(60)]);
const SVG_LIMPIO =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g"/></defs><path fill="url(#g)" d="M2 2h20v20H2z"/></svg>';

describe('esVideoReal', () => {
  it('reconoce MP4 y WebM por su firma', () => {
    expect(esVideoReal(mp4(), 'video/mp4')).toBe(true);
    expect(esVideoReal(webm(), 'video/webm')).toBe(true);
  });

  it('rechaza un archivo renombrado o con el tipo cruzado', () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    expect(esVideoReal(png, 'video/mp4')).toBe(false);
    expect(esVideoReal(webm(), 'video/mp4')).toBe(false);
    expect(esVideoReal(Buffer.from('ftyp'), 'video/mp4')).toBe(false);
  });
});

describe('problemaDeSvg', () => {
  it('acepta un dibujo con referencias internas', () => {
    expect(problemaDeSvg(SVG_LIMPIO)).toBeNull();
  });

  it.each([
    ['<svg><script>alert(1)</script></svg>', /scripts/],
    ['<svg onload="alert(1)"></svg>', /código/],
    ['<svg><foreignObject><div/></foreignObject></svg>', /HTML/],
    ['<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>', /entidades/],
    ['<svg><image href="file:///etc/passwd"/></svg>', /externos/],
    ['<svg><use xlink:href="https://evil.test/a.svg#x"/></svg>', /externos/],
    ['<svg><rect style="fill:url(https://evil.test/p)"/></svg>', /externos/],
    ['<html>no es un svg</html>', /no es un SVG/],
  ])('rechaza %s', (texto, motivo) => {
    expect(problemaDeSvg(texto)).toMatch(motivo);
  });
});

describe('rangoPedido', () => {
  it('interpreta los rangos que piden los navegadores', () => {
    expect(rangoPedido(undefined, 1000)).toBeNull();
    expect(rangoPedido('bytes=0-', 1000)).toEqual({ inicio: 0, fin: 999 });
    expect(rangoPedido('bytes=0-1', 1000)).toEqual({ inicio: 0, fin: 1 });
    expect(rangoPedido('bytes=500-2000', 1000)).toEqual({ inicio: 500, fin: 999 });
    expect(rangoPedido('bytes=-100', 1000)).toEqual({ inicio: 900, fin: 999 });
  });

  it('distingue un rango imposible de uno que no se entiende', () => {
    expect(rangoPedido('bytes=1000-', 1000)).toBe('fuera');
    expect(rangoPedido('bytes=5-2', 1000)).toBe('fuera');
    expect(rangoPedido('items=0-1', 1000)).toBeNull();
    expect(rangoPedido('bytes=0-1,5-9', 1000)).toBeNull();
  });
});

describe('Subida de videos y SVG', () => {
  let ctx: TestApp;
  const creados: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    for (const ruta of creados) fs.rmSync(resolvePublicAssetPath(ruta), { force: true });
    await ctx.app.close();
  });

  it('un SVG limpio se guarda como PNG', async () => {
    const asset = await ctx.mediaService.createMedia({
      filename: 'icono-valvula.svg',
      mime: 'image/svg+xml',
      buffer: Buffer.from(SVG_LIMPIO),
    });
    creados.push(asset.path);
    expect(asset.mime).toBe('image/png');
    expect(asset.path).toMatch(/\.png$/);
    const bytes = fs.readFileSync(resolvePublicAssetPath(asset.path));
    expect(bytes.subarray(0, 4).toString('hex')).toBe('89504e47');
  });

  it('un video más grande que el tope de fotos entra, y sin recomprimir', async () => {
    const grande = mp4(config.cms.uploadMaxBytes + 1024);
    const asset = await ctx.mediaService.createMedia({
      filename: 'cabecera.mp4',
      mime: 'video/mp4',
      buffer: grande,
    });
    creados.push(asset.path);
    expect(asset.mime).toBe('video/mp4');
    expect(fs.statSync(resolvePublicAssetPath(asset.path)).size).toBe(grande.byteLength);
  });

  it('una foto más grande que su tope no entra', async () => {
    await expect(
      ctx.mediaService.createMedia({
        filename: 'enorme.png',
        mime: 'image/png',
        buffer: Buffer.alloc(config.cms.uploadMaxBytes + 1),
      })
    ).rejects.toThrow(/demasiado grande/);
  });

  it('un archivo que no es video no entra aunque se llame .mp4', async () => {
    await expect(
      ctx.mediaService.createMedia({
        filename: 'falso.mp4',
        mime: 'video/mp4',
        buffer: Buffer.from('no soy un video, solo texto con extensión .mp4'),
      })
    ).rejects.toThrow(/no es un video/);
  });

  it('la biblioteca filtra por tipo', () => {
    const videos = ctx.mediaService.listMedia(100, 0, undefined, 'video').items;
    expect(videos.length).toBeGreaterThan(0);
    expect(videos.every((m) => m.mime.startsWith('video/'))).toBe(true);
    const imagenes = ctx.mediaService.listMedia(100, 0, undefined, 'imagen').items;
    expect(imagenes.every((m) => m.mime.startsWith('image/'))).toBe(true);
  });
});
