/**
 * Mueve a `uploads/cms` las fotos que solo existen como candidatas de la
 * biblioteca de medios, es decir, las que están en `public/fotos/**` y en
 * `media_assets` pero que ninguna página del sitio usa todavía.
 *
 * Motivo: Astro copia `public/` completo a `dist/`, así que una foto que solo
 * es opción del editor viaja a producción y la descargan los visitantes sin
 * que ninguna página la enlace. `uploads/cms` lo sirve el proceso del CMS en
 * `/uploads/cms/*` y no entra en `dist`, que es donde ya viven las otras 1.664
 * entradas de la biblioteca. El editor sigue viéndolas y eligiéndolas igual.
 *
 * Solo mueve una foto si NADA la nombra: ni un `gallery_item`, ni un campo de
 * contenido de tipo `image`, ni un archivo de `src/**`, ni el texto del build.
 * Es el mismo criterio de `optimize-public-photos` —incluido el requisito de
 * un `dist/` recién compilado— con una sola diferencia: aquí una fila en
 * `media_assets` no salva el archivo, lo mueve, porque el destino sigue siendo
 * alcanzable.
 *
 * El build es obligatorio y no es burocracia: las galerías de proyecto arman
 * sus rutas con plantillas (`/fotos/proyectos/${slug}/${archivo}`), así que
 * mirando solo `src/**` hay 44 fotos en uso que parecen huérfanas. Se compara
 * por nombre de archivo además de por ruta, para no depender de cómo quedó
 * escrita la referencia.
 *
 * Nunca sobrescribe: si el nombre ya existe en `uploads/cms` deja la foto
 * donde está y lo reporta, porque dos archivos distintos con el mismo nombre
 * es un conflicto que debe resolver una persona.
 *
 * Idempotente. Uso: npm run cms:move-library-photos [-- --dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/unifiedConfig';
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

const DRY = process.argv.includes('--dry');
const log = (msg: string) => process.stdout.write(`${msg}\n`);

/** Todo el texto de `src/**` que podría nombrar una ruta de foto. */
function textoDeFuentes(root: string): string {
  const acc: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(astro|ts|js|json|md)$/i.test(p)) acc.push(fs.readFileSync(p, 'utf8'));
    }
  };
  const dir = path.join(root, 'src');
  if (fs.existsSync(dir)) walk(dir);
  return acc.join('\n');
}

/** Todo el texto del build. Un CSS o un JS pueden nombrar una foto que ningún
 *  `.astro` menciona, y el HTML ya trae resueltas las rutas de plantilla. */
function textoDelBuild(distDir: string): string {
  let acc = '';
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(html|css|js|json|xml|txt|map)$/i.test(entry.name))
        acc += fs.readFileSync(p, 'utf8');
    }
  };
  walk(distDir);
  return acc;
}

function main(): void {
  migrate();
  const db = getDb();
  const root = config.rootDir;

  const distDir = config.cms.staticDir;
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(
      `No hay build en ${distDir}. Ejecute \`npm run build\` antes: sin él no se puede ` +
        'saber con seguridad qué fotos usa el sitio.'
    );
  }

  const filas = db
    .prepare("SELECT id, path FROM media_assets WHERE path LIKE '/fotos/%'")
    .all() as Array<{ id: string; path: string }>;

  const usadas = new Set<string>();
  for (const r of db
    .prepare('SELECT m.path FROM gallery_items gi JOIN media_assets m ON m.id = gi.media_id')
    .all() as Array<{ path: string }>) {
    usadas.add(r.path);
  }
  for (const r of db
    .prepare("SELECT value_json FROM content_fields WHERE type = 'image'")
    .all() as Array<{ value_json: string }>) {
    try {
      const v = JSON.parse(r.value_json) as unknown;
      if (typeof v === 'string' && v) usadas.add(v);
    } catch {
      /* valor no parseable: se ignora */
    }
  }
  // Se compara por nombre de archivo, no por ruta: el build puede escribirla
  // de otra forma y una plantilla la arma por partes.
  const mencionados = new Set<string>();
  for (const ruta of usadas) mencionados.add(path.posix.basename(ruta));
  for (const contenido of [textoDelBuild(distDir), textoDeFuentes(root)]) {
    for (const m of contenido.matchAll(/[A-Za-z0-9._-]+\.(?:webp|jpe?g|png|svg)/g)) {
      mencionados.add(m[0]);
    }
  }

  const candidatas = filas.filter((f) => !mencionados.has(path.posix.basename(f.path)));
  log(`Fotos de public/fotos en la biblioteca: ${filas.length}`);
  log(`  en uso por el sitio: ${filas.length - candidatas.length}`);
  log(`  solo candidatas de biblioteca: ${candidatas.length}`);
  if (!candidatas.length) {
    log('\nNada que mover.');
    return;
  }

  const uploadDir = config.cms.uploadDir;
  fs.mkdirSync(uploadDir, { recursive: true });
  const actualizar = db.prepare('UPDATE media_assets SET path = ?, updated_at = ? WHERE id = ?');
  const ahora = new Date().toISOString();

  let movidas = 0;
  let bytes = 0;
  const ausentes: string[] = [];
  const choques: string[] = [];

  const aplicar = db.transaction(() => {
    for (const c of candidatas) {
      const base = path.posix.basename(c.path);
      const origen = path.join(root, 'public', c.path.replace(/^\//, ''));
      const destino = path.join(uploadDir, base);

      if (!fs.existsSync(origen)) {
        ausentes.push(c.path);
        continue;
      }
      if (fs.existsSync(destino)) {
        choques.push(base);
        continue;
      }
      bytes += fs.statSync(origen).size;
      if (!DRY) {
        fs.renameSync(origen, destino);
        actualizar.run(`/uploads/cms/${base}`, ahora, c.id);
      }
      movidas++;
    }
  });
  aplicar();

  log(`\n${DRY ? 'Se moverían' : 'Movidas'}: ${movidas} · ${(bytes / 1048576).toFixed(1)} MB`);
  log(`  public/fotos → ${path.relative(root, uploadDir)} (fuera de dist/)`);
  if (ausentes.length) {
    log(`\n${ausentes.length} fila(s) sin archivo en disco (no se tocan):`);
    for (const a of ausentes.slice(0, 10)) log(`  - ${a}`);
    if (ausentes.length > 10) log(`  ... y ${ausentes.length - 10} más`);
    log('  Revíselas con npm run cms:fix-orphan-media.');
  }
  if (choques.length) {
    log(`\n${choques.length} nombre(s) ya existentes en el destino (no se mueven):`);
    for (const c of choques.slice(0, 10)) log(`  - ${c}`);
    log('  Renómbrelas a mano antes de reintentar.');
  }
  if (DRY) log('\n(--dry: no se escribió nada)');
  else log('\nSiguiente paso: npm run build para confirmar que dist/ no las lleva.');
}

main();
