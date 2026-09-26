/**
 * `npm run cms:import` — añade a la base lo que falte de la semilla.
 *
 * P1-06 (auditoría 2026-09): antes llamaba a `importInitialContent`, que pisa
 * con la semilla CADA campo existente. Sobre una copia de la base local
 * revertía 73 campos publicados —nombre y dirección de la empresa, fotos de
 * galería y 7 cabeceras hacia archivos que no existen— sin dejar revisión. La
 * base es la fuente de verdad: este comando solo inserta entradas y campos que
 * no existen (lo mismo que hace el servidor al arrancar) y nunca modifica lo
 * editado desde el panel.
 */
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
  const result = new ContentService(new ContentRepository(db)).importMissingEntries();
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  captureException(error, { action: 'cmsImport' });
  process.exit(1);
}
