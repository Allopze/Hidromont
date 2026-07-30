/**
 * cms:backup — Crea una copia timestamped de la base de datos SQLite.
 *
 * Uso:
 *   npm run cms:backup
 *
 * El backup se guarda en cms/data/backups/hidromont-cms-YYYY-MM-DDTHH-MM-SS.sqlite
 */

import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { BackupService } from '../services/backupService';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

async function main(): Promise<void> {
  migrate();
  const db = getDb();
  // CMS-9 fix: delegate to BackupService instead of duplicating the backup
  // logic here. The previous copy called `(db).backup(dest)` without
  // `await`-ing it (better-sqlite3's backup() is async/incremental), so
  // `{ok:true}` could print before the copy actually finished — risking a
  // truncated .sqlite if the process exited right after. It also resolved the
  // backup directory via `path.resolve('cms/data/backups')` (relative to
  // whatever the CWD happened to be), unlike BackupService's config.rootDir-based
  // path used by the equivalent /api/cms/backup route.
  const backupService = new BackupService(db);
  const result = await backupService.createBackup();

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((error) => {
  captureException(error, { action: 'cmsBackup' });
  process.stderr.write(`Error al crear backup: ${String(error)}\n`);
  process.exit(1);
});
