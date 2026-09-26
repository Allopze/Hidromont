import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../db/schema';
import { GalleryRepository } from '../repositories/GalleryRepository';
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
    // A-5: el export deriva `updatedAt` del contenido en vez del reloj, para
    // ser idempotente. Fijo aquí para que el JSON del test sea estable.
    maxUpdatedAt: () => '2026-01-01T00:00:00.000Z',
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

function seedGalleryJson(rootDir: string, itemCount: number, prefix = 'existente') {
  const target = path.join(rootDir, 'src', 'data', 'gallery.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      categories: [],
      items: Array.from({ length: itemCount }, (_, i) => ({ id: `${prefix}-${i}` })),
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
      /tiene 168 foto\(s\) que el CMS no conoce/
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
    // Las 23 que ya había son fotos que la base conoce (mismos ids).
    const target = seedGalleryJson(root, 23, 'item');

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

/**
 * P0-01 (auditoría 2026-09): la guarda comparaba solo el número de fotos, así
 * que quitar u ocultar una foto desde el panel bloqueaba TODAS las
 * publicaciones siguientes. Estas pruebas usan la base real (migrate) para que
 * el conjunto de fotos «conocidas» salga de la tabla y de la auditoría.
 */
describe('P0-01: quitar u ocultar una foto desde el CMS no bloquea la publicación', () => {
  function realSetup(total: number) {
    const db = new Database(':memory:');
    migrate(db);
    const now = new Date().toISOString();
    const repo = new GalleryRepository(db);
    for (let i = 0; i < total; i += 1) {
      db.prepare(
        `INSERT INTO media_assets (id, name, path, mime, size, alt, focal_x, focal_y, checksum, created_at, updated_at)
         VALUES (?, ?, ?, 'image/webp', 1, 'x', 0.5, 0.5, 'c', ?, ?)`
      ).run(`m-${i}`, `f-${i}.webp`, `/fotos/f-${i}.webp`, now, now);
      repo.createItem({
        id: `item-${i}`,
        mediaId: `m-${i}`,
        title: `Foto ${i}`,
        alt: `Foto ${i}`,
        position: i,
        featured: false,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      });
    }
    const imageService = {
      generateDerivatives: async (mediaPath: string) => ({
        src: mediaPath,
        width: 10,
        height: 10,
        srcset: `${mediaPath} 10w`,
        lqip: '',
      }),
    };
    const root = makeTempRoot();
    const exportService = new ExportService({} as never, root, repo, imageService as never);
    return { db, repo, exportService, root };
  }

  const itemsOnDisk = (root: string) =>
    JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'gallery.json'), 'utf8')).items;

  it('borrar una foto desde el panel (queda en la auditoría) publica n−1', async () => {
    const { db, repo, exportService, root } = realSetup(5);
    await exportService.exportGallery();
    expect(itemsOnDisk(root)).toHaveLength(5);

    repo.deleteItem('item-2');
    db.prepare(
      `INSERT INTO audit_events (id, action, entity_type, entity_id, created_at)
       VALUES ('a1', 'gallery.item.delete', 'gallery_item', 'item-2', ?)`
    ).run(new Date().toISOString());

    await exportService.exportGallery();
    expect(itemsOnDisk(root).map((i: { id: string }) => i.id)).not.toContain('item-2');
    expect(itemsOnDisk(root)).toHaveLength(4);
    // Y la siguiente publicación también sale.
    await exportService.exportGallery();
    expect(itemsOnDisk(root)).toHaveLength(4);
  });

  it('ocultar una foto (borrador) publica sin ella', async () => {
    const { db, exportService, root } = realSetup(4);
    await exportService.exportGallery();
    db.prepare(`UPDATE gallery_items SET status = 'draft' WHERE id = 'item-0'`).run();

    await exportService.exportGallery();
    expect(itemsOnDisk(root)).toHaveLength(3);
  });

  it('sigue abortando si el JSON tiene fotos que la base nunca tuvo', async () => {
    const { exportService, root } = realSetup(2);
    seedGalleryJson(root, 10);

    await expect(exportService.exportGallery()).rejects.toThrow(/que el CMS no conoce/);
    expect(itemsOnDisk(root)).toHaveLength(10);
  });
});
