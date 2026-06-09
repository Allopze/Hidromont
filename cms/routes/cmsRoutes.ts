import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { config } from '../config/unifiedConfig';
import { AuthController } from '../controllers/AuthController';
import { ContentController } from '../controllers/ContentController';
import { MediaController } from '../controllers/MediaController';
import { PublishController } from '../controllers/PublishController';
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { registerCors, requireAuth, requireCsrf } from '../middleware/security';
import { ContentRepository } from '../repositories/ContentRepository';
import { MediaRepository } from '../repositories/MediaRepository';
import { PublishJobRepository } from '../repositories/PublishJobRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AuthService } from '../services/authService';
import { ContentService } from '../services/contentService';
import { ExportService } from '../services/exportService';
import { MediaService } from '../services/mediaService';
import { PublishService } from '../services/publishService';

export async function registerCmsRoutes(app: FastifyInstance): Promise<void> {
  migrate();

  await app.register(cookie);
  await app.register(multipart, {
    limits: {
      fileSize: config.cms.uploadMaxBytes,
      files: 1,
    },
  });

  registerCors(app);

  const db = getDb();
  const userRepository = new UserRepository(db);
  const contentRepository = new ContentRepository(db);
  const mediaRepository = new MediaRepository(db);
  const publishJobRepository = new PublishJobRepository(db);

  const authService = new AuthService(userRepository);
  await authService.ensureAdminUser();

  const contentService = new ContentService(contentRepository);
  const exportService = new ExportService(contentRepository);
  const mediaService = new MediaService(mediaRepository);
  const publishService = new PublishService(exportService, publishJobRepository);
  await mediaService.syncPublicMedia();

  const authController = new AuthController(authService);
  const contentController = new ContentController(contentService);
  const mediaController = new MediaController(mediaService);
  const publishController = new PublishController(publishService);

  app.get('/api/cms/health', async () => ({ ok: true }));
  app.post('/api/cms/login', (request, reply) => authController.login(request, reply));
  app.post('/api/cms/logout', { preHandler: [requireAuth(authService), requireCsrf()] }, (request, reply) =>
    authController.logout(request, reply)
  );
  app.get('/api/cms/session', (request, reply) => authController.session(request, reply));

  app.get('/api/cms/manifest', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    contentController.manifest(request, reply)
  );
  app.get('/api/cms/entries/:id', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    contentController.getEntry(request, reply)
  );
  app.patch(
    '/api/cms/entries/:id/fields/:key',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    (request, reply) => contentController.updateField(request, reply)
  );

  app.get('/api/cms/media', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    mediaController.list(request, reply)
  );
  app.post('/api/cms/media', { preHandler: [requireAuth(authService), requireCsrf()] }, (request, reply) =>
    mediaController.upload(request, reply)
  );
  app.patch('/api/cms/media/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, (request, reply) =>
    mediaController.update(request, reply)
  );

  app.post('/api/cms/export', { preHandler: [requireAuth(authService), requireCsrf()] }, (request, reply) =>
    publishController.export(request, reply)
  );
  app.post('/api/cms/publish', { preHandler: [requireAuth(authService), requireCsrf()] }, (request, reply) =>
    publishController.publish(request, reply)
  );
  app.get('/api/cms/publish/jobs', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    publishController.listJobs(request, reply)
  );
  app.get('/api/cms/publish/jobs/:id', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    publishController.getJob(request, reply)
  );

  if (contentRepository.listEntries().length === 0) {
    contentService.importInitialContent();
    exportService.exportContent();
  }
}
