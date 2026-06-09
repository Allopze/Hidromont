import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { ContentRepository } from '../repositories/ContentRepository';
import { ExportService } from '../services/exportService';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

try {
  migrate();
  const result = new ExportService(new ContentRepository(getDb())).exportContent();
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  captureException(error, { action: 'cmsExport' });
  process.exit(1);
}
