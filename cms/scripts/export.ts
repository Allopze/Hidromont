/**
 * cms:export — Regenera los archivos del sitio desde la base del CMS.
 *
 * Uso:
 *   npm run cms:export                  (lo que hace deploy-vps.sh antes de compilar)
 *   npm run cms:export -- --base-nueva  (instalación nueva: exporta aunque la base
 *                                        estuviera vacía y se acabe de sembrar)
 *
 * M-04 (auditoría 2026-09-28): antes de exportar pone la base al día con el
 * código igual que el servidor al arrancar (`reconciliarBase`). Sin esto, el
 * build del despliegue salía de un contenido distinto del que el servidor da
 * por bueno.
 */
import { config } from '../config/unifiedConfig';
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { AuditRepository } from '../repositories/AuditRepository';
import { ContentRepository } from '../repositories/ContentRepository';
import { GalleryRepository } from '../repositories/GalleryRepository';
import { MediaRepository } from '../repositories/MediaRepository';
import { SlugRepository } from '../repositories/SlugRepository';
import { ContentService } from '../services/contentService';
import { ExportService } from '../services/exportService';
import { ImageService } from '../services/imageService';
import { MediaService } from '../services/mediaService';
import { AVISO_BASE_VACIA, reconciliarBase } from '../services/reconciliacion';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

async function main() {
  try {
    migrate();
    const db = getDb();
    const contentRepo = new ContentRepository(db);
    const galleryRepo = new GalleryRepository(db);
    const mediaRepo = new MediaRepository(db);
    const slugRepo = new SlugRepository(db);
    const contentService = new ContentService(contentRepo, config.cms.contentRootDir, slugRepo);

    const reconciliacion = reconciliarBase({
      db,
      contentService,
      contentRepository: contentRepo,
      slugRepository: slugRepo,
      auditRepository: new AuditRepository(db),
      log: (mensaje) => process.stdout.write(`${mensaje}\n`),
    });
    // Una base vacía recién sembrada es la semilla, no el sitio: exportarla
    // pisaría el contenido del repositorio. Pasa si CMS_DATABASE_PATH apunta
    // mal durante un despliegue, así que se exige decirlo a propósito.
    if (reconciliacion.estabaVacia && !process.argv.includes('--base-nueva')) {
      process.stderr.write(AVISO_BASE_VACIA);
      process.exit(1);
    }
    // Las fotos nuevas de public/ entran en la biblioteca, como al arrancar:
    // su encuadre se lee de ahí al exportar.
    await new MediaService(mediaRepo, contentRepo).syncPublicMedia();

    const exportService = new ExportService(
      contentRepo,
      config.cms.contentRootDir,
      galleryRepo,
      new ImageService(config.cms.contentRootDir),
      mediaRepo,
      slugRepo
    );

    // P0-01: la galería primero, como al publicar: su guarda es lo único que
    // puede abortar, y hacerlo después dejaría el contenido escrito a medias.
    const galleryResult = await exportService.exportGallery();
    process.stdout.write(`Gallery export: ${galleryResult.count} items → ${galleryResult.file}\n`);

    const contentResult = await exportService.exportContent();
    process.stdout.write(`Content export: ${JSON.stringify(contentResult)}\n`);

    // P3-08: derivados que ya no cita ningún export.
    const { removed } = exportService.pruneOrphanDerivatives();
    if (removed.length) process.stdout.write(`Derivados sin uso borrados: ${removed.length}\n`);
  } catch (error) {
    captureException(error, { action: 'cmsExport' });
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

main();
