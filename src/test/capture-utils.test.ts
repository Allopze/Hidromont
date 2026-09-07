import { describe, expect, it } from 'vitest';
import {
  classifyMedia,
  collectRoutesFromHtmlPaths,
  findPublicCmsMarkers,
  readPngSize,
  resolveCapturePorts,
  validateScreenshotInventory,
} from '../../scripts/capture-utils.mjs';

describe('capture utilities', () => {
  it('collects only Astro page routes and keeps the 404 separate', () => {
    const result = collectRoutesFromHtmlPaths([
      'index.html',
      '404.html',
      'contacto/index.html',
      'proyectos/ch-dorias/index.html',
      'fotos/curacion-preview.html',
      'contacto/index.html',
    ]);

    expect(result).toEqual({
      routes: ['/', '/contacto', '/proyectos/ch-dorias'],
      skipped: ['fotos/curacion-preview.html'],
    });
  });

  it('distinguishes decoded, broken and pending media', () => {
    expect(
      classifyMedia([
        { src: '/ok.webp', complete: true, naturalWidth: 1200 },
        { src: '/broken.webp', complete: true, naturalWidth: 0 },
        { src: '/pending.webp', complete: false, naturalWidth: 0 },
      ])
    ).toEqual({
      loaded: ['/ok.webp'],
      broken: ['/broken.webp'],
      pending: ['/pending.webp'],
    });
  });

  it('reports every CMS marker found in public HTML', () => {
    const html = `
      <main data-cms-entry="home.hero">
        <div class="hm-cms-bar">Agregar imagen</div>
        <script>window.__HIDROMONT_CMS__ = {};</script>
      </main>
    `;

    expect(findPublicCmsMarkers(html)).toEqual([
      'data-cms-entry',
      '__HIDROMONT_CMS__',
      'hm-cms-bar',
      'Agregar imagen',
    ]);
    expect(findPublicCmsMarkers('<main>Sitio público</main>')).toEqual([]);
  });

  it('reads PNG dimensions from the IHDR header and rejects invalid buffers', () => {
    // PNG 1x1 válido: firma de 8 bytes + chunk IHDR con width=1, height=1.
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d494844520000000100000001080600000' + '01f15c489',
      'hex'
    );
    expect(readPngSize(png)).toEqual({ width: 1, height: 1 });

    const wide = Buffer.from(png);
    wide.writeUInt32BE(3840, 16);
    wide.writeUInt32BE(13080, 20);
    expect(readPngSize(wide)).toEqual({ width: 3840, height: 13080 });

    expect(readPngSize(Buffer.alloc(0))).toBeNull();
    expect(readPngSize(Buffer.alloc(24, 0xff))).toBeNull();
    expect(readPngSize('no-buffer')).toBeNull();
  });

  it('requires 24 public pages and four CMS scenes per viewport', () => {
    const files = [
      ...Array.from({ length: 24 }, (_, index) => `desktop/public/page-${index}.png`),
      ...Array.from({ length: 24 }, (_, index) => `mobile/public/page-${index}.png`),
      ...Array.from({ length: 4 }, (_, index) => `desktop/cms/scene-${index}.png`),
      ...Array.from({ length: 4 }, (_, index) => `mobile/cms/scene-${index}.png`),
    ];

    expect(validateScreenshotInventory(files)).toEqual({
      total: 56,
      desktop: 28,
      mobile: 28,
      publicPerViewport: 24,
      cmsPerViewport: 4,
    });
    expect(() => validateScreenshotInventory(files.slice(1))).toThrow(/55 de 56/);
  });

  it('uses capture-only ports and accepts explicit overrides', () => {
    expect(resolveCapturePorts({})).toEqual({ publicPort: 8897, cmsPort: 8898 });
    expect(resolveCapturePorts({ CAPTURE_PUBLIC_PORT: '9001', CAPTURE_CMS_PORT: '9002' })).toEqual({
      publicPort: 9001,
      cmsPort: 9002,
    });
  });
});
