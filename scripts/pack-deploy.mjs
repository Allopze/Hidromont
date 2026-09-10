#!/usr/bin/env node
/**
 * Empaqueta lo que hay que subir al servidor, para despliegues por FTP.
 *
 * Sin SSH no hay `git clone`, así que la alternativa es arrastrar carpetas con
 * un cliente FTP — y ahí es fácil equivocarse por exceso o por defecto. La
 * carpeta del proyecto tiene ~22 GB de material de origen que nunca va al
 * servidor (`Pangal`, `top`, `Canal Chacayes`, vídeos, capturas), y a la vez
 * dos cosas imprescindibles que están fuera del control de versiones: la base
 * de datos y la biblioteca de medios.
 *
 * Genera dos archivos en `_deploy/`:
 *
 *   hidromont-app.zip     código y `public/`. Se sube en cada actualización.
 *   hidromont-datos.zip   base de datos y `uploads/cms`. Solo la primera vez.
 *
 * Van separados porque tienen ritmos distintos: el de datos se sube una vez y
 * a partir de ahí lo manda el CMS del servidor, así que volver a subirlo
 * pisaría lo que se haya editado en producción.
 *
 * Qué entra en el de aplicación lo decide `git ls-files`, no una lista a mano:
 * lo que está bajo control de versiones es exactamente la aplicación. Se
 * restan los archivos que el sitio no sirve (los PDF y documentos del raíz) y
 * lo que el servidor genera o instala por su cuenta.
 *
 * Uso:  npm run pack:deploy [-- --solo-app]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const salida = path.join(raiz, '_deploy');
const SOLO_APP = process.argv.includes('--solo-app');
const log = (m) => process.stdout.write(`${m}\n`);
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

/**
 * Lo que está en git pero no hace falta en el servidor. Los PDF y el material
 * de referencia del raíz no los sirve ninguna página —comprobado: no aparecen
 * en `src/`, `public/` ni en el build— y suman 29 MB en cada subida.
 */
const FUERA = [
  /^[^/]+\.pdf$/i,
  /^[^/]+\.mp4$/i,
  /^(ANALISIS-GASCO|AUDITORIA_UI_UX|PROMPT_AUDITORIA_CMS)\.md$/,
  /^\.github\//,
  /^e2e\//,
  /^screenshots\//,
];

function archivosDeLaApp() {
  const todos = execFileSync('git', ['ls-files', '-z'], { cwd: raiz, maxBuffer: 64 * 1024 * 1024 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  const dentro = todos.filter((f) => !FUERA.some((re) => re.test(f)));
  return { dentro, descartados: todos.length - dentro.length };
}

function pesar(archivos) {
  let total = 0;
  for (const f of archivos) {
    try {
      total += fs.statSync(path.join(raiz, f)).size;
    } catch {
      /* un archivo listado por git que ya no está en disco: lo dirá el zip */
    }
  }
  return total;
}

/** Crea un zip con la lista de rutas dada, pasándolas por stdin a `zip -@`. */
function comprimir(destino, archivos, cwd = raiz) {
  fs.rmSync(destino, { force: true });
  execFileSync('zip', ['-q', '-X', '-@', destino], {
    cwd,
    input: archivos.join('\n'),
    maxBuffer: 64 * 1024 * 1024,
  });
  return fs.statSync(destino).size;
}

function main() {
  // `zip` viene en macOS y en casi cualquier Linux, pero si falta conviene
  // decirlo antes de haber calculado nada.
  try {
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
  } catch {
    throw new Error('No se encontró el comando `zip`. Instálelo y vuelva a intentarlo.');
  }

  fs.mkdirSync(salida, { recursive: true });

  // El contenido sale de `git ls-files`, así que lo que esté modificado o sin
  // añadir no viaja. Es lo correcto —el paquete refleja un estado confirmado—
  // pero hay que decirlo, o alguien sube el zip convencido de llevar un arreglo
  // que se quedó en su portátil.
  const sucio = execFileSync('git', ['status', '--porcelain'], { cwd: raiz })
    .toString('utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.includes('_deploy/'));
  if (sucio.length) {
    log(`⚠ Hay ${sucio.length} cambio(s) sin confirmar. El paquete lleva lo que está en git:`);
    for (const l of sucio.slice(0, 8)) log(`    ${l}`);
    if (sucio.length > 8) log(`    ... y ${sucio.length - 8} más`);
    log('  Confirme antes de empaquetar si esos cambios tienen que ir al servidor.\n');
  }

  // ── Paquete de aplicación ────────────────────────────────────────────
  const { dentro, descartados } = archivosDeLaApp();
  if (!dentro.length) throw new Error('`git ls-files` no devolvió nada: ¿está en el repositorio?');

  log('Paquete de aplicación');
  log(`  archivos en git: ${dentro.length + descartados} · se excluyen ${descartados}`);
  log(`  contenido: ${mb(pesar(dentro))}`);

  const zipApp = path.join(salida, 'hidromont-app.zip');
  log(`  comprimiendo...`);
  log(`  → _deploy/hidromont-app.zip  ${mb(comprimir(zipApp, dentro))}`);

  // Un recordatorio útil: el servidor compila, así que dist/ no viaja, pero
  // los derivados de imagen sí porque viven en public/ y están en git.
  const derivados = dentro.filter((f) => f.startsWith('public/gallery/derived/')).length;
  log(`  incluye ${derivados} derivados de imagen de public/gallery/derived`);

  if (SOLO_APP) {
    log('\n(--solo-app: no se empaquetan los datos)');
    resumen();
    return;
  }

  // ── Paquete de datos ─────────────────────────────────────────────────
  const db = path.join('cms', 'data', 'hidromont-cms.sqlite');
  if (!fs.existsSync(path.join(raiz, db))) {
    throw new Error(`No existe ${db}. Ejecute el CMS una vez antes de empaquetar.`);
  }
  // El WAL puede tener escrituras que aún no están en el .sqlite. Se avisa en
  // vez de copiarlo: lo correcto es cerrar el CMS antes de empaquetar.
  if (fs.existsSync(path.join(raiz, `${db}-wal`))) {
    const tam = fs.statSync(path.join(raiz, `${db}-wal`)).size;
    if (tam > 0) {
      log(`\n⚠ Hay un WAL de ${mb(tam)} junto a la base: detenga el CMS local y repita,`);
      log('  o los últimos cambios no viajarán en el paquete.');
    }
  }

  const medios = [];
  const dirMedios = path.join(raiz, 'uploads', 'cms');
  if (fs.existsSync(dirMedios)) {
    for (const nombre of fs.readdirSync(dirMedios)) {
      if (fs.statSync(path.join(dirMedios, nombre)).isFile()) {
        medios.push(path.join('uploads', 'cms', nombre));
      }
    }
  }

  log('\nPaquete de datos');
  log(`  base de datos: ${mb(fs.statSync(path.join(raiz, db)).size)}`);
  log(`  biblioteca de medios: ${medios.length} archivos · ${mb(pesar(medios))}`);

  const zipDatos = path.join(salida, 'hidromont-datos.zip');
  log('  comprimiendo...');
  const tamDatos = comprimir(zipDatos, [db, ...medios]);
  log(`  → _deploy/hidromont-datos.zip  ${mb(tamDatos)}`);
  if (tamDatos > 250 * 1048576) {
    log('  Es grande: si el gestor de archivos de cPanel falla al descomprimir,');
    log('  suba la carpeta uploads/cms directamente por FTP.');
  }

  resumen();
}

function resumen() {
  log('\nSubir por FTP a la raíz de la aplicación y descomprimir allí.');
  log('El de datos, solo la primera vez: después la copia buena es la del servidor.');
  log('Ver docs/DESPLIEGUE-CPANEL.md, sección 2.');
}

main();
