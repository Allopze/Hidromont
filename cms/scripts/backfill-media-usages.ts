/**
 * A-4 — Rellena media_usages con los usos históricos de imágenes.
 *
 * La tabla llevaba vacía desde su creación: la única escritura estaba
 * condicionada a recibir `mediaId`, y el overlay nunca lo enviaba. Resultado:
 * `usageCount` siempre 0 y el CMS incapaz de decir en qué páginas se usa una
 * foto antes de borrarla.
 *
 * Casa cada `content_fields` de tipo `image` con el `media_assets` de esa
 * ruta. Ojo: `media_assets.path` NO es único (hay rutas registradas varias
 * veces), así que se elige un solo asset por ruta —el más antiguo— en vez de
 * hacer un JOIN directo, que produciría varias filas para el mismo campo e
 * inflaría el recuento.
 *
 * Idempotente. Uso: npm run cms:backfill-media-usages [-- --dry]
 */
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

const DRY = process.argv.includes('--dry');
const log = (msg: string) => process.stdout.write(`${msg}\n`);

function main(): void {
  migrate();
  const db = getDb();
  const now = new Date().toISOString();

  // Un id por ruta, el más antiguo, para no duplicar el campo.
  const assetByPath = new Map<string, string>();
  for (const row of db
    .prepare('SELECT id, path FROM media_assets ORDER BY created_at ASC, id ASC')
    .all() as Array<{ id: string; path: string }>) {
    if (!assetByPath.has(row.path)) assetByPath.set(row.path, row.id);
  }

  const fields = db
    .prepare("SELECT entry_id, key, value_json FROM content_fields WHERE type = 'image'")
    .all() as Array<{ entry_id: string; key: string; value_json: string }>;

  const enlazables: Array<{ mediaId: string; entryId: string; key: string }> = [];
  let vacios = 0;
  const sinCorrespondencia: string[] = [];

  for (const field of fields) {
    let value: unknown;
    try {
      value = JSON.parse(field.value_json);
    } catch {
      value = null;
    }
    if (typeof value !== 'string' || value === '') {
      vacios += 1;
      continue;
    }
    const mediaId = assetByPath.get(value);
    if (!mediaId) {
      sinCorrespondencia.push(`${field.entry_id}.${field.key} → ${value}`);
      continue;
    }
    enlazables.push({ mediaId, entryId: field.entry_id, key: field.key });
  }

  if (!DRY) {
    const insert = db.prepare(
      `INSERT INTO media_usages (media_id, entry_id, field_key, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(media_id, entry_id, field_key) DO UPDATE SET updated_at = excluded.updated_at`
    );
    db.transaction(() => {
      for (const u of enlazables) insert.run(u.mediaId, u.entryId, u.key, now);
    })();
  }

  log(
    `Campos de tipo imagen: ${fields.length} · enlazados: ${enlazables.length}` +
      ` · vacíos: ${vacios} · sin correspondencia: ${sinCorrespondencia.length}` +
      (DRY ? '  (--dry: no se escribió nada)' : '')
  );

  if (sinCorrespondencia.length > 0) {
    log('\n⚠ Sin correspondencia en la biblioteca (no se enlazan):');
    sinCorrespondencia.slice(0, 20).forEach((line) => log(`  - ${line}`));
    if (sinCorrespondencia.length > 20) log(`  … y ${sinCorrespondencia.length - 20} más`);
    log('  Suelen ser derivados generados por el build (/gallery/derived/…),');
    log('  que no son entradas del catálogo y no se pueden reelegir desde el CMS.');
  }
}

try {
  main();
} catch (error) {
  captureException(error, { action: 'cmsBackfillMediaUsages' });
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
