import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { ContentRepository } from '../repositories/ContentRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AuthService } from '../services/authService';
import { ContentService } from '../services/contentService';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

try {
  migrate();
  const db = getDb();
  await new AuthService(new UserRepository(db)).ensureAdminUser();
  const result = new ContentService(new ContentRepository(db)).importInitialContent();
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  captureException(error, { action: 'cmsImport' });
  process.exit(1);
}
