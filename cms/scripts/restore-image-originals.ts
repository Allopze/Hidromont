/**
 * Devuelve a su ruta original los campos de imagen que apuntan a un derivado
 * del build (`/gallery/derived/<hash>-1600.webp`).
 *
 * Cómo llegaron ahí: la galería genera derivados y alguien copió el resultado
 * al campo de contenido. El efecto es que esos 15 campos no se pueden reelegir
 * desde la biblioteca —un derivado no tiene fila en `media_assets`— y no
 * quedan ligados a `media_usages`, así que el aviso que impide borrar una
 * imagen en uso no los ve.
 *
 * La vuelta es exacta, no heurística: `ImageService` nombra el derivado con
 * `md5(bytes del original).slice(0, 8)`, así que rehasheando los candidatos de
 * la biblioteca se invierte la misma función que puso el nombre. Si algún hash
 * no se resuelve, ese campo se deja intacto y se reporta.
 *
 * No degrada nada: desde que el export calcula los derivados de cada campo de
 * imagen, la página sigue sirviendo el derivado —de hecho ahora también en
 * 640 y 1.024 px—, y el campo vuelve a guardar el original, que es lo que hace
 * la foto reelegible. El hash del original es el mismo, así que el export
 * reutiliza los archivos que ya están en disco.
 *
 * Idempotente. Uso: npm run cms:restore-image-originals [-- --dry]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/unifiedConfig';
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

const DRY = process.argv.includes('--dry');
const log = (msg: string) => process.stdout.write(`${msg}\n`);

/** La misma resolución que usa el CMS para servir un asset por su ruta pública. */
function rutaEnDisco(rutaPublica: string): string {
  if (rutaPublica.startsWith(`${config.cms.publicUploadBase}/`)) {
    return path.join(
      config.cms.uploadDir,
      rutaPublica.slice(config.cms.publicUploadBase.length + 1)
    );
  }
  return path.join(config.rootDir, 'public', rutaPublica.replace(/^\//, ''));
}

function main(): void {
  migrate();
  const db = getDb();

  const campos = db
    .prepare(
      "SELECT entry_id, key, value_json FROM content_fields WHERE type = 'image' AND value_json LIKE '%/gallery/derived/%'"
    )
    .all() as Array<{ entry_id: string; key: string; value_json: string }>;

  log(`Campos de imagen que apuntan a un derivado: ${campos.length}`);
  if (!campos.length) {
    log('\nNada que devolver.');
    return;
  }

  // Qué hash busca cada campo.
  const porHash = new Map<string, Array<{ entryId: string; key: string }>>();
  const sinHash: string[] = [];
  for (const campo of campos) {
    let valor: unknown;
    try {
      valor = JSON.parse(campo.value_json);
    } catch {
      sinHash.push(`${campo.entry_id}.${campo.key}`);
      continue;
    }
    const hash =
      typeof valor === 'string' ? /\/gallery\/derived\/([0-9a-f]{8})-/.exec(valor)?.[1] : undefined;
    if (!hash) {
      sinHash.push(`${campo.entry_id}.${campo.key}`);
      continue;
    }
    const lista = porHash.get(hash) ?? [];
    lista.push({ entryId: campo.entry_id, key: campo.key });
    porHash.set(hash, lista);
  }

  // Rehashear los candidatos hasta encontrar cada original.
  const original = new Map<string, string>();
  const rutas = (
    db.prepare('SELECT path FROM media_assets ORDER BY path').all() as Array<{
      path: string;
    }>
  ).map((r) => r.path);

  for (const ruta of rutas) {
    if (original.size === porHash.size) break;
    const abs = rutaEnDisco(ruta);
    if (!fs.existsSync(abs)) continue;
    const hash = crypto.createHash('md5').update(fs.readFileSync(abs)).digest('hex').slice(0, 8);
    if (porHash.has(hash) && !original.has(hash)) original.set(hash, ruta);
  }

  const actualizar = db.prepare(
    'UPDATE content_fields SET value_json = ?, updated_at = ? WHERE entry_id = ? AND key = ?'
  );
  const ahora = new Date().toISOString();
  let devueltos = 0;
  const sinResolver: string[] = [];

  const aplicar = db.transaction(() => {
    for (const [hash, destinos] of porHash) {
      const ruta = original.get(hash);
      if (!ruta) {
        sinResolver.push(`${hash} (${destinos.map((d) => `${d.entryId}.${d.key}`).join(', ')})`);
        continue;
      }
      for (const destino of destinos) {
        log(`  ${destino.entryId}.${destino.key} → ${ruta}`);
        if (!DRY) actualizar.run(JSON.stringify(ruta), ahora, destino.entryId, destino.key);
        devueltos++;
      }
    }
  });
  aplicar();

  log(`\n${DRY ? 'Se devolverían' : 'Devueltos'}: ${devueltos} campo(s).`);
  if (sinHash.length) {
    log(`\n${sinHash.length} campo(s) con un valor que no se pudo interpretar (no se tocan):`);
    for (const s of sinHash) log(`  - ${s}`);
  }
  if (sinResolver.length) {
    log(`\n${sinResolver.length} hash(es) sin original en la biblioteca (no se tocan):`);
    for (const s of sinResolver) log(`  - ${s}`);
    log('  El derivado sigue sirviéndose; hay que subir el original y reasignar a mano.');
  }
  if (DRY) log('\n(--dry: no se escribió nada)');
  else if (devueltos > 0) log('\nSiguiente paso: npm run cms:export && npm run build');
}

main();
