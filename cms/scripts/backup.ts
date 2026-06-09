/**
 * cms:backup — Crea una copia timestamped de la base de datos SQLite.
 *
 * Uso:
 *   npm run cms:backup
 *
 * El backup se guarda en cms/data/backups/hidromont-cms-YYYY-MM-DDTHH-MM-SS.sqlite
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

try {
  migrate();
  const db = getDb();

  const backupDir = path.resolve('cms/data/backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dest = path.join(backupDir, `hidromont-cms-${timestamp}.sqlite`);

  // better-sqlite3 backup() hace una copia online consistente
  (db as unknown as { backup: (dest: string) => Promise<void> }).backup(dest);

  process.stdout.write(
    JSON.stringify({ ok: true, file: dest, timestamp: new Date().toISOString() }, null, 2) + '\n'
  );
} catch (error) {
  captureException(error, { action: 'cmsBackup' });
  process.stderr.write(`Error al crear backup: ${String(error)}\n`);
  process.exit(1);
}
