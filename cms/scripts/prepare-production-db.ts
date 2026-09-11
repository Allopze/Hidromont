/**
 * Deja la base de datos lista para viajar a producción.
 *
 * Una base de desarrollo acumula cosas que no deben publicarse, y ninguna se
 * ve a simple vista. En esta había:
 *
 *   - `admin@hidromont.local` con la contraseña por defecto todavía puesta.
 *     Esa contraseña está en el repositorio y en la documentación, así que
 *     subir la base tal cual era publicar una cuenta con credencial conocida.
 *   - 503 sesiones abiertas de entradas locales, válidas durante siete días.
 *
 * El script hace tres cosas y todas son idempotentes:
 *
 *   1. Borra las cuentas cuya contraseña siga siendo la de por defecto, salvo
 *      que fueran la única y no haya recambio: antes crea la de producción.
 *   2. Vacía la tabla de sesiones.
 *   3. Crea —o actualiza— el administrador de producción con la contraseña de
 *      `_deploy/.env`, que es la que va a viajar en la configuración.
 *
 * Lo tercero importa porque `ensureAdminUser`, el del arranque, no toca un
 * usuario que ya existe: si el correo del `.env` coincide con uno de la base,
 * la contraseña del `.env` se ignora en silencio y nadie puede entrar.
 *
 * La contraseña se lee de `_deploy/.env` y no se pide por argumento: así no
 * pasa por el historial de la terminal ni queda visible en `ps`.
 *
 * Uso:  npm run cms:preparar-produccion [-- --dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { config } from '../config/unifiedConfig';
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { UserRepository } from '../repositories/UserRepository';
import { initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

const DRY = process.argv.includes('--dry');
const CONTRASENA_POR_DEFECTO = 'Hidromont-Admin-ChangeMe';
const log = (msg: string) => process.stdout.write(`${msg}\n`);

/** Correo y contraseña del `.env` que se va a desplegar, no del local. */
function perfilDeProduccion(): { email: string; password: string } {
  const archivo = path.join(config.rootDir, '_deploy', '.env');
  if (!fs.existsSync(archivo)) {
    throw new Error(
      'Falta _deploy/.env. Genérelo antes:\n' + '  npm run env:produccion -- --correo tu@correo.cl'
    );
  }
  const valores: Record<string, string> = {};
  for (const linea of fs.readFileSync(archivo, 'utf8').split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const i = limpia.indexOf('=');
    if (i > 0) valores[limpia.slice(0, i).trim()] = limpia.slice(i + 1).trim();
  }
  const email = valores.CMS_ADMIN_EMAIL;
  const password = valores.CMS_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('_deploy/.env no define CMS_ADMIN_EMAIL y CMS_ADMIN_PASSWORD');
  }
  if (password === CONTRASENA_POR_DEFECTO) {
    throw new Error('_deploy/.env lleva la contraseña por defecto. Regenérelo con --rehacer.');
  }
  return { email, password };
}

async function main(): Promise<void> {
  migrate();
  const db = getDb();
  const usuarios = new UserRepository(db);
  const { email, password } = perfilDeProduccion();

  log(`Administrador de producción: ${email}`);

  // ── 1. Cuentas con la contraseña por defecto ─────────────────────────
  const filas = db.prepare('SELECT id, email, password_hash FROM users').all() as Array<{
    id: string;
    email: string;
    password_hash: string;
  }>;
  const porDefecto: Array<{ id: string; email: string }> = [];
  for (const u of filas) {
    if (await bcrypt.compare(CONTRASENA_POR_DEFECTO, u.password_hash)) {
      porDefecto.push({ id: u.id, email: u.email });
    }
  }

  log(`\nCuentas: ${filas.length} · con contraseña por defecto: ${porDefecto.length}`);
  for (const u of porDefecto) log(`  ⚠ ${u.email}`);

  // ── 2. El administrador de producción ────────────────────────────────
  const existente = usuarios.findByEmail(email);
  const hash = await bcrypt.hash(password, 12);
  const ahora = new Date().toISOString();

  if (existente) {
    log(`\n  ${email} ya existe: se actualiza su contraseña con la de _deploy/.env.`);
    if (!DRY) usuarios.updatePassword(existente.id, hash, ahora);
  } else {
    log(`\n  ${email} no existe: se crea con la contraseña de _deploy/.env.`);
    if (!DRY) usuarios.createUser({ id: nanoid(), email, passwordHash: hash, now: ahora });
  }

  // ── 3. Borrado de las comprometidas y de las sesiones ────────────────
  // Se borran después de crear la de producción, para no dejar nunca la base
  // sin ninguna cuenta por la que entrar.
  const aBorrar = porDefecto.filter((u) => u.email !== email);
  if (aBorrar.length) {
    log(`\n  Se eliminan ${aBorrar.length} cuenta(s) con contraseña por defecto:`);
    for (const u of aBorrar) {
      log(`    - ${u.email}`);
      if (!DRY) db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
    }
  }

  const sesiones = (db.prepare('SELECT COUNT(*) n FROM sessions').get() as { n: number }).n;
  log(`\n  Sesiones abiertas: ${sesiones}${sesiones ? ' → se vacían' : ''}`);
  if (!DRY && sesiones) db.prepare('DELETE FROM sessions').run();

  // Comprobación final sobre el estado real, no sobre lo que creemos haber hecho.
  if (!DRY) {
    const quedan = db.prepare('SELECT email, password_hash FROM users').all() as Array<{
      email: string;
      password_hash: string;
    }>;
    for (const u of quedan) {
      if (await bcrypt.compare(CONTRASENA_POR_DEFECTO, u.password_hash)) {
        throw new Error(`Quedó ${u.email} con la contraseña por defecto. Revise a mano.`);
      }
    }
    const admin = quedan.find((u) => u.email === email);
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      throw new Error('El administrador de producción no quedó con la contraseña de _deploy/.env.');
    }
    log(`\n✓ ${quedan.length} cuenta(s), ninguna con contraseña por defecto, 0 sesiones.`);
    log('  Verificado contra los hashes almacenados.');
    log('\nSiguiente paso: npm run pack:deploy');
  } else {
    log('\n(--dry: no se escribió nada)');
  }
}

main().catch((error) => {
  process.stderr.write(`\n✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
