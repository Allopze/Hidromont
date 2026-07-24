/**
 * Test setup: crea una instancia de la app Fastify con SQLite en memoria.
 * Cada suite importa createTestApp() y llama a app.close() al terminar.
 */

import Database from 'better-sqlite3';
import fastify, { type FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { AuditRepository } from '../repositories/AuditRepository';
import { ContentRepository } from '../repositories/ContentRepository';
import { GalleryRepository } from '../repositories/GalleryRepository';
import { MediaRepository } from '../repositories/MediaRepository';
import { PublishJobRepository } from '../repositories/PublishJobRepository';
import { RateLimitRepository } from '../repositories/RateLimitRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AuthService } from '../services/authService';
import { ContentService } from '../services/contentService';
import { ExportService } from '../services/exportService';
import { GalleryService } from '../services/galleryService';
import { MediaService } from '../services/mediaService';
import { PublishService } from '../services/publishService';
import { AuthController } from '../controllers/AuthController';
import { ContentController } from '../controllers/ContentController';
import { GalleryController } from '../controllers/GalleryController';
import { MediaController } from '../controllers/MediaController';
import { PublishController } from '../controllers/PublishController';
import { requireAuth, requireCsrf } from '../middleware/security';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    csrf_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS content_entries (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    slug TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'es-CL',
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS content_fields (
    entry_id TEXT NOT NULL,
    key TEXT NOT NULL,
    type TEXT NOT NULL,
    value_json TEXT NOT NULL,
    source_ref_json TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (entry_id, key),
    FOREIGN KEY (entry_id) REFERENCES content_entries(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    mime TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    size INTEGER NOT NULL,
    alt TEXT,
    focal_x REAL DEFAULT 0.5,
    focal_y REAL DEFAULT 0.5,
    checksum TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS revisions (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (entry_id) REFERENCES content_entries(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS publish_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    action TEXT NOT NULL DEFAULT 'publish',
    logs TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    data_json TEXT,
    ip TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_attempts (
    ip TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    reset_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS media_usages (
    media_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    field_key TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (media_id, entry_id, field_key),
    FOREIGN KEY (media_id) REFERENCES media_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (entry_id) REFERENCES content_entries(id) ON DELETE CASCADE
  );

    CREATE TABLE IF NOT EXISTS gallery_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery_items (
      id TEXT PRIMARY KEY,
      media_id TEXT,
      category_id TEXT,
      title TEXT NOT NULL,
      alt TEXT NOT NULL,
      caption TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      featured INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (media_id) REFERENCES media_assets(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES gallery_categories(id) ON DELETE SET NULL
    );
`;

export interface TestApp {
  app: FastifyInstance;
  db: Database.Database;
  authService: AuthService;
  contentService: ContentService;
  mediaService: MediaService;
  galleryService: GalleryService;
  galleryRepository: GalleryRepository;
  publishJobRepository: PublishJobRepository;
  auditRepository: AuditRepository;
  rateLimitRepository: RateLimitRepository;
  adminEmail: string;
  adminPassword: string;
  /** Login and return { csrfToken, cookieHeader } for subsequent requests */
  login(): Promise<{ csrfToken: string; cookieHeader: string }>;
}

export async function createTestApp(): Promise<TestApp> {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);

  const adminEmail = `admin-${nanoid(6)}@test.local`;
  const adminPassword = 'Test-Pass-123!';

  const userRepository = new UserRepository(db);
  const contentRepository = new ContentRepository(db);
  const mediaRepository = new MediaRepository(db);
  const publishJobRepository = new PublishJobRepository(db);
  const auditRepository = new AuditRepository(db);
  const rateLimitRepository = new RateLimitRepository(db);

  const authService = new AuthService(userRepository);
  // Use cost factor 4 for fast test hashing
  await authService.ensureAdminUserWith(adminEmail, adminPassword, 4);

  const contentService = new ContentService(contentRepository);
  const exportService = new ExportService(contentRepository);
  const mediaService = new MediaService(mediaRepository);
  const publishService = new PublishService(exportService, publishJobRepository);

  const galleryRepository = new GalleryRepository(db);
  const galleryService = new GalleryService(galleryRepository);
  const galleryController = new GalleryController(galleryService);

  const authController = new AuthController(authService);
  const contentController = new ContentController(contentService);
  const mediaController = new MediaController(mediaService);
  const publishController = new PublishController(publishService);

  const app = fastify({ logger: false });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

  app.get('/api/cms/health', async () => ({ ok: true }));
  app.post('/api/cms/login', async (request, reply) => authController.login(request, reply));
  app.post('/api/cms/logout', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    authController.logout(req, reply)
  );
  app.get('/api/cms/session', (req, reply) => authController.session(req, reply));

  app.get('/api/cms/entries', { preHandler: [requireAuth(authService)] }, (req, reply) =>
    contentController.listEntries(req, reply)
  );
  app.post('/api/cms/entries', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    contentController.createEntry(req, reply)
  );
  app.get('/api/cms/entries/:id', { preHandler: [requireAuth(authService)] }, (req, reply) =>
    contentController.getEntry(req, reply)
  );
  app.patch('/api/cms/entries/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    contentController.updateEntryMeta(req, reply)
  );
  app.patch('/api/cms/entries/:id/fields/:key', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    contentController.updateField(req, reply)
  );
  app.delete('/api/cms/entries/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    contentController.deleteEntry(req, reply)
  );

  app.get('/api/cms/media', { preHandler: [requireAuth(authService)] }, (req, reply) =>
    mediaController.list(req, reply)
  );
  app.patch('/api/cms/media/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    mediaController.update(req, reply)
  );
  app.delete('/api/cms/media/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    mediaController.delete(req, reply)
  );

  app.get('/api/cms/revisions/:entryId', { preHandler: [requireAuth(authService)] }, async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    return reply.send({ revisions: contentService.listRevisions(entryId) });
  });
  app.post('/api/cms/revisions/:entryId/restore/:revisionId', { preHandler: [requireAuth(authService), requireCsrf()] }, async (request, reply) => {
    const { entryId, revisionId } = request.params as { entryId: string; revisionId: string };
    return reply.send({ ok: true, entry: contentService.restoreRevision(entryId, revisionId) });
  });

  app.get('/api/cms/publish/jobs', { preHandler: [requireAuth(authService)] }, (req, reply) =>
    publishController.listJobs(req, reply)
  );

  app.get('/api/cms/audit', { preHandler: [requireAuth(authService)] }, async (_req, reply) => {
    return reply.send({ events: auditRepository.list(200) });
  });

  // Gallery routes
  app.get('/api/cms/gallery/categories', { preHandler: [requireAuth(authService)] }, (req, reply) =>
    galleryController.listCategories(req, reply)
  );
  app.post('/api/cms/gallery/categories', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    galleryController.createCategory(req, reply)
  );
  app.patch('/api/cms/gallery/categories/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    galleryController.updateCategory(req, reply)
  );
  app.delete('/api/cms/gallery/categories/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    galleryController.deleteCategory(req, reply)
  );
  app.post('/api/cms/gallery/categories/reorder', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    galleryController.reorderCategories(req, reply)
  );
  app.get('/api/cms/gallery/items', { preHandler: [requireAuth(authService)] }, (req, reply) =>
    galleryController.listItems(req, reply)
  );
  app.get('/api/cms/gallery/items/:id', { preHandler: [requireAuth(authService)] }, (req, reply) =>
    galleryController.getItem(req, reply)
  );
  app.post('/api/cms/gallery/items', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    galleryController.createItem(req, reply)
  );
  app.patch('/api/cms/gallery/items/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    galleryController.updateItem(req, reply)
  );
  app.delete('/api/cms/gallery/items/:id', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    galleryController.deleteItem(req, reply)
  );
  app.post('/api/cms/gallery/items/reorder', { preHandler: [requireAuth(authService), requireCsrf()] }, (req, reply) =>
    galleryController.reorderItems(req, reply)
  );

  await app.ready();

  const login = async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cms/login',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const data = response.json<{ csrfToken: string }>();
    const cookieHeader = response.headers['set-cookie'] as string;
    return { csrfToken: data.csrfToken, cookieHeader };
  };

  return { app, db, authService, contentService, mediaService, galleryService, galleryRepository, publishJobRepository, auditRepository, rateLimitRepository, adminEmail, adminPassword, login };
}
