import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveStaticDir } from './staticDir';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Cargar variables de entorno desde el archivo .env si existe
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

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

const cookieBaseName = process.env.CMS_COOKIE_NAME ?? 'hidromont_cms_session';
const cookieSecure = process.env.CMS_COOKIE_SECURE
  ? process.env.CMS_COOKIE_SECURE === '1'
  : process.env.NODE_ENV === 'production';

// H-14: cuando la cookie es segura usamos el prefijo __Host- que el navegador
// refuerza con: Secure obligatorio, Path=/, sin atributo Domain.
// En HTTP local/LAN usamos el nombre base para compatibilidad con el overlay.
const cookieName = cookieSecure ? `__Host-${cookieBaseName}` : cookieBaseName;

export const config = {
  rootDir,
  cms: {
    host: process.env.CMS_HOST ?? '127.0.0.1',
    port: intFromEnv('CMS_PORT', intFromEnv('PORT', 8787)),
    staticDir: resolveStaticDir(rootDir, process.env.CMS_STATIC_DIR),
    databasePath:
      process.env.CMS_DATABASE_PATH ?? path.join(rootDir, 'cms', 'data', 'hidromont-cms.sqlite'),
    allowedOrigins: csvFromEnv('CMS_ALLOWED_ORIGINS', [
      'http://localhost:4321',
      'http://127.0.0.1:4321',
    ]),
    // H-14: cookieName ya incluye el prefijo __Host- cuando cookieSecure=true.
    // cookieBaseName se preserva para referencia sin prefijo (ej: logs, pruebas).
    cookieBaseName,
    cookieName,
    cookieSecure,
    // Escape hatch for LAN-only setups where the operator explicitly accepts the risk
    // of an insecure (HTTP) session cookie. Must be paired with a non-default password.
    allowInsecureCookie: process.env.CMS_ALLOW_INSECURE_COOKIE === '1',
    // CMS-L2: false by default — request.ip (used for login rate-limiting and
    // audit logs) is the direct TCP peer, which can't be spoofed via headers.
    // Only enable if a trusted reverse proxy sits in front of this server and
    // sets X-Forwarded-For itself; otherwise any client can forge that header
    // to bypass the rate limit or pollute the audit log with a fake IP.
    trustProxy: process.env.CMS_TRUST_PROXY === '1',
    sessionDays: intFromEnv('CMS_SESSION_DAYS', 7),
    uploadMaxBytes: intFromEnv('CMS_UPLOAD_MAX_BYTES', 8 * 1024 * 1024),
    // Fuera de public/ para que Astro no copie los originales (2+ GB) a dist/
    // en cada build; el servidor CMS los sirve directamente en /uploads/cms.
    //
    // C-2: se resuelve contra rootDir y no contra el CWD. Antes el valor de
    // entorno se usaba crudo, así que un `./uploads/cms` apuntaba a un sitio
    // distinto según desde dónde se lanzara el proceso — y un `.env` que
    // apuntaba a `./public/uploads/cms` (directorio inexistente) dejó 1.705
    // de 2.140 medios irrecuperables sin que nada fallara de forma visible.
    uploadDir: process.env.CMS_UPLOAD_DIR
      ? path.resolve(rootDir, process.env.CMS_UPLOAD_DIR)
      : path.join(rootDir, 'uploads', 'cms'),
    publicUploadBase: '/uploads/cms',
    publishCheckCommand: process.env.CMS_PUBLISH_CHECK_COMMAND ?? 'npm run build',
    // A-6: 120 s bastaban para `astro check`, pero no para un `npm run build`
    // completo con procesado de imágenes, que es lo que hace falta para que
    // publicar actualice de verdad el sitio servido. Configurable porque el
    // tiempo depende de la máquina: en hosting compartido es bastante mayor.
    publishTimeoutMs: intFromEnv('CMS_PUBLISH_TIMEOUT_MS', 600_000),
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

/**
 * Traduce un path público de asset (el que guarda la DB, ej. "/uploads/cms/x.jpg"
 * o "/fotos/curadas/y.webp") a su ruta física en disco. Los uploads del CMS
 * viven en config.cms.uploadDir (fuera de public/); todo lo demás en public/.
 */
export function resolvePublicAssetPath(publicPath: string): string {
  const clean = publicPath.startsWith('/') ? publicPath : `/${publicPath}`;
  if (clean.startsWith(`${config.cms.publicUploadBase}/`)) {
    return path.join(config.cms.uploadDir, clean.slice(config.cms.publicUploadBase.length + 1));
  }
  return path.join(config.rootDir, 'public', clean.slice(1));
}
