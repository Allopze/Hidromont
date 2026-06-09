import fastify from 'fastify';
import { config } from './config/unifiedConfig';
import { registerCmsRoutes } from './routes/cmsRoutes';
import { captureException, initErrorTracking } from './utils/errorTracking';

initErrorTracking();

// Advertencia si se usa la contraseña por defecto fuera de localhost
const DEFAULT_PASSWORD = 'Hidromont-Admin-ChangeMe';
const isLocalOnly =
  config.cms.host === '127.0.0.1' || config.cms.host === 'localhost' || config.cms.host === '::1';

if (config.admin.password === DEFAULT_PASSWORD && !isLocalOnly) {
  process.stderr.write(
    '[CMS] ⚠️  ADVERTENCIA: Está usando la contraseña de administrador por defecto (CMS_ADMIN_PASSWORD).\n' +
      '[CMS]    Esto es inseguro si el servidor es accesible desde la red.\n' +
      '[CMS]    Defina CMS_ADMIN_PASSWORD con una contraseña segura antes de exponer el CMS en la red.\n'
  );
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
  await app.listen({ host: config.cms.host, port: config.cms.port });
} catch (error) {
  captureException(error, { action: 'startCmsServer' });
  process.exit(1);
}
