/**
 * GAL-2 — Registra en `media_assets` los archivos de public/fotos,
 * public/logos-clientes y uploads/cms que aún no estén en la base.
 *
 * La lógica ya existía en MediaService.syncPublicMedia() pero solo corría al
 * arrancar el servidor del CMS (cms/routes/cmsRoutes.ts), así que las fotos
 * añadidas al repo por fuera del CMS quedaban invisibles para él hasta el
 * siguiente reinicio. Este punto de entrada permite ejecutarlo solo, que es lo
 * que necesita la importación de la galería para poder resolver cada foto a un
 * media_asset.
 *
 * Idempotente: un archivo ya registrado (mismo `path`) se salta.
 *
 * Uso: npm run cms:sync-media
 */
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { MediaRepository } from '../repositories/MediaRepository';
import { MediaService } from '../services/mediaService';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

async function main() {
  try {
    migrate();
    const mediaService = new MediaService(new MediaRepository(getDb()));
    const { imported, orphaned } = await mediaService.syncPublicMedia();
    process.stdout.write(
      `Media sync: ${imported} archivo(s) nuevo(s) registrado(s); ${orphaned.length} huérfano(s) detectado(s).\n`
    );
  } catch (error) {
    captureException(error, { action: 'cmsSyncMedia' });
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

main();
