/**
 * Arranca el CMS de Playwright con copias de datos desechables.
 *
 * La base SQLite se clona con la API de backup de SQLite; src/content, src/data,
 * los respaldos y los uploads quedan bajo un directorio temporal. Los uploads
 * existentes se enlazan en el sandbox para conservar las previsualizaciones sin
 * permitir que un borrado de prueba elimine el original.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import { config } from '../cms/config/unifiedConfig.ts';

const projectRoot = config.rootDir;
const e2ePort = Number.parseInt(process.env.E2E_CMS_PORT || '8787', 10);
const sourceDatabase = path.resolve(projectRoot, config.cms.databasePath);
const sourceUploads = config.cms.uploadDir;

if (!Number.isInteger(e2ePort) || e2ePort < 1024 || e2ePort > 65535) {
  throw new Error(`E2E_CMS_PORT no es un puerto válido: ${process.env.E2E_CMS_PORT}`);
}
// P1-09 (auditoría 2026-09): sin base de origen —en CI o en un clon limpio,
// porque cms/data/ no está en git— el sandbox ya no aborta: arranca con una
// base vacía y el propio CMS la migra y la siembra desde src/content y la
// semilla, igual que en un primer arranque. Antes la CI moría aquí.
const baseDeOrigen = fs.existsSync(sourceDatabase);
if (!baseDeOrigen) {
  process.stdout.write(
    `[E2E] Sin base CMS de origen (${sourceDatabase}): se usa una base nueva sembrada al arrancar.\n`
  );
}

const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-cms-e2e-'));
const databasePath = path.join(sandboxDir, 'hidromont-cms.sqlite');
const uploadDir = path.join(sandboxDir, 'uploads');
const contentRootDir = path.join(sandboxDir, 'content-root');
const backupDir = path.join(sandboxDir, 'backups');
let cmsProcess;
let shuttingDown = false;
let cleaned = false;

function removeSandbox() {
  if (cleaned) return;
  cleaned = true;
  fs.rmSync(sandboxDir, { recursive: true, force: true });
}

function copySourceDirectory(relativePath) {
  const source = path.join(projectRoot, relativePath);
  const destination = path.join(contentRootDir, relativePath);
  if (fs.existsSync(source)) {
    fs.cpSync(source, destination, { recursive: true, dereference: true });
  }
}

function linkExistingUploads() {
  fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(sourceUploads)) return;

  for (const entry of fs.readdirSync(sourceUploads, { withFileTypes: true })) {
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    const source = path.join(sourceUploads, entry.name);
    const destination = path.join(uploadDir, entry.name);
    try {
      fs.symlinkSync(source, destination);
    } catch {
      // Windows sin permisos de symlink: copiar preserva el aislamiento.
      try {
        fs.copyFileSync(source, destination);
      } catch (error) {
        throw new Error(`No se pudo preparar el medio E2E ${entry.name}: ${error.message}`);
      }
    }
  }
}

async function prepareSandbox() {
  if (baseDeOrigen) {
    const source = new Database(sourceDatabase, { readonly: true, fileMustExist: true });
    try {
      await source.backup(databasePath);
    } finally {
      source.close();
    }
  }

  for (const relativePath of ['src/content', 'src/data']) copySourceDirectory(relativePath);
  if (!baseDeOrigen) {
    // Una base nueva no conoce las fotos del gallery.json versionado y la
    // guarda del export se negaría a publicar. La copia del sandbox arranca
    // con la galería vacía; el sitio (astro dev) sigue leyendo la del repo.
    const galeria = path.join(contentRootDir, 'src', 'data', 'gallery.json');
    if (fs.existsSync(galeria)) {
      const datos = JSON.parse(fs.readFileSync(galeria, 'utf8'));
      fs.writeFileSync(galeria, JSON.stringify({ ...datos, items: [] }, null, 2) + '\n');
    }
  }
  fs.mkdirSync(backupDir, { recursive: true });
  linkExistingUploads();
}

function stop(signal) {
  shuttingDown = true;
  if (!cmsProcess || cmsProcess.exitCode !== null) {
    removeSandbox();
    process.exit(0);
  }
  cmsProcess.kill(signal);
  const forcedStop = setTimeout(() => cmsProcess?.kill('SIGKILL'), 5000);
  forcedStop.unref();
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

try {
  await prepareSandbox();
  const cmsEnvironment = {
    ...process.env,
    NODE_ENV: 'test',
    CMS_HOST: 'localhost',
    CMS_PORT: String(e2ePort),
    CMS_COOKIE_SECURE: '0',
    CMS_ALLOWED_ORIGINS: 'http://localhost:4321,http://127.0.0.1:4321',
    CMS_DATABASE_PATH: databasePath,
    CMS_UPLOAD_DIR: uploadDir,
    CMS_CONTENT_ROOT_DIR: contentRootDir,
    CMS_BACKUP_DIR: backupDir,
    // Publicar/compilar nunca forma parte de esta suite; el resto de las rutas
    // trabaja sobre el sandbox temporal.
    CMS_PUBLISH_CHECK_COMMAND: 'false',
  };

  process.stdout.write(`[E2E] CMS aislado: ${sandboxDir}\n`);
  cmsProcess = spawn(process.execPath, ['--import', 'tsx', 'cms/server.ts'], {
    cwd: projectRoot,
    env: cmsEnvironment,
    stdio: 'inherit',
  });
  cmsProcess.once('error', (error) => {
    process.stderr.write(`[E2E] No se pudo iniciar el CMS aislado: ${error.message}\n`);
    removeSandbox();
    process.exitCode = 1;
  });
  cmsProcess.once('exit', (code) => {
    removeSandbox();
    process.exitCode = shuttingDown ? 0 : (code ?? 1);
  });
} catch (error) {
  removeSandbox();
  process.stderr.write(`[E2E] No se pudo preparar el sandbox CMS: ${error.message}\n`);
  process.exitCode = 1;
}
