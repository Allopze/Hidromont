/**
 * Recupera los textos alternativos escritos a mano que quedaron atrapados en
 * la entrada `galeria.items`, y los pasa a la biblioteca de medios.
 *
 * `galeria.items` es un resto de cuando la galería vivía en un campo de tipo
 * `list` dentro del contenido, antes de que pasara a sus propias tablas
 * (`gallery_items` y compañía). Nadie la lee: ni un archivo de `src/**` la
 * nombra. Pero sus 99 elementos llevan una descripción en español escrita por
 * una persona —«Montaje vertical de tubería forzada en caverna subterránea»—
 * y las 99 filas de `media_assets` correspondientes tienen como `alt` el
 * nombre del archivo con los guiones cambiados por espacios: «montaje vertical
 * caverna».
 *
 * Eso importa más allá de la biblioteca: al elegir una imagen, el panel
 * rellena el campo de texto alternativo con `media_assets.alt`, así que ese
 * texto es el que acaba en la página salvo que el editor lo reescriba. Hoy
 * propone un identificador; después propone una descripción.
 *
 * Solo sobrescribe cuando el `alt` actual es el derivado del nombre del
 * archivo. Un `alt` escrito a mano nunca se pisa, en ningún sentido: si la
 * fila ya tiene descripción, se deja como está. Y tampoco escribe cuando el
 * valor no cambiaría: 17 de los 99 elementos traen como descripción el propio
 * nombre del archivo, y contarlos como actualizados hacía que la segunda
 * pasada pareciera no converger.
 *
 * Idempotente. Uso: npm run cms:backfill-media-alt [-- --dry]
 */
import path from 'node:path';
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

const DRY = process.argv.includes('--dry');
const ENTRADA = 'galeria.items';
const CAMPO = 'images';
const log = (msg: string) => process.stdout.write(`${msg}\n`);

/** ¿El alt es el nombre del archivo con los guiones cambiados por espacios? */
function esDerivadoDelNombre(alt: string | null, ruta: string): boolean {
  if (!alt || !alt.trim()) return true;
  const base = (ruta.split('/').pop() ?? '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();
  return alt.trim().toLowerCase() === base;
}

function main(): void {
  migrate();
  const db = getDb();

  const fila = db
    .prepare('SELECT value_json FROM content_fields WHERE entry_id = ? AND key = ?')
    .get(ENTRADA, CAMPO) as { value_json: string } | undefined;

  if (!fila) {
    log(`No existe ${ENTRADA}.${CAMPO}: nada que recuperar.`);
    return;
  }

  let items: Array<{ src?: string; alt?: string }>;
  try {
    items = JSON.parse(fila.value_json) as Array<{ src?: string; alt?: string }>;
  } catch {
    log(`${ENTRADA}.${CAMPO} no contiene JSON válido: no se toca nada.`);
    return;
  }

  // La ruta pudo cambiar de extensión (la conversión a WebP) o de directorio
  // (las fotos que solo son candidatas de biblioteca viven en uploads/cms), así
  // que se busca por ruta exacta y, si no, por nombre de archivo sin extensión.
  const porRuta = db.prepare('SELECT id, path, alt FROM media_assets WHERE path = ?');
  const porNombre = db.prepare('SELECT id, path, alt FROM media_assets WHERE path LIKE ?');
  const actualizar = db.prepare('UPDATE media_assets SET alt = ?, updated_at = ? WHERE id = ?');
  const ahora = new Date().toISOString();

  let actualizados = 0;
  let yaEscritos = 0;
  let sinFila = 0;
  // 17 de los 99 elementos traen como descripción el propio nombre del archivo
  // deslugado, así que su valor es idéntico al que ya hay. Contarlos como
  // «actualizados» hacía que la segunda pasada pareciera no converger.
  let sinCambio = 0;
  const muestra: string[] = [];

  const aplicar = db.transaction(() => {
    for (const item of items) {
      if (!item.src || !item.alt?.trim()) continue;

      const base = path.posix.basename(item.src).replace(/\.[a-z0-9]+$/i, '');
      const destino = (porRuta.get(item.src) ?? porNombre.get(`%/${base}.%`)) as
        { id: string; path: string; alt: string | null } | undefined;

      if (!destino) {
        sinFila++;
        continue;
      }
      if (!esDerivadoDelNombre(destino.alt, destino.path)) {
        yaEscritos++;
        continue;
      }
      if (destino.alt === item.alt.trim()) {
        sinCambio++;
        continue;
      }

      if (muestra.length < 5) {
        muestra.push(
          `${destino.path}\n      antes: ${JSON.stringify(destino.alt)}\n      ahora: ${JSON.stringify(item.alt.trim())}`
        );
      }
      if (!DRY) actualizar.run(item.alt.trim(), ahora, destino.id);
      actualizados++;
    }
  });
  aplicar();

  log(`Elementos con descripción en ${ENTRADA}: ${items.filter((i) => i.alt?.trim()).length}`);
  log(`  ${DRY ? 'se actualizarían' : 'actualizados'}: ${actualizados}`);
  log(`  ya tenían descripción escrita (no se tocan): ${yaEscritos}`);
  log(`  su descripción es el propio nombre del archivo (sin cambio): ${sinCambio}`);
  log(`  sin fila en la biblioteca: ${sinFila}`);
  for (const m of muestra) log(`   - ${m}`);
  if (DRY) log('\n(--dry: no se escribió nada)');
  else if (actualizados > 0) log('\nSiguiente paso: npm run cms:export');
}

main();
