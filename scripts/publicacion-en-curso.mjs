#!/usr/bin/env node
/**
 * ¿Hay ahora mismo una publicación o un build en marcha en esta instalación?
 *
 * Lo usa `scripts/deploy-vps.sh` antes de tocar nada (M-04, auditoría
 * 2026-09-28): un despliegue hace `git checkout` de los archivos que exporta el
 * panel y `npm ci` —que sustituye `node_modules`— mientras un «Publicar» puede
 * estar compilando con ellos. Si luego el build del despliegue encontraba el
 * cerrojo, el script salía sin reiniciar y dejaba código nuevo en disco con el
 * proceso viejo en memoria.
 *
 * Sale con 0 si no hay nada en marcha y con 3 (y una línea que lo explica) si
 * lo hay. Cualquier otro error sale con 1: el despliegue no debe seguir a
 * ciegas.
 *
 * Una publicación `running` cuya última actualización es más vieja que el
 * tiempo máximo de publicación más un margen se da por colgada (el proceso
 * murió y aún no se ha reiniciado para descartarla): no bloquea.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(raiz, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile);
}

export function cerrojoVivo(archivo) {
  if (!fs.existsSync(archivo)) return null;
  const pid = Number(fs.readFileSync(archivo, 'utf8'));
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

export function publicacionEnMarcha(db, ahora = Date.now(), margenMs = 0) {
  const fila = db
    .prepare(
      "SELECT id, updated_at FROM publish_jobs WHERE status = 'running' ORDER BY updated_at DESC LIMIT 1"
    )
    .get();
  if (!fila) return null;
  const actualizado = Date.parse(fila.updated_at);
  if (Number.isFinite(actualizado) && ahora - actualizado > margenMs) return null;
  return fila.id;
}

function main() {
  const pid = cerrojoVivo(path.join(raiz, '.build.lock'));
  if (pid) {
    process.stdout.write(`hay un build en marcha (proceso ${pid}, ver .build.lock)\n`);
    process.exit(3);
  }

  const base = path.resolve(
    raiz,
    process.env.CMS_DATABASE_PATH ?? path.join('cms', 'data', 'hidromont-cms.sqlite')
  );
  if (!fs.existsSync(base)) process.exit(0);

  const Database = createRequire(path.join(raiz, 'package.json'))('better-sqlite3');
  const db = new Database(base, { readonly: true, fileMustExist: true });
  try {
    const tope = Number.parseInt(process.env.CMS_PUBLISH_TIMEOUT_MS ?? '', 10) || 600_000;
    const id = publicacionEnMarcha(db, Date.now(), tope + 5 * 60_000);
    if (id) {
      process.stdout.write(`hay una publicación del panel en marcha (trabajo ${id})\n`);
      process.exit(3);
    }
  } finally {
    db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `No se pudo comprobar si hay una publicación en marcha: ${error.message}\n`
    );
    process.exit(1);
  }
}
