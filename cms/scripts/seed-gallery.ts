/**
 * Seed gallery categories and items from the 23 curated images.
 * Idempotent: skips if categories already exist.
 */
import { nanoid } from 'nanoid';
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

interface CuratedImage {
  filename: string;
  categorySlug: string;
  alt: string;
}

// ESTRUCT-3 fix: alineado con las categorías que realmente existen hoy en
// producción (src/data/gallery.json), no con el set original de este seed.
// 'otros' nunca tuvo items asignados y había quedado stale frente a
// 'tanques'/'infraestructuras', agregadas más tarde vía el CMS.
const categories = [
  { name: 'Taller e Instalaciones', slug: 'taller', position: 0 },
  { name: 'Montaje en Obra', slug: 'montaje', position: 1 },
  { name: 'Tuberías Forzadas', slug: 'tuberias', position: 2 },
  { name: 'Válvulas y Equipos', slug: 'equipos', position: 3 },
  { name: 'Tanques Especiales', slug: 'tanques', position: 4 },
  { name: 'Infraestructuras', slug: 'infraestructuras', position: 5 },
];

const curatedImages: CuratedImage[] = [
  {
    filename: 'bifurcacion-primer-taller.webp',
    categorySlug: 'taller',
    alt: 'Bifurcación en primer taller',
  },
  { filename: 'bifurcacion-t-taller.webp', categorySlug: 'taller', alt: 'Bifurcación en taller' },
  { filename: 'empresa-oficina.jpg', categorySlug: 'taller', alt: 'Oficinas de la empresa' },
  { filename: 'empresa-taller.webp', categorySlug: 'taller', alt: 'Taller de la empresa' },
  {
    filename: 'fabricacion-tuberias-taller.webp',
    categorySlug: 'taller',
    alt: 'Fabricación de tuberías en taller',
  },
  { filename: 'taller-aereo.webp', categorySlug: 'taller', alt: 'Vista aérea del taller' },
  { filename: 'taller-nave.webp', categorySlug: 'taller', alt: 'Nave del taller' },
  {
    filename: 'montaje-vertical-caverna.webp',
    categorySlug: 'montaje',
    alt: 'Montaje vertical en caverna',
  },
  { filename: 'otros-montajes.jpg', categorySlug: 'montaje', alt: 'Otros montajes' },
  {
    filename: 'proyecto-bifurcacion-obra.jpg',
    categorySlug: 'montaje',
    alt: 'Bifurcación en obra',
  },
  { filename: 'proyecto-montaje-tuberia.jpg', categorySlug: 'montaje', alt: 'Montaje de tubería' },
  { filename: 'proyecto-tuberia-montana.webp', categorySlug: 'montaje', alt: 'Tubería en montaña' },
  { filename: 'proyecto-tuberia-terreno.jpg', categorySlug: 'montaje', alt: 'Tubería en terreno' },
  { filename: 'proyecto-tunel-blindaje.jpg', categorySlug: 'montaje', alt: 'Túnel con blindaje' },
  {
    filename: 'tuberia-forzada-tunel.webp',
    categorySlug: 'tuberias',
    alt: 'Tubería forzada en túnel',
  },
  { filename: 'tuberias-forzadas.jpg', categorySlug: 'tuberias', alt: 'Tuberías forzadas' },
  {
    filename: 'proyecto-bifurcacion-taller.jpg',
    categorySlug: 'tuberias',
    alt: 'Bifurcación de tubería en taller',
  },
  { filename: 'compuertas.jpg', categorySlug: 'equipos', alt: 'Compuertas industriales' },
  { filename: 'limpiarrejas.jpg', categorySlug: 'equipos', alt: 'Limpiarrejas' },
  { filename: 'proyecto-valvula-tunel.jpg', categorySlug: 'equipos', alt: 'Válvula en túnel' },
  { filename: 'turbinas.jpg', categorySlug: 'equipos', alt: 'Turbinas' },
  {
    filename: 'valvula-tuberia-tunel.webp',
    categorySlug: 'equipos',
    alt: 'Válvula y tubería en túnel',
  },
  { filename: 'valvulas.jpg', categorySlug: 'equipos', alt: 'Válvulas industriales' },
];

function titleFromAlt(alt: string): string {
  return alt
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

try {
  migrate();
  const db = getDb();

  // Check if already seeded
  const count = (db.prepare('SELECT COUNT(*) as n FROM gallery_categories').get() as { n: number })
    .n;
  if (count > 0) {
    process.stdout.write(`Gallery already seeded (${count} categories). Skipping.\n`);
    process.exit(0);
  }

  const now = new Date().toISOString();
  const categoryMap = new Map<string, string>(); // slug → id

  // Insert categories
  const insertCategory = db.prepare(
    'INSERT INTO gallery_categories (id, name, slug, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const cat of categories) {
    const id = nanoid();
    insertCategory.run(id, cat.name, cat.slug, cat.position, now, now);
    categoryMap.set(cat.slug, id);
  }

  // Insert items
  const insertItem = db.prepare(
    'INSERT INTO gallery_items (id, media_id, category_id, title, alt, caption, position, featured, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const findMediaByFilename = db.prepare(
    'SELECT id FROM media_assets WHERE name = ? OR path LIKE ? LIMIT 1'
  );

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < curatedImages.length; i++) {
    const img = curatedImages[i];
    const media = findMediaByFilename.get(img.filename, `%${img.filename}`) as
      { id: string } | undefined;
    if (!media) {
      skipped++;
      process.stdout.write(`  ⚠ Media not found: ${img.filename}\n`);
      continue;
    }

    const categoryId = categoryMap.get(img.categorySlug);
    const featured = i < 4 ? 1 : 0; // First 4 are featured

    insertItem.run(
      nanoid(),
      media.id,
      categoryId ?? null,
      titleFromAlt(img.alt),
      img.alt,
      null, // caption
      i, // position
      featured,
      'published',
      now,
      now
    );
    inserted++;
  }

  process.stdout.write(
    `\n✅ Gallery seeded: ${categories.length} categories, ${inserted} items (${skipped} skipped)\n`
  );
} catch (error) {
  captureException(error, { action: 'seedGallery' });
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
