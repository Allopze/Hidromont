/**
 * C-2 — Elimina los media_assets cuyo archivo ya no existe en disco, y fusiona
 * las rutas duplicadas del catálogo.
 *
 * Contexto: el `.env` del proyecto apuntaba CMS_UPLOAD_DIR a
 * `./public/uploads/cms`, un directorio inexistente, mientras los 2,2 GB de
 * originales vivían en `uploads/cms`. El resultado eran 1.721 de 2.140 assets
 * sirviendo 404 sin un solo error visible. Corregida la configuración quedan
 * 16 huérfanos reales (archivos borrados a mano fuera del CMS) más 7 rutas
 * registradas por duplicado, que inflan `usageCount` al casar por ruta.
 *
 * Solo borra un asset si se cumplen las TRES condiciones: el archivo no existe,
 * ningún gallery_item lo referencia y ningún media_usages lo referencia. Todo
 * lo demás se lista como «requiere revisión» y no se toca.
 *
 * Guard de escala: si los faltantes superan el 10 % del catálogo, aborta. Casi
 * siempre eso significa que CMS_UPLOAD_DIR apunta al sitio equivocado, y este
 * script sería el arma que dispara el bug que viene a limpiar. Saltable con
 * CMS_ALLOW_MEDIA_PURGE=1.
 *
 * Idempotente. Uso: npm run cms:fix-orphan-media [-- --dry]
 */
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { MediaRepository } from '../repositories/MediaRepository';
import { MediaService } from '../services/mediaService';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

const DRY = process.argv.includes('--dry');
const FORCE = process.env.CMS_ALLOW_MEDIA_PURGE === '1';
const MAX_MISSING_RATIO = 0.1;

const log = (msg: string) => process.stdout.write(`${msg}\n`);

function main(): void {
  migrate();
  const db = getDb();
  const mediaService = new MediaService(new MediaRepository(db));

  const total = (db.prepare('SELECT COUNT(*) AS n FROM media_assets').get() as { n: number }).n;
  const orphaned = mediaService.detectOrphanedMedia();

  log(`Catálogo: ${total} asset(s) · ${orphaned.length} sin archivo en disco.`);

  if (!FORCE && total > 0 && orphaned.length / total > MAX_MISSING_RATIO) {
    process.stderr.write(
      `Abortado: faltan ${orphaned.length} de ${total} archivos (${Math.round((orphaned.length / total) * 100)} %).\n` +
        'Eso casi siempre significa que CMS_UPLOAD_DIR apunta al directorio equivocado,\n' +
        'no que el catálogo esté sucio. Verifique la configuración antes de reintentar\n' +
        '(el valor correcto es ./uploads/cms, fuera de public/).\n' +
        'Si la reducción es intencional, repita con CMS_ALLOW_MEDIA_PURGE=1.\n'
    );
    process.exit(1);
  }

  const usedByGallery = db.prepare('SELECT COUNT(*) AS n FROM gallery_items WHERE media_id = ?');
  const usedByContent = db.prepare('SELECT COUNT(*) AS n FROM media_usages WHERE media_id = ?');
  const deleteAsset = db.prepare('DELETE FROM media_assets WHERE id = ?');

  const deletable: typeof orphaned = [];
  const needsReview: string[] = [];

  for (const asset of orphaned) {
    const gallery = (usedByGallery.get(asset.id) as { n: number }).n;
    const content = (usedByContent.get(asset.id) as { n: number }).n;
    if (gallery === 0 && content === 0) deletable.push(asset);
    else
      needsReview.push(
        `${asset.path} — ${gallery} foto(s) de galería, ${content} campo(s) de contenido`
      );
  }

  // Rutas registradas más de una vez: conservamos la más antigua y borramos el
  // resto, siempre que las sobrantes no estén referenciadas por nada.
  const duplicates = db
    .prepare(
      `SELECT path, COUNT(*) AS n FROM media_assets GROUP BY path HAVING n > 1 ORDER BY path`
    )
    .all() as Array<{ path: string; n: number }>;
  const byPath = db.prepare(
    'SELECT id FROM media_assets WHERE path = ? ORDER BY created_at ASC, id ASC'
  );
  const dupDeletable: string[] = [];
  const dupSkipped: string[] = [];
  for (const { path: assetPath } of duplicates) {
    const ids = (byPath.all(assetPath) as Array<{ id: string }>).map((r) => r.id);
    for (const id of ids.slice(1)) {
      const inUse =
        (usedByGallery.get(id) as { n: number }).n + (usedByContent.get(id) as { n: number }).n;
      if (inUse === 0) dupDeletable.push(id);
      else dupSkipped.push(`${assetPath} (${id}) — en uso, no se fusiona`);
    }
  }

  if (!DRY) {
    db.transaction(() => {
      for (const asset of deletable) deleteAsset.run(asset.id);
      for (const id of dupDeletable) deleteAsset.run(id);
    })();
  }

  log(`Huérfanos borrables: ${deletable.length}${DRY ? ' (no borrados: --dry)' : ' borrados'}.`);
  log(
    `Rutas duplicadas: ${duplicates.length} ruta(s), ${dupDeletable.length} fila(s) sobrante(s)${
      DRY ? ' (no borradas: --dry)' : ' borradas'
    }.`
  );

  if (needsReview.length > 0) {
    log(`\n⚠ ${needsReview.length} huérfano(s) EN USO, no se tocaron:`);
    needsReview.forEach((line) => log(`  - ${line}`));
    log('  Reasigne o reemplace el archivo antes de borrarlos.');
  }
  if (dupSkipped.length > 0) {
    log(`\n⚠ ${dupSkipped.length} duplicado(s) en uso, no se fusionaron:`);
    dupSkipped.forEach((line) => log(`  - ${line}`));
  }

  if (!DRY && (deletable.length > 0 || dupDeletable.length > 0)) {
    log('\nSiguiente paso: npm run cms:export');
  }
}

try {
  main();
} catch (error) {
  captureException(error, { action: 'cmsFixOrphanMedia' });
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
