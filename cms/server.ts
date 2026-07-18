import fastify from 'fastify';
import { config } from './config/unifiedConfig';
import { registerCmsRoutes } from './routes/cmsRoutes';
import { registerStaticSite } from './staticSite';
import { captureException, initErrorTracking } from './utils/errorTracking';

initErrorTracking();

const DEFAULT_PASSWORD = 'Hidromont-Admin-ChangeMe';
const isLocalOnly =
  config.cms.host === '127.0.0.1' || config.cms.host === 'localhost' || config.cms.host === '::1';

// H2: si el CMS escucha en una interfaz expuesta (0.0.0.0 u otra no-loopback),
// la cookie de sesión DEBE ser segura (HTTPS) para no viajar en claro por la red.
// Sin esto, un atacante en la misma LAN podría capturar la sesión de admin.
if (!isLocalOnly && !config.cms.cookieSecure && !config.cms.allowInsecureCookie) {
  process.stderr.write(
    '[CMS] ERROR: El CMS está expuesto a la red (CMS_HOST=' +
      config.cms.host +
      ') con CMS_COOKIE_SECURE=0.\n' +
      '[CMS] La cookie de sesión viajaría en texto plano (HTTP) → riesgo de secuestro de sesión.\n' +
      '[CMS] Opciones:\n' +
      '[CMS]   - Servir el CMS bajo HTTPS y fijar CMS_COOKIE_SECURE=1, o\n' +
      '[CMS]   - Restringir a CMS_HOST=127.0.0.1 (local) y editar por túnel SSH, o\n' +
      '[CMS]   - Para LAN sin SSL explícitamente aceptada, definir CMS_ALLOW_INSECURE_COOKIE=1.\n'
  );
  process.exit(1);
}

if (!isLocalOnly && !config.cms.cookieSecure && config.cms.allowInsecureCookie) {
  process.stderr.write(
    '[CMS] ADVERTENCIA: CMS_ALLOW_INSECURE_COOKIE=1 activo en host expuesto (' +
      config.cms.host +
      '). La cookie de sesión viaja en claro. Aceptable solo en LAN de confianza.\n'
  );
}

if (config.admin.password === DEFAULT_PASSWORD && !isLocalOnly) {
  process.stderr.write(
    '[CMS] ERROR: No se puede iniciar el CMS expuesto a la red con la contraseña por defecto.\n' +
      '[CMS] Defina CMS_ADMIN_PASSWORD con una contraseña segura o use CMS_HOST=127.0.0.1.\n'
  );
  process.exit(1);
}

const app = fastify({
  logger: {
    level: 'info',
  },
  bodyLimit: config.cms.uploadMaxBytes,
});

// Cabeceras de seguridad básicas
app.addHook('onSend', async (_request, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

try {
  await registerCmsRoutes(app);
  registerStaticSite(app);
  await app.listen({ host: config.cms.host, port: config.cms.port });
} catch (error) {
  captureException(error, { action: 'startCmsServer' });
  process.exit(1);
}
