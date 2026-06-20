import fastify from 'fastify';
import { config } from './config/unifiedConfig';
import { registerCmsRoutes } from './routes/cmsRoutes';
import { registerStaticSite } from './staticSite';
import { captureException, initErrorTracking } from './utils/errorTracking';

initErrorTracking();

const DEFAULT_PASSWORD = 'Hidromont-Admin-ChangeMe';
const isLocalOnly =
  config.cms.host === '127.0.0.1' || config.cms.host === 'localhost' || config.cms.host === '::1';

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
