import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ExportService } from '../services/exportService';

/**
 * GAL-1 / GAL-6 — Regresiones de la migración de la galería al CMS.
 *
 * Contexto: las 168 fotos del sitio vivían solo en src/data/gallery.json,
 * escritas por un script que no pasaba por SQLite, mientras exportGallery()
 * regeneraba ese archivo completo desde la base (23 fotos). Un clic en
 * "Exportar" habría borrado 145 fotos sin error ni confirmación.
 */

function makeExportService(rootDir: string, publishedItems: number) {
  const galleryRepository = {
    listCategories: () => [],
    listAlbums: () => [
      { slug: 'ch-pangal', name: 'C.H. Pangal', position: 0, itemCount: publishedItems },
    ],
    listItems: () =>
      Array.from({ length: publishedItems }, (_, i) => ({
        id: `item-${i}`,
        // `title` y `caption` siguen en la tabla como columnas legadas; el
        // export debe ignorarlas.
        title: `Título legado ${i}`,
        alt: `Foto ${i}`,
        caption: `Descripción legada ${i}`,
        categorySlug: null,
        categoryName: null,
        projectSlug: null,
        featured: false,
        position: i,
        mediaPath: `/fotos/foto-${i}.webp`,
        mediaFocalX: 0.5,
        mediaFocalY: 0.5,
      })),
  };

  const imageService = {
    generateDerivatives: async (mediaPath: string) => ({
      src: mediaPath,
      width: 1600,
      height: 1200,
      srcset: `${mediaPath} 1600w`,
      lqip: 'data:image/webp;base64,AAAA',
    }),
  };

  return new ExportService({} as never, rootDir, galleryRepository as never, imageService as never);
}

function seedGalleryJson(rootDir: string, itemCount: number) {
  const target = path.join(rootDir, 'src', 'data', 'gallery.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      categories: [],
      items: Array.from({ length: itemCount }, (_, i) => ({ id: `existente-${i}` })),
    })
  );
  return target;
}

const tempDirs: string[] = [];
function makeTempRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-gallery-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  delete process.env.CMS_ALLOW_GALLERY_SHRINK;
  while (tempDirs.length) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe('GAL-1: guarda contra el borrado silencioso de la galería', () => {
  it('aborta si la base tiene menos fotos que el gallery.json en disco', async () => {
    const root = makeTempRoot();
    const target = seedGalleryJson(root, 168);

    await expect(makeExportService(root, 23).exportGallery()).rejects.toThrow(
      /Exportar borraría 145 foto/
    );

    // El archivo debe quedar intacto, no a medio escribir.
    const onDisk = JSON.parse(fs.readFileSync(target, 'utf8'));
    expect(onDisk.items).toHaveLength(168);
  });

  it('permite la reducción cuando es intencional y explícita', async () => {
    const root = makeTempRoot();
    const target = seedGalleryJson(root, 168);
    process.env.CMS_ALLOW_GALLERY_SHRINK = '1';

    await makeExportService(root, 23).exportGallery();

    expect(JSON.parse(fs.readFileSync(target, 'utf8')).items).toHaveLength(23);
  });

  it('no estorba cuando la galería crece o se mantiene', async () => {
    const root = makeTempRoot();
    const target = seedGalleryJson(root, 23);

    await makeExportService(root, 168).exportGallery();

    expect(JSON.parse(fs.readFileSync(target, 'utf8')).items).toHaveLength(168);
  });

  it('no bloquea la primera exportación (sin archivo previo)', async () => {
    const root = makeTempRoot();

    const result = await makeExportService(root, 5).exportGallery();

    expect(result.count).toBe(5);
  });
});

describe('GAL-19: los nombres de los álbumes salen de la base, no de código', () => {
  it('exporta los álbumes a gallery.json', async () => {
    const root = makeTempRoot();

    await makeExportService(root, 3).exportGallery();

    const onDisk = JSON.parse(
      fs.readFileSync(path.join(root, 'src', 'data', 'gallery.json'), 'utf8')
    );
    expect(onDisk.albums).toEqual([{ slug: 'ch-pangal', name: 'C.H. Pangal', position: 0 }]);
  });
});

describe('La galería exporta fotos y álbumes, sin título ni descripción', () => {
  it('no escribe title ni caption en gallery.json', async () => {
    const root = makeTempRoot();

    await makeExportService(root, 3).exportGallery();

    const onDisk = JSON.parse(
      fs.readFileSync(path.join(root, 'src', 'data', 'gallery.json'), 'utf8')
    );
    for (const item of onDisk.items) {
      expect(item).not.toHaveProperty('title');
      expect(item).not.toHaveProperty('caption');
      // El alt sobrevive: es lo que anuncian los lectores de pantalla.
      expect(item.alt).toBeTruthy();
    }
  });
});

describe('GAL-6: src/data/gallery.json solo lo escribe el export del CMS', () => {
  it('ningún script bajo scripts/ escribe gallery.json', () => {
    const scriptsDir = path.join(process.cwd(), 'scripts');
    const offenders: string[] = [];

    for (const entry of fs.readdirSync(scriptsDir)) {
      if (!/\.(mjs|js|ts)$/.test(entry)) continue;
      const source = fs.readFileSync(path.join(scriptsDir, entry), 'utf8');
      // Busca escrituras reales, no menciones en comentarios.
      const writesGalleryJson =
        /writeFileSync\s*\(\s*GALLERY_JSON/.test(source) ||
        /writeFileSync\s*\([^)]*gallery\.json/.test(source);
      if (writesGalleryJson) offenders.push(entry);
    }

    expect(offenders).toEqual([]);
  });
});
