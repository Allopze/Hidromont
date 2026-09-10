/**
 * Fusiona las filas de `media_assets` que apuntan al mismo archivo.
 *
 * `media_assets.path` no tenía índice único, así que la misma foto podía
 * registrarse dos veces —y lo estaba: 6 rutas con dos filas cada una, con
 * checksum, tamaño y dimensiones idénticos—. La consecuencia no es cosmética:
 * el backfill de usos casa por ruta, así que un mismo campo se atribuía a
 * varios `media_id` e inflaba el `usageCount` que el panel muestra; y al elegir
 * la foto en la biblioteca, cuál de las dos filas quedaba registrada era azar.
 *
 * Se conserva UNA fila y se repuntan a ella `gallery_items.media_id` y
 * `media_usages.media_id`. La superviviente se elige por el texto alternativo,
 * no por la fecha: si el `alt` de una fila es el nombre del archivo con los
 * guiones cambiados por espacios, es el que generó la importación automática, y
 * la otra tiene el que escribió una persona. Sin ese criterio se perdía la
 * descripción buena, que es justo lo que hace accesible la foto. Cuando ninguna
 * o las dos son automáticas, gana la más reciente.
 *
 * Lo que la superviviente no tenga se copia de la otra: un `alt` vacío o un
 * punto focal por defecto se rellenan antes de borrar.
 *
 * Solo fusiona filas con el MISMO checksum. Dos archivos distintos en la misma
 * ruta son un problema de otra naturaleza y se listan para revisión.
 *
 * Idempotente. Uso: npm run cms:merge-duplicate-media [-- --dry]
 */
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

const DRY = process.argv.includes('--dry');
const log = (msg: string) => process.stdout.write(`${msg}\n`);

interface Fila {
  id: string;
  path: string;
  alt: string | null;
  focal_x: number | null;
  focal_y: number | null;
  checksum: string;
  created_at: string;
}

/** ¿El alt es el nombre del archivo con los guiones cambiados por espacios? */
function altDerivadoDelNombre(fila: Fila): boolean {
  if (!fila.alt) return true;
  const base = (fila.path.split('/').pop() ?? '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
  return fila.alt.trim().toLowerCase() === base;
}

function elegirSuperviviente(filas: Fila[]): Fila {
  const escritos = filas.filter((f) => !altDerivadoDelNombre(f));
  const candidatas = escritos.length === 1 ? escritos : filas;
  return [...candidatas].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

function main(): void {
  migrate();
  const db = getDb();

  const rutas = db
    .prepare('SELECT path FROM media_assets GROUP BY path HAVING COUNT(*) > 1 ORDER BY path')
    .all() as Array<{ path: string }>;

  log(`Rutas registradas más de una vez: ${rutas.length}`);
  if (!rutas.length) {
    log('\nNada que fusionar.');
    return;
  }

  const repuntarGaleria = db.prepare('UPDATE gallery_items SET media_id = ? WHERE media_id = ?');
  // El PK de media_usages es (media_id, entry_id, field_key): si la
  // superviviente ya tiene una fila para ese mismo campo, repuntar chocaría.
  // Se borra la duplicada y se repunta el resto.
  const usosEnConflicto = db.prepare(
    `DELETE FROM media_usages WHERE media_id = ?
       AND EXISTS (SELECT 1 FROM media_usages s
                   WHERE s.media_id = ? AND s.entry_id = media_usages.entry_id
                     AND s.field_key = media_usages.field_key)`
  );
  const repuntarUsos = db.prepare('UPDATE media_usages SET media_id = ? WHERE media_id = ?');
  const completar = db.prepare(
    'UPDATE media_assets SET alt = ?, focal_x = ?, focal_y = ?, updated_at = ? WHERE id = ?'
  );
  const borrar = db.prepare('DELETE FROM media_assets WHERE id = ?');
  const ahora = new Date().toISOString();

  let fusionadas = 0;
  let borradas = 0;
  const revisar: string[] = [];

  const aplicar = db.transaction(() => {
    for (const { path: ruta } of rutas) {
      const filas = db
        .prepare(
          'SELECT id, path, alt, focal_x, focal_y, checksum, created_at FROM media_assets WHERE path = ?'
        )
        .all(ruta) as Fila[];

      const checksums = new Set(filas.map((f) => f.checksum));
      if (checksums.size > 1) {
        revisar.push(`${ruta} — ${checksums.size} contenidos distintos en la misma ruta`);
        continue;
      }

      const superviviente = elegirSuperviviente(filas);
      const sobrantes = filas.filter((f) => f.id !== superviviente.id);

      // Rellenar lo que le falte a la superviviente antes de borrar el resto.
      let alt = superviviente.alt;
      let focalX = superviviente.focal_x;
      let focalY = superviviente.focal_y;
      for (const otra of sobrantes) {
        if (
          (!alt || altDerivadoDelNombre(superviviente)) &&
          otra.alt &&
          !altDerivadoDelNombre(otra)
        )
          alt = otra.alt;
        if ((focalX === null || focalX === 0.5) && otra.focal_x !== null && otra.focal_x !== 0.5)
          focalX = otra.focal_x;
        if ((focalY === null || focalY === 0.5) && otra.focal_y !== null && otra.focal_y !== 0.5)
          focalY = otra.focal_y;
      }

      log(`  ${ruta}`);
      log(`     conserva ${superviviente.id} · alt: ${JSON.stringify(alt)}`);

      if (!DRY) {
        if (
          alt !== superviviente.alt ||
          focalX !== superviviente.focal_x ||
          focalY !== superviviente.focal_y
        ) {
          completar.run(alt, focalX, focalY, ahora, superviviente.id);
        }
        for (const otra of sobrantes) {
          repuntarGaleria.run(superviviente.id, otra.id);
          usosEnConflicto.run(otra.id, superviviente.id);
          repuntarUsos.run(superviviente.id, otra.id);
          borrar.run(otra.id);
        }
      }
      fusionadas++;
      borradas += sobrantes.length;
    }
  });
  aplicar();

  log(
    `\n${DRY ? 'Se fusionarían' : 'Fusionadas'}: ${fusionadas} ruta(s), ${borradas} fila(s) de más eliminada(s).`
  );
  if (revisar.length) {
    log(`\n${revisar.length} ruta(s) requieren revisión manual (no se tocan):`);
    for (const r of revisar) log(`  - ${r}`);
  }
  if (DRY) log('\n(--dry: no se escribió nada)');
  else log('\nReinicie el CMS: la migración creará el índice único sobre media_assets.path.');
}

main();
