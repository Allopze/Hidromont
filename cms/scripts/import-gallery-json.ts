/**
 * GAL-3 / GAL-4 / GAL-5 — Importa src/data/gallery.json a SQLite.
 *
 * Contexto: las 168 fotos que el sitio muestra hoy se escribieron directamente
 * en gallery.json por scripts/process-top-photos.mjs, sin pasar por el CMS. La
 * base solo conocía 23. Como exportGallery() regenera el JSON completo desde la
 * base, publicar desde el CMS habría borrado 145 fotos.
 *
 * Este script invierte la dirección una única vez: toma el JSON como fuente de
 * verdad, lo vuelca a la base, y a partir de ahí la base manda.
 *
 * Resolución del media de cada foto:
 *   - src bajo /fotos/…            → el archivo ES la fuente; se busca su
 *                                    media_asset por path (creado por GAL-2).
 *   - src bajo /gallery/derived/…  → es un derivado, no un original:
 *       a) si el item ya existe en la base, se reusa su media_id;
 *       b) si no, se promueve la mayor variante disponible a fuente: se copia
 *          a public/fotos/galeria/ y se registra como media_asset.
 *     (b) pierde resolución respecto al original, pero esos originales no son
 *     recuperables: los hashes de process-top-photos.mjs son md5 de la *ruta*
 *     y los de ImageService md5 de los *bytes*, así que no hay mapeo posible,
 *     y un barrido por public/fotos, public/uploads y assets/originales/top/
 *     (5.802 archivos) no
 *     encontró ninguno. Si aparecen, basta reasignar el media en el CMS.
 *
 * Idempotente: correrlo dos veces deja la base igual.
 *
 * Uso: npm run cms:import-gallery [-- --dry]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { config } from '../config/unifiedConfig';
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { MediaRepository } from '../repositories/MediaRepository';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

const DRY = process.argv.includes('--dry');
const ROOT = config.rootDir;
const GALLERY_JSON = path.join(ROOT, 'src', 'data', 'gallery.json');
const PROMOTED_DIR = path.join(ROOT, 'public', 'fotos', 'galeria');

/**
 * Nombres de álbum. Se siembran una vez en gallery_albums y a partir de ahí son
 * editables desde el CMS (GAL-19); esta copia solo existe para el arranque, no
 * se vuelve a leer.
 */
const ALBUM_SEED: Record<string, string> = {
  'tanques-glp-coyhaique': 'Tanques Especiales GLP Coyhaique',
  'tanques-glp-puerto-williams': 'Tanques Especiales GLP Puerto Williams',
  'ruta-nahuelbuta-pasarelas': 'Pasarelas Peatonales Ruta Nahuelbuta',
  'servicio-compuertas': 'Compuertas',
  'servicio-limpiarrejas': 'Limpiarrejas',
  'servicio-otros-montajes': 'Montajes y Fabricaciones Especiales',
  'servicio-tuberias-forzadas': 'Tuberías Forzadas y Blindajes',
  'servicio-turbinas': 'Turbinas Hidráulicas',
  'servicio-valvulas': 'Válvulas Hidráulicas',
  'ch-pangal': 'C.H. Pangal',
  'ch-chacayes': 'C.H. Canal Chacayes',
  'ch-queltehues': 'C.H. Queltehues',
  'ch-los-condores': 'C.H. Los Cóndores',
  'ch-ralco': 'C.H. Ralco',
  'ch-los-hierros': 'C.H. Los Hierros',
  'ch-peuchen': 'C.H. Peuchén y Mampil',
  'ch-san-pedro': 'C.H. San Pedro / Colbún',
  'sifones-biobio': 'Sifones BioBío Sur',
  'ch-alto-renaico': 'C.H. Alto Renaico e Itata',
  'taller-hidromont': 'Taller Hidromont',
  'ch-lican': 'C.H. Lican',
  'ch-trueno': 'C.H. Trueno',
  'obras-generales': 'Obras Generales',
};

interface JsonItem {
  id: string;
  // Las fotos no llevan título ni descripción: el alt es lo único que las
  // describe, y la columna legada `title` se rellena con él.
  alt: string;
  categorySlug: string | null;
  categoryName: string | null;
  projectSlug?: string | null;
  featured: boolean;
  position: number;
  src: string;
  focalX?: number;
  focalY?: number;
}

interface JsonCategory {
  id: string;
  name: string;
  slug: string;
  position: number;
}

const log = (msg: string) => process.stdout.write(`${msg}\n`);

async function main() {
  migrate();
  const db = getDb();
  const mediaRepo = new MediaRepository(db);
  const now = new Date().toISOString();

  const data = JSON.parse(fs.readFileSync(GALLERY_JSON, 'utf8')) as {
    categories: JsonCategory[];
    items: JsonItem[];
  };

  log(`Origen: ${data.items.length} foto(s), ${data.categories.length} categoría(s).`);

  // ── 1. Categorías ────────────────────────────────────────────────────────
  const categoryIdBySlug = new Map<string, string>();
  const takenCategoryIds = new Set<string>();
  for (const row of db.prepare('SELECT id, slug FROM gallery_categories').all() as Array<{
    id: string;
    slug: string;
  }>) {
    categoryIdBySlug.set(row.slug, row.id);
    takenCategoryIds.add(row.id);
  }

  const insertCategory = db.prepare(
    'INSERT INTO gallery_categories (id, name, slug, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const updateCategory = db.prepare(
    'UPDATE gallery_categories SET name = ?, position = ?, updated_at = ? WHERE slug = ?'
  );

  let categoriesCreated = 0;
  for (const cat of data.categories) {
    const existingId = categoryIdBySlug.get(cat.slug);
    if (existingId) {
      if (!DRY) updateCategory.run(cat.name, cat.position, now, cat.slug);
    } else {
      // El id del JSON viene de un export anterior y puede estar ocupado por
      // una categoría con otro slug (la base traía 5 categorías de un
      // vocabulario viejo). En ese caso se acuña uno nuevo: el slug es la
      // identidad estable, el id es interno.
      const id = cat.id && !takenCategoryIds.has(cat.id) ? cat.id : nanoid();
      if (!DRY) insertCategory.run(id, cat.name, cat.slug, cat.position, now, now);
      categoryIdBySlug.set(cat.slug, id);
      takenCategoryIds.add(id);
      categoriesCreated += 1;
    }
  }
  log(
    `Categorías: ${categoriesCreated} creada(s), ${data.categories.length - categoriesCreated} actualizada(s).`
  );

  // ── 2. Álbumes ───────────────────────────────────────────────────────────
  const albumSlugs = [...new Set(data.items.map((i) => i.projectSlug).filter(Boolean))] as string[];
  const insertAlbum = db.prepare(
    'INSERT OR IGNORE INTO gallery_albums (slug, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  );
  if (!DRY) {
    albumSlugs.forEach((slug, index) => {
      insertAlbum.run(slug, ALBUM_SEED[slug] ?? slug, index, now, now);
    });
  }
  log(`Álbumes: ${albumSlugs.length} sembrado(s).`);

  // ── 3. Media de cada foto ────────────────────────────────────────────────
  const existingItems = new Map<string, { media_id: string | null }>();
  for (const row of db.prepare('SELECT id, media_id FROM gallery_items').all() as Array<{
    id: string;
    media_id: string | null;
  }>) {
    existingItems.set(row.id, { media_id: row.media_id });
  }

  const mediaIdByItem = new Map<string, string>();
  let promoted = 0;
  const unresolved: string[] = [];

  for (const item of data.items) {
    const src = decodeURIComponent(item.src);

    // (a) La foto ya apunta a un archivo fuente real.
    if (!src.startsWith('/gallery/derived/')) {
      const asset = mediaRepo.findByPath(src);
      if (asset) {
        mediaIdByItem.set(item.id, asset.id);
      } else {
        unresolved.push(`${item.alt} → ${src} (sin media_asset)`);
      }
      continue;
    }

    // (b) Es un derivado y el item ya existe en la base con su media original.
    const known = existingItems.get(item.id);
    if (known?.media_id) {
      mediaIdByItem.set(item.id, known.media_id);
      continue;
    }

    // (c) Derivado huérfano: promover la mayor variante disponible a fuente.
    const hash = src.match(/derived\/([0-9a-f]+)-/)?.[1];
    if (!hash) {
      unresolved.push(`${item.alt} → ${src} (src derivado no reconocible)`);
      continue;
    }

    const variant = [1600, 1024, 640]
      .map((w) => path.join(ROOT, 'public', 'gallery', 'derived', `${hash}-${w}.webp`))
      .find((candidate) => fs.existsSync(candidate));

    if (!variant) {
      unresolved.push(`${item.alt} → ${src} (sin variante en disco)`);
      continue;
    }

    const promotedPath = `/fotos/galeria/${hash}.webp`;
    const existingAsset = mediaRepo.findByPath(promotedPath);
    if (existingAsset) {
      mediaIdByItem.set(item.id, existingAsset.id);
      continue;
    }

    if (!DRY) {
      fs.mkdirSync(PROMOTED_DIR, { recursive: true });
      fs.copyFileSync(variant, path.join(PROMOTED_DIR, `${hash}.webp`));
    }

    const buffer = fs.readFileSync(variant);
    const meta = await sharp(buffer).metadata();
    const assetId = nanoid();
    if (!DRY) {
      mediaRepo.upsertByPath({
        id: assetId,
        name: `${hash}.webp`,
        path: promotedPath,
        mime: 'image/webp',
        width: meta.width,
        height: meta.height,
        size: buffer.byteLength,
        alt: item.alt,
        focalX: item.focalX ?? 0.5,
        focalY: item.focalY ?? 0.5,
        checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
        createdAt: now,
        updatedAt: now,
      });
    }
    mediaIdByItem.set(item.id, assetId);
    promoted += 1;
  }

  log(`Media: ${mediaIdByItem.size} resuelto(s), ${promoted} derivado(s) promovido(s) a fuente.`);
  if (unresolved.length > 0) {
    log(`\n⚠ ${unresolved.length} foto(s) sin media resoluble — NO se importarán:`);
    unresolved.forEach((u) => log(`   ${u}`));
  }

  // ── 4. Items ─────────────────────────────────────────────────────────────
  const upsertItem = db.prepare(`
    INSERT INTO gallery_items
      (id, media_id, category_id, project_slug, title, alt, caption, position, featured, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      media_id = excluded.media_id,
      category_id = excluded.category_id,
      project_slug = excluded.project_slug,
      title = excluded.title,
      alt = excluded.alt,
      caption = excluded.caption,
      position = excluded.position,
      featured = excluded.featured,
      status = 'published',
      updated_at = excluded.updated_at
  `);

  const importedIds = new Set<string>();
  const apply = db.transaction(() => {
    for (const item of data.items) {
      const mediaId = mediaIdByItem.get(item.id);
      if (!mediaId) continue;
      const categoryId = item.categorySlug
        ? (categoryIdBySlug.get(item.categorySlug) ?? null)
        : null;
      upsertItem.run(
        item.id,
        mediaId,
        categoryId,
        item.projectSlug ?? null,
        item.alt,
        item.alt,
        null,
        item.position,
        item.featured ? 1 : 0,
        now,
        now
      );
      importedIds.add(item.id);
    }

    // Lo que la base tenía y el JSON no trae es contenido viejo previo a la
    // migración. No se borra —podría ser recuperable— pero sale de publicado
    // para que el export no lo reintroduzca en el sitio.
    const stale = [...existingItems.keys()].filter((id) => !importedIds.has(id));
    const draft = db.prepare(
      "UPDATE gallery_items SET status = 'draft', updated_at = ? WHERE id = ?"
    );
    for (const id of stale) draft.run(now, id);
    if (stale.length > 0) log(`${stale.length} item(s) preexistente(s) pasado(s) a borrador.`);
  });

  if (DRY) {
    log('\n(--dry: no se escribió nada)');
    return;
  }

  apply();

  const total = db
    .prepare("SELECT COUNT(*) c FROM gallery_items WHERE status = 'published'")
    .get() as { c: number };
  log(`\nListo: ${importedIds.size} foto(s) importada(s); ${total.c} publicada(s) en la base.`);
  log('Siguiente paso: npm run cms:export');
}

main().catch((error) => {
  captureException(error, { action: 'cmsImportGallery' });
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
