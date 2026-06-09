import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function csvFromEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  rootDir,
  cms: {
    host: process.env.CMS_HOST ?? '0.0.0.0',
    port: intFromEnv('CMS_PORT', 8787),
    databasePath: process.env.CMS_DATABASE_PATH ?? path.join(rootDir, 'cms', 'data', 'hidromont-cms.sqlite'),
    allowedOrigins: csvFromEnv('CMS_ALLOWED_ORIGINS', [
      'http://localhost:4321',
      'http://127.0.0.1:4321',
    ]),
    cookieName: process.env.CMS_COOKIE_NAME ?? 'hidromont_cms_session',
    sessionDays: intFromEnv('CMS_SESSION_DAYS', 7),
    uploadMaxBytes: intFromEnv('CMS_UPLOAD_MAX_BYTES', 8 * 1024 * 1024),
    uploadDir: process.env.CMS_UPLOAD_DIR ?? path.join(rootDir, 'public', 'uploads', 'cms'),
    publicUploadBase: '/uploads/cms',
    publishCheckCommand: process.env.CMS_PUBLISH_CHECK_COMMAND ?? 'npm run check',
  },
  admin: {
    email: process.env.CMS_ADMIN_EMAIL ?? 'admin@hidromont.local',
    password: process.env.CMS_ADMIN_PASSWORD ?? 'Hidromont-Admin-ChangeMe',
  },
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'local',
  },
} as const;
