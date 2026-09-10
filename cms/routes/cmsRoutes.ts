import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';
import { config } from '../config/unifiedConfig';
import {
  DRAFT_EFFECT,
  ENTRY_KINDS,
  ENTRY_STATUSES,
  ENUM_FIELDS,
  ENUM_FIELD_LABELS,
  FIELD_TYPES,
} from '../../src/data/content-vocabulary';
import { AuthController } from '../controllers/AuthController';
import { ContentController } from '../controllers/ContentController';
import { MediaController } from '../controllers/MediaController';
import { PublishController } from '../controllers/PublishController';
import { GalleryController } from '../controllers/GalleryController';
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { registerCors, requireAuth, requireCsrf } from '../middleware/security';
import { AuditRepository } from '../repositories/AuditRepository';
import { ContentRepository } from '../repositories/ContentRepository';
import { GalleryRepository } from '../repositories/GalleryRepository';
import { MediaRepository } from '../repositories/MediaRepository';
import { PublishJobRepository } from '../repositories/PublishJobRepository';
import { RateLimitRepository } from '../repositories/RateLimitRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AuthService } from '../services/authService';
import { BackupService } from '../services/backupService';
import { ContentService } from '../services/contentService';
import { ExportService } from '../services/exportService';
import { GalleryService } from '../services/galleryService';
import { ImageService } from '../services/imageService';
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

  // A1-008: barrido periodico de rate-limit. Ademas del cleanup al arranque,
  // un intervalo de 5 min evita que login_attempts crezca sin recoleccion si el
  // proceso vive mucho tiempo entre reinicios. unref() para no bloquear el shutdown.
  // B-7: las sesiones caducadas solo se borraban al hacer login, así que la
  // tabla crecía indefinidamente entre inicios de sesión (165 filas en la base
  // real). Se aprovecha el mismo barrido que ya existe para el rate-limit.
  const cleanupTimer = setInterval(
    () => {
      rateLimitRepository.cleanup();
      userRepository.deleteExpiredSessions(new Date().toISOString());
    },
    5 * 60 * 1000
  );
  cleanupTimer.unref();
  userRepository.deleteExpiredSessions(new Date().toISOString());

  // A1-009: reap jobs de publicacion trabados en 'running' por un crash previo del
  // proceso. Umbral de 10 min: un publish/build sano tarda <120s, asi que cualquier
  // job 'running' mas viejo que eso es seguro que esta huérfano.
  const reaped = publishJobRepository.reapStaleJobs(new Date().toISOString(), 10 * 60 * 1000);
  if (reaped > 0) {
    auditRepository.log({ action: 'publish.jobs_reaped', data: { count: reaped } });
  }

  const authService = new AuthService(userRepository);
  await authService.ensureAdminUser();

  const contentService = new ContentService(contentRepository);
  const mediaService = new MediaService(mediaRepository);
  // A1-012: syncPublicMedia importa media nuevo y reporta huérfanos (archivos
  // borrados de disco fuera del CMS). La advertencia se emite dentro del servicio.
  const mediaSync = await mediaService.syncPublicMedia();
  if (mediaSync.imported > 0) {
    app.log.info(`[CMS] ${mediaSync.imported} media asset(s) importado(s) desde public/.`);
  }

  const galleryRepository = new GalleryRepository(db);
  const galleryService = new GalleryService(galleryRepository);
  const galleryController = new GalleryController(galleryService);

  const imageService = new ImageService();
  const exportService = new ExportService(
    contentRepository,
    undefined,
    galleryRepository,
    imageService
  );
  const publishService = new PublishService(exportService, publishJobRepository);
  const backupService = new BackupService(db);

  const authController = new AuthController(authService);
  const contentController = new ContentController(contentService);
  const mediaController = new MediaController(mediaService);
  const publishController = new PublishController(publishService, backupService);

  // CMS-L6: this endpoint is intentionally unauthenticated (monitoring/CI need to
  // reach it without credentials), so it must not leak business data — entry and
  // media counts were removed; `ok`/`db`/`timestamp` are enough to prove liveness.
  app.get('/api/cms/health', async () => {
    const dbOk = !!db.prepare('SELECT 1').get();
    return {
      ok: dbOk,
      db: dbOk ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
    };
  });
  app.post('/api/cms/login', async (request, reply) => {
    const ip = request.ip ?? 'unknown';
    const { allowed, retryAfterMs } = rateLimitRepository.check(ip);
    if (!allowed) {
      reply.header('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      auditRepository.log({ action: 'login.rate_limited', ip });
      return reply
        .status(429)
        .send({ error: 'Demasiados intentos. Espere antes de intentar de nuevo.' });
    }
    const result = await authController.login(request, reply);
    if (reply.statusCode === 200) {
      rateLimitRepository.reset(ip);
      auditRepository.log({
        action: 'login.success',
        ip,
        data: { email: (request.body as { email?: string })?.email },
      });
    } else {
      auditRepository.log({ action: 'login.failed', ip });
    }
    return result;
  });
  app.post(
    '/api/cms/logout',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      auditRepository.log({
        action: 'logout',
        userId: request.cmsSession?.user.id,
        ip: request.ip,
      });
      return authController.logout(request, reply);
    }
  );
  app.get('/api/cms/session', (request, reply) => authController.session(request, reply));
  app.post(
    '/api/cms/password',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      await authController.changePassword(request, reply);
      auditRepository.log({
        action: reply.statusCode === 200 ? 'password.change' : 'password.change_failed',
        userId: request.cmsSession?.user.id,
        ip: request.ip,
      });
    }
  );

  app.get('/api/cms/manifest', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    contentController.manifest(request, reply)
  );
  app.get('/api/cms/entries', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    contentController.listEntries(request, reply)
  );
  app.post(
    '/api/cms/entries',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      await contentController.createEntry(request, reply);
      if (reply.statusCode === 201) {
        const id = (request.body as { id?: string })?.id;
        auditRepository.log({
          action: 'entry.create',
          userId: request.cmsSession?.user.id,
          entityType: 'entry',
          entityId: id,
          ip: request.ip,
        });
      }
    }
  );
  app.get('/api/cms/entries/:id', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    contentController.getEntry(request, reply)
  );
  app.patch(
    '/api/cms/entries/:id',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await contentController.updateEntryMeta(request, reply);
      if (reply.statusCode === 200) {
        auditRepository.log({
          action: 'entry.update_meta',
          userId: request.cmsSession?.user.id,
          entityType: 'entry',
          entityId: id,
          ip: request.ip,
        });
      }
    }
  );
  app.patch(
    '/api/cms/entries/:id/fields/:key',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      const { id, key } = request.params as { id: string; key: string };
      await contentController.updateField(request, reply);
      if (reply.statusCode === 200) {
        auditRepository.log({
          action: 'field.update',
          userId: request.cmsSession?.user.id,
          entityType: 'entry',
          entityId: id,
          data: { key },
          ip: request.ip,
        });
      }
    }
  );
  app.delete(
    '/api/cms/entries/:id',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await contentController.deleteEntry(request, reply);
      if (reply.statusCode === 200) {
        auditRepository.log({
          action: 'entry.delete',
          userId: request.cmsSession?.user.id,
          entityType: 'entry',
          entityId: id,
          ip: request.ip,
        });
      }
    }
  );

  app.get('/api/cms/audit', { preHandler: [requireAuth(authService)] }, async (_request, reply) => {
    return reply.send({ events: auditRepository.list(200) });
  });

  app.get('/api/cms/media', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    mediaController.list(request, reply)
  );
  app.get('/api/cms/media/:id', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    mediaController.getById(request, reply)
  );
  app.post(
    '/api/cms/media',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      await mediaController.upload(request, reply);
      if (reply.statusCode === 201) {
        auditRepository.log({
          action: 'media.upload',
          userId: request.cmsSession?.user.id,
          entityType: 'media',
          ip: request.ip,
        });
      }
    }
  );
  app.patch(
    '/api/cms/media/:id',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await mediaController.update(request, reply);
      if (reply.statusCode === 200) {
        auditRepository.log({
          action: 'media.update',
          userId: request.cmsSession?.user.id,
          entityType: 'media',
          entityId: id,
          ip: request.ip,
        });
      }
    }
  );
  app.delete(
    '/api/cms/media/:id',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await mediaController.delete(request, reply);
      if (reply.statusCode === 200) {
        auditRepository.log({
          action: 'media.delete',
          userId: request.cmsSession?.user.id,
          entityType: 'media',
          entityId: id,
          ip: request.ip,
        });
      }
    }
  );

  app.post(
    '/api/cms/export',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      await publishController.export(request, reply);
      if (reply.statusCode === 200) {
        auditRepository.log({
          action: 'content.export',
          userId: request.cmsSession?.user.id,
          ip: request.ip,
        });
      }
    }
  );
  app.post(
    '/api/cms/publish',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      await publishController.publish(request, reply);
      if (reply.statusCode === 200) {
        auditRepository.log({
          action: 'content.publish',
          userId: request.cmsSession?.user.id,
          ip: request.ip,
        });
      }
    }
  );
  app.get('/api/cms/publish/jobs', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    publishController.listJobs(request, reply)
  );
  app.get(
    '/api/cms/publish/jobs/:id',
    { preHandler: [requireAuth(authService)] },
    (request, reply) => publishController.getJob(request, reply)
  );

  // Endpoints de revisiones
  app.get(
    '/api/cms/revisions/:entryId',
    { preHandler: [requireAuth(authService)] },
    async (request, reply) => {
      const { entryId } = request.params as { entryId: string };
      const revisions = contentService.listRevisions(entryId);
      return reply.send({ revisions });
    }
  );

  app.post(
    '/api/cms/revisions/:entryId/restore/:revisionId',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      const { entryId, revisionId } = request.params as { entryId: string; revisionId: string };
      const entry = contentService.restoreRevision(entryId, revisionId);
      auditRepository.log({
        action: 'revision.restore',
        userId: request.cmsSession?.user.id,
        entityType: 'entry',
        entityId: entryId,
        data: { revisionId },
        ip: request.ip,
      });
      return reply.send({ ok: true, entry });
    }
  );

  app.post(
    '/api/cms/backup',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      await publishController.backup(request, reply);
      if (reply.statusCode === 200) {
        auditRepository.log({
          action: 'backup.create',
          userId: request.cmsSession?.user.id,
          ip: request.ip,
        });
      }
    }
  );

  app.get('/api/cms/backup/list', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    publishController.listBackups(request, reply)
  );

  app.get(
    '/api/cms/schema',
    { preHandler: [requireAuth(authService)] },
    async (_request, reply) => {
      // A-7: se publica el vocabulario de enumeraciones para que el overlay
      // pueda renderizar desplegables en vez de campos de texto libre. Las
      // tres claves originales se conservan (el e2e las verifica) pero ya no
      // están escritas a mano.
      //
      // B-8: `entryStatuses` devolvía 2 valores mientras el validador aceptaba
      // 3. La divergencia se cerró retirando `pending_review` del vocabulario,
      // no ofreciéndolo: hacía lo mismo que `draft` bajo un nombre que promete
      // una revisión que nadie hace. Ver el comentario en content-vocabulary.
      return reply.send({
        fieldTypes: FIELD_TYPES,
        entryKinds: ENTRY_KINDS,
        entryStatuses: ENTRY_STATUSES,
        enumFields: Object.fromEntries(
          Object.entries(ENUM_FIELDS).map(([kind, fields]) => [
            kind,
            Object.fromEntries(
              Object.entries(fields).map(([key, values]) => [
                key,
                values.map((value) => ({
                  value,
                  label: ENUM_FIELD_LABELS[kind]?.[key]?.[value] ?? value,
                })),
              ])
            ),
          ])
        ),
        // A-9: el mismo valor `draft` tiene dos efectos opuestos según el
        // tipo de entrada. Se declara aquí para que el overlay lo diga.
        draftEffect: DRAFT_EFFECT,
      });
    }
  );

  // ── Gallery routes ────────────────────────────────────────────

  // Albums (GAL-19). Se identifican por slug, no por id.
  app.get('/api/cms/gallery/albums', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    galleryController.listAlbums(request, reply)
  );
  app.post(
    '/api/cms/gallery/albums',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.createAlbum(request, reply);
      if (reply.statusCode === 201) {
        auditRepository.log({
          action: 'gallery.album.create',
          userId: request.cmsSession?.user.id,
          entityType: 'gallery_album',
          ip: request.ip,
        });
      }
    }
  );
  app.patch(
    '/api/cms/gallery/albums/:slug',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.updateAlbum(request, reply);
      if (reply.statusCode === 200) {
        const { slug } = request.params as { slug: string };
        auditRepository.log({
          action: 'gallery.album.update',
          userId: request.cmsSession?.user.id,
          entityType: 'gallery_album',
          entityId: slug,
          ip: request.ip,
        });
      }
    }
  );
  app.delete(
    '/api/cms/gallery/albums/:slug',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.deleteAlbum(request, reply);
      if (reply.statusCode === 200) {
        const { slug } = request.params as { slug: string };
        auditRepository.log({
          action: 'gallery.album.delete',
          userId: request.cmsSession?.user.id,
          entityType: 'gallery_album',
          entityId: slug,
          ip: request.ip,
        });
      }
    }
  );
  app.post(
    '/api/cms/gallery/albums/reorder',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.reorderAlbums(request, reply);
    }
  );

  // Categories
  app.get(
    '/api/cms/gallery/categories',
    { preHandler: [requireAuth(authService)] },
    (request, reply) => galleryController.listCategories(request, reply)
  );
  app.post(
    '/api/cms/gallery/categories',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.createCategory(request, reply);
      if (reply.statusCode === 201) {
        auditRepository.log({
          action: 'gallery.category.create',
          userId: request.cmsSession?.user.id,
          entityType: 'gallery_category',
          ip: request.ip,
        });
      }
    }
  );
  app.patch(
    '/api/cms/gallery/categories/:id',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.updateCategory(request, reply);
      if (reply.statusCode === 200) {
        const { id } = request.params as { id: string };
        auditRepository.log({
          action: 'gallery.category.update',
          userId: request.cmsSession?.user.id,
          entityType: 'gallery_category',
          entityId: id,
          ip: request.ip,
        });
      }
    }
  );
  app.delete(
    '/api/cms/gallery/categories/:id',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.deleteCategory(request, reply);
      if (reply.statusCode === 200) {
        const { id } = request.params as { id: string };
        auditRepository.log({
          action: 'gallery.category.delete',
          userId: request.cmsSession?.user.id,
          entityType: 'gallery_category',
          entityId: id,
          ip: request.ip,
        });
      }
    }
  );
  app.post(
    '/api/cms/gallery/categories/reorder',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.reorderCategories(request, reply);
    }
  );

  // Items
  app.get('/api/cms/gallery/items', { preHandler: [requireAuth(authService)] }, (request, reply) =>
    galleryController.listItems(request, reply)
  );
  app.get(
    '/api/cms/gallery/items/:id',
    { preHandler: [requireAuth(authService)] },
    (request, reply) => galleryController.getItem(request, reply)
  );
  app.post(
    '/api/cms/gallery/items',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.createItem(request, reply);
      if (reply.statusCode === 201) {
        auditRepository.log({
          action: 'gallery.item.create',
          userId: request.cmsSession?.user.id,
          entityType: 'gallery_item',
          ip: request.ip,
        });
      }
    }
  );
  app.patch(
    '/api/cms/gallery/items/:id',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.updateItem(request, reply);
      if (reply.statusCode === 200) {
        const { id } = request.params as { id: string };
        auditRepository.log({
          action: 'gallery.item.update',
          userId: request.cmsSession?.user.id,
          entityType: 'gallery_item',
          entityId: id,
          ip: request.ip,
        });
      }
    }
  );
  app.delete(
    '/api/cms/gallery/items/:id',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.deleteItem(request, reply);
      if (reply.statusCode === 200) {
        const { id } = request.params as { id: string };
        auditRepository.log({
          action: 'gallery.item.delete',
          userId: request.cmsSession?.user.id,
          entityType: 'gallery_item',
          entityId: id,
          ip: request.ip,
        });
      }
    }
  );
  app.post(
    '/api/cms/gallery/items/reorder',
    { preHandler: [requireAuth(authService), requireCsrf()] },
    async (request, reply) => {
      galleryController.reorderItems(request, reply);
    }
  );

  // Siempre importa entradas faltantes al iniciar (idempotente, sin sobreescribir ediciones)
  const { inserted, fieldsInserted } = contentService.importMissingEntries();
  if (inserted > 0 || fieldsInserted > 0) {
    app.log.info(
      `[CMS] seed: ${inserted} entrada(s) y ${fieldsInserted} campo(s) nuevo(s) importado(s).`
    );
    await exportService.exportContent();
  }
}
