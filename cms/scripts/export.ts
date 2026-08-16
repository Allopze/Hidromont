import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { ContentRepository } from '../repositories/ContentRepository';
import { GalleryRepository } from '../repositories/GalleryRepository';
import { ExportService } from '../services/exportService';
import { ImageService } from '../services/imageService';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

async function main() {
  try {
    migrate();
    const db = getDb();
    const contentRepo = new ContentRepository(db);
    const galleryRepo = new GalleryRepository(db);
    const imageService = new ImageService();

    const exportService = new ExportService(contentRepo, undefined, galleryRepo, imageService);

    const contentResult = await exportService.exportContent();
    process.stdout.write(`Content export: ${JSON.stringify(contentResult)}\n`);

    const galleryResult = await exportService.exportGallery();
    process.stdout.write(`Gallery export: ${galleryResult.count} items → ${galleryResult.file}\n`);
  } catch (error) {
    captureException(error, { action: 'cmsExport' });
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

main();
