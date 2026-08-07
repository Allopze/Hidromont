/**
 * GAL-11 / GAL-22 — Normaliza la portada de cada álbum.
 *
 * GAL-22: `featured` no era exclusivo. 11 álbumes tenían 2 fotos marcadas y 5
 * ninguna; la portada la resolvía `items.find(featured) || items[0]`, así que
 * marcar una foto como destacada muchas veces no cambiaba nada visible y el
 * editor perdía la confianza en el control. Tras este script hay exactamente
 * una por álbum, y el CMS la mantiene así (galleryService).
 *
 * GAL-11: entre las candidatas se prefiere una con resolución suficiente para
 * el tamaño al que se dibuja la tarjeta (475 px CSS → 950 px en pantallas 2x).
 * Una portada de 225 px estirada a 475 se ve borrosa y es lo primero que un
 * visitante juzga de la galería.
 *
 * Idempotente. Uso: npx tsx cms/scripts/fix-album-covers.ts [--dry]
 */
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';

const DRY = process.argv.includes('--dry');
/** Ancho renderizado de la tarjeta en desktop (475 px CSS) por densidad 2x. */
const MIN_COVER_WIDTH = 950;

interface Row {
  id: string;
  project_slug: string | null;
  position: number;
  featured: number;
  width: number | null;
}

function main() {
  migrate();
  const db = getDb();
  const now = new Date().toISOString();

  const rows = db
    .prepare(
      `SELECT i.id, i.project_slug, i.position, i.featured, m.width
         FROM gallery_items i
         LEFT JOIN media_assets m ON m.id = i.media_id
        WHERE i.status = 'published'
        ORDER BY i.project_slug, i.position`
    )
    .all() as Row[];

  const byAlbum = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.project_slug ?? 'general';
    if (!byAlbum.has(key)) byAlbum.set(key, []);
    byAlbum.get(key)!.push(row);
  }

  const setFeatured = db.prepare(
    'UPDATE gallery_items SET featured = ?, updated_at = ? WHERE id = ?'
  );
  let changed = 0;
  const stillSmall: string[] = [];

  const apply = db.transaction(() => {
    for (const [album, items] of byAlbum) {
      // Preferencia: destacada actual con resolución suficiente → cualquier
      // foto con resolución suficiente (la de menor posición) → la más grande
      // que haya. Así se respeta la elección del editor cuando es viable.
      const bigEnough = items.filter((i) => (i.width ?? 0) >= MIN_COVER_WIDTH);
      const cover =
        bigEnough.find((i) => i.featured === 1) ??
        bigEnough[0] ??
        items.reduce((a, b) => ((b.width ?? 0) > (a.width ?? 0) ? b : a));

      if ((cover.width ?? 0) < MIN_COVER_WIDTH) {
        stillSmall.push(`${album}: mejor disponible ${cover.width}px (${items.length} foto/s)`);
      }

      for (const item of items) {
        const shouldBeFeatured = item.id === cover.id ? 1 : 0;
        if (item.featured === shouldBeFeatured) continue;
        if (!DRY) setFeatured.run(shouldBeFeatured, now, item.id);
        changed += 1;
      }
    }
  });

  apply();

  process.stdout.write(`Álbumes: ${byAlbum.size}. Marcas de portada ajustadas: ${changed}.\n`);
  if (stillSmall.length) {
    process.stdout.write(
      `\n⚠ ${stillSmall.length} álbum(es) sin ninguna foto de ${MIN_COVER_WIDTH}px o más:\n`
    );
    stillSmall.forEach((s) => process.stdout.write(`   ${s}\n`));
    process.stdout.write(
      '   Requiere subir una foto mejor (o resolver la decisión #3 del plan).\n'
    );
  }
  if (!DRY) process.stdout.write('\nSiguiente paso: npm run cms:export\n');
}

main();
