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
import { AuditRepository } from '../repositories/AuditRepository';
import { ContentRepository } from '../repositories/ContentRepository';
import { MediaRepository } from '../repositories/MediaRepository';
import { PublishJobRepository } from '../repositories/PublishJobRepository';
import { RateLimitRepository } from '../repositories/RateLimitRepository';
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
  const auditRepository = new AuditRepository(db);
  const rateLimitRepository = new RateLimitRepository(db);
  rateLimitRepository.cleanup();

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
  app.post('/api/cms/login', async (request, reply) => {
    const ip = request.ip ?? 'unknown';
    const { allowed, retryAfterMs } = rateLimitRepository.check(ip);
    if (!allowed) {
      reply.header('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      auditRepository.log({ action: 'login.rate_limited', ip });
      return reply.status(429).send({ error: 'Demasiados intentos. Espere antes de intentar de nuevo.' });
    }
    const result = await authController.login(request, reply);
    if (reply.statusCode === 200) {
      auditRepository.log({ action: 'login.success', ip, data: { email: (request.body as { email?: string })?.email } });
    } else {
      auditRepository.log({ action: 'login.failed', ip });
    }
    return result;
  });
  app.post('/api/cms/logout', { preHandler: [requireAuth(authService), requireCsrf()] }, async (request, reply) => {
    auditRepository.log({ action: 'logout', userId: request.cmsSession?.user.id, ip: request.ip });
    return authController.logout(request, reply);
  });
  app.get('/api/cms/session', (request, reply) => authController.session(request, reply));

  app.get('/api/cms/manifest', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    contentController.manifest(request, reply)
  );
  app.get('/api/cms/entries', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    contentController.listEntries(request, reply)
  );
  app.post('/api/cms/entries', { preHandler: [requireAuth(authService), requireCsrf()] }, async (request, reply) => {
    await contentController.createEntry(request, reply);
    if (reply.statusCode === 201) {
      const id = (request.body as { id?: string })?.id;
      auditRepository.log({ action: 'entry.create', userId: request.cmsSession?.user.id, entityType: 'entry', entityId: id, ip: request.ip });
    }
  });
  app.get('/api/cms/entries/:id', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    contentController.getEntry(request, reply)
  );
  app.patch('/api/cms/entries/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await contentController.updateEntryMeta(request, reply);
    if (reply.statusCode === 200) {
      auditRepository.log({ action: 'entry.update_meta', userId: request.cmsSession?.user.id, entityType: 'entry', entityId: id, ip: request.ip });
    }
  });
  app.patch(
    '/api/cms/entries/:id/fields/:key',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      const { id, key } = request.params as { id: string; key: string };
      await contentController.updateField(request, reply);
      if (reply.statusCode === 200) {
        auditRepository.log({ action: 'field.update', userId: request.cmsSession?.user.id, entityType: 'entry', entityId: id, data: { key }, ip: request.ip });
      }
    }
  );
  app.delete('/api/cms/entries/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await contentController.deleteEntry(request, reply);
    if (reply.statusCode === 200) {
      auditRepository.log({ action: 'entry.delete', userId: request.cmsSession?.user.id, entityType: 'entry', entityId: id, ip: request.ip });
    }
  });

  app.get('/api/cms/audit', { preHandler: [requireAuth(authService)] }, async (_request, reply) => {
    return reply.send({ events: auditRepository.list(200) });
  });

  app.get('/api/cms/media', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    mediaController.list(request, reply)
  );
  app.post('/api/cms/media', { preHandler: [requireAuth(authService), requireCsrf()] }, async (request, reply) => {
    await mediaController.upload(request, reply);
    if (reply.statusCode === 201) {
      auditRepository.log({ action: 'media.upload', userId: request.cmsSession?.user.id, entityType: 'media', ip: request.ip });
    }
  });
  app.patch('/api/cms/media/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await mediaController.update(request, reply);
    if (reply.statusCode === 200) {
      auditRepository.log({ action: 'media.update', userId: request.cmsSession?.user.id, entityType: 'media', entityId: id, ip: request.ip });
    }
  });
  app.delete('/api/cms/media/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await mediaController.delete(request, reply);
    if (reply.statusCode === 200) {
      auditRepository.log({ action: 'media.delete', userId: request.cmsSession?.user.id, entityType: 'media', entityId: id, ip: request.ip });
    }
  });

  app.post('/api/cms/export', { preHandler: [requireAuth(authService), requireCsrf()] }, async (request, reply) => {
    await publishController.export(request, reply);
    auditRepository.log({ action: 'content.export', userId: request.cmsSession?.user.id, ip: request.ip });
  });
  app.post('/api/cms/publish', { preHandler: [requireAuth(authService), requireCsrf()] }, async (request, reply) => {
    await publishController.publish(request, reply);
    auditRepository.log({ action: 'content.publish', userId: request.cmsSession?.user.id, ip: request.ip });
  });
  app.get('/api/cms/publish/jobs', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    publishController.listJobs(request, reply)
  );
  app.get('/api/cms/publish/jobs/:id', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    publishController.getJob(request, reply)
  );

  // Endpoints de revisiones
  app.get('/api/cms/revisions/:entryId', { preHandler: [requireAuth(authService)] }, async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    const revisions = contentService.listRevisions(entryId);
    return reply.send({ revisions });
  });

  app.post(
    '/api/cms/revisions/:entryId/restore/:revisionId',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      const { entryId, revisionId } = request.params as { entryId: string; revisionId: string };
      const entry = contentService.restoreRevision(entryId, revisionId);
      auditRepository.log({ action: 'revision.restore', userId: request.cmsSession?.user.id, entityType: 'entry', entityId: entryId, data: { revisionId }, ip: request.ip });
      return reply.send({ ok: true, entry });
    }
  );

  // Siempre importa entradas faltantes al iniciar (idempotente, sin sobreescribir ediciones)
  const { inserted } = contentService.importMissingEntries();
  if (inserted > 0) {
    exportService.exportContent();
  }
}
