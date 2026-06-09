import fastify from 'fastify';
import { config } from './config/unifiedConfig';
import { registerCmsRoutes } from './routes/cmsRoutes';
import { captureException, initErrorTracking } from './utils/errorTracking';

initErrorTracking();

const app = fastify({
  logger: {
    level: 'info',
  },
  bodyLimit: config.cms.uploadMaxBytes,
});

try {
  await registerCmsRoutes(app);
  await app.listen({ host: config.cms.host, port: config.cms.port });
} catch (error) {
  captureException(error, { action: 'startCmsServer' });
  process.exit(1);
}
