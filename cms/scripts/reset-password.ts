/**
 * A1-007: resetea la contraseña del admin del CMS.
 *
 * Uso:
 *   npm run cms:reset-password                    # usa CMS_ADMIN_EMAIL/PASSWORD de .env
 *   npm run cms:reset-password -- new@email.cl SecretPwd123   # valores explícitos
 *
 * A diferencia del `ensureAdminUser` del arranque (que es idempotente y no rota el
 * hash si el usuario ya existe), este script SIEMPRE re-hashea y actualiza la
 * contraseña, e invalida todas las sesiones activas del admin.
 *
 * Caso de uso: cambiaste CMS_ADMIN_PASSWORD en .env tras el primer arranque y el
 * CMS seguía aceptando la contraseña vieja (porque el hash almacenado no se rotaba).
 */
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { UserRepository } from '../repositories/UserRepository';
import { AuthService } from '../services/authService';
import { config } from '../config/unifiedConfig';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

async function main() {
  try {
    migrate();
    const db = getDb();
    const userRepository = new UserRepository(db);
    const authService = new AuthService(userRepository);

    const email = process.argv[2]?.trim() || config.admin.email;
    const password = process.argv[3]?.trim() || config.admin.password;

    if (!email || !password) {
      process.stderr.write('Uso: npm run cms:reset-password -- [email] [password]\n');
      process.stderr.write('  o define CMS_ADMIN_EMAIL y CMS_ADMIN_PASSWORD en .env\n');
      process.exit(1);
    }
    if (password.length < 8) {
      process.stderr.write('[CMS] La contraseña debe tener al menos 8 caracteres. Abortando.\n');
      process.exit(1);
    }

    const result = await authService.resetAdminPassword(email, password);

    if (result.created) {
      process.stdout.write(`[CMS] Admin ${email} creado con la nueva contraseña.\n`);
    } else {
      process.stdout.write(`[CMS] Contraseña del admin ${email} actualizada. Sesiones previas invalidadas.\n`);
    }
    process.stdout.write('[CMS] Reinicia el CMS para que los cambios surtan efecto.\n');
  } catch (error) {
    captureException(error, { action: 'cmsResetPassword' });
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

main();
