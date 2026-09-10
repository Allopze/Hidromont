#!/usr/bin/env node
/**
 * Verificación del entorno de despliegue — ejecutar EN EL SERVIDOR (cPanel).
 *
 * Comprueba lo que puede fallar al llevar el CMS y el sitio a un mismo
 * proceso Node en hosting compartido, que es donde están las incógnitas:
 * versión de Node, módulos nativos, espacio, permisos de escritura y perfil
 * de configuración.
 *
 * No modifica nada. Uso:  node scripts/check-deploy-env.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
let fallos = 0;
let avisos = 0;

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const warn = (m) => {
  avisos++;
  console.log(`  \x1b[33m!\x1b[0m ${m}`);
};
const fail = (m) => {
  fallos++;
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
};
const seccion = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

// ── Node ─────────────────────────────────────────────────────────────────
seccion('Node');
const major = Number(process.versions.node.split('.')[0]);
console.log(`  versión: ${process.version} (ABI ${process.versions.modules}, ${process.arch})`);

// El mínimo real no lo marca la sintaxis del código, sino qué versiones tienen
// binario precompilado de better-sqlite3. Comprobado contra los assets de
// v12.10.0: publica para las ABI 127 (Node 22), 137 (Node 24), 141 y 147, pero
// NO para la 115 (Node 20), aunque su `engines` diga «20.x». En Node 20 el
// `npm ci` cae a `node-gyp rebuild`, que necesita python3, make y g++ —lo que
// en hosting compartido no suele haber—. sharp no entra en esta cuenta: usa
// N-API 9, así que su binario vale igual en 18, 20, 22 y 24.
if (major >= 22) ok('cumple el mínimo (>=22): better-sqlite3 tiene binario para esta ABI');
else if (major >= 20)
  fail(
    `Node ${major} no tiene binario precompilado de better-sqlite3: la instalación ` +
      'intentará compilar con node-gyp. Use Node 22 o 24 en el selector de cPanel'
  );
else fail('se requiere Node 22 o superior');

const engines = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).engines;
if (engines?.node) ok(`package.json declara engines.node = ${engines.node}`);
else
  warn(
    'package.json no declara `engines.node`: el selector de Node de cPanel puede elegir otra versión'
  );

// ── Módulos nativos ──────────────────────────────────────────────────────
seccion('Módulos nativos');
for (const mod of ['better-sqlite3', 'sharp']) {
  try {
    await import(mod);
    ok(`${mod} carga correctamente`);
  } catch (error) {
    fail(`${mod} no carga: ${String(error).split('\n')[0]}`);
    console.log(
      `     → suele resolverse con: npm rebuild ${mod}  (o npm ci con la versión de Node correcta)`
    );
  }
}

// ── Escritura ────────────────────────────────────────────────────────────
seccion('Permisos de escritura');
for (const dir of ['dist', 'uploads/cms', 'cms/data', 'src/content', 'src/data']) {
  const full = path.join(root, dir);
  try {
    fs.mkdirSync(full, { recursive: true });
    const probe = path.join(full, `.escritura-${Date.now()}`);
    fs.writeFileSync(probe, 'x');
    fs.unlinkSync(probe);
    ok(`${dir} escribible`);
  } catch (error) {
    fail(`${dir} NO escribible: ${String(error).split('\n')[0]}`);
  }
}
console.log('     Nota: «Publicar» reconstruye dist/ y reescribe src/content y src/data.');
console.log('     uploads/cms y cms/data deben SOBREVIVIR a un redespliegue: no los dejes');
console.log('     dentro del árbol que se sincroniza con git.');

// ── Espacio ──────────────────────────────────────────────────────────────
seccion('Espacio en disco');
function tamanio(dir) {
  try {
    return execSync(`du -sk "${path.join(root, dir)}" 2>/dev/null | cut -f1`)
      .toString()
      .trim();
  } catch {
    return null;
  }
}
let totalKb = 0;
for (const dir of ['dist', 'node_modules', 'public', 'uploads/cms', 'cms/data']) {
  const kb = Number(tamanio(dir) ?? 0);
  totalKb += kb;
  console.log(`  ${dir.padEnd(14)} ${kb ? (kb / 1024).toFixed(0).padStart(6) + ' MB' : '     —'}`);
}
console.log(`  ${'TOTAL'.padEnd(14)} ${(totalKb / 1024).toFixed(0).padStart(6)} MB`);
if (totalKb / 1024 > 4096) warn('por encima de 4 GB: comprobar la cuota del plan de hosting');
else ok('dentro de lo esperado');

// ── Configuración ────────────────────────────────────────────────────────
seccion('Configuración (.env)');
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  fail('no existe .env — copiar .env.production.example y completarlo');
} else {
  const env = Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      })
  );

  const esLocal = ['127.0.0.1', 'localhost', '::1'].includes(env.CMS_HOST);
  if (env.CMS_COOKIE_SECURE === '1') ok('CMS_COOKIE_SECURE=1 (cookie solo por HTTPS)');
  else if (esLocal) warn('CMS_COOKIE_SECURE distinto de 1, pero el host es local');
  else fail('CMS_COOKIE_SECURE debe ser 1 con el CMS accesible desde internet');

  if (env.CMS_ALLOW_INSECURE_COOKIE === '1')
    fail('CMS_ALLOW_INSECURE_COOKIE=1 no debe usarse en producción');
  else ok('CMS_ALLOW_INSECURE_COOKIE sin activar');

  if (!env.CMS_ADMIN_PASSWORD || env.CMS_ADMIN_PASSWORD === 'Hidromont-Admin-ChangeMe')
    fail('CMS_ADMIN_PASSWORD sigue en el valor por defecto');
  else if (env.CMS_ADMIN_PASSWORD.length < 16) warn('CMS_ADMIN_PASSWORD de menos de 16 caracteres');
  else ok('CMS_ADMIN_PASSWORD definida');

  const upload = path.resolve(root, env.CMS_UPLOAD_DIR ?? 'uploads/cms');
  if (upload.startsWith(path.join(root, 'public')))
    fail('CMS_UPLOAD_DIR cae dentro de public/: Astro lo copiaría a dist/ en cada build');
  else ok(`CMS_UPLOAD_DIR fuera de public/ (${env.CMS_UPLOAD_DIR ?? 'por defecto'})`);

  if ((env.CMS_PUBLISH_CHECK_COMMAND ?? '').includes('build'))
    ok('CMS_PUBLISH_CHECK_COMMAND reconstruye el sitio');
  else
    fail(
      'CMS_PUBLISH_CHECK_COMMAND no incluye un build: publicar no actualizaría el sitio servido'
    );

  if (env.PUBLIC_ENABLE_CMS === '1')
    ok('PUBLIC_ENABLE_CMS=1 (necesario para administrar desde el servidor)');
  else warn('PUBLIC_ENABLE_CMS distinto de 1: el sitio no tendrá interfaz de administración');

  if ((env.PUBLIC_CONTACT_EMAIL ?? '').includes('@hidromont.cl'))
    ok(`formulario dirigido a ${env.PUBLIC_CONTACT_EMAIL}`);
  else
    fail(
      `PUBLIC_CONTACT_EMAIL = "${env.PUBLIC_CONTACT_EMAIL ?? '(sin definir)'}" — debe ser un buzón corporativo`
    );

  if ((env.CMS_ALLOWED_ORIGINS ?? '').includes('https://'))
    ok('CMS_ALLOWED_ORIGINS con orígenes HTTPS');
  else warn('CMS_ALLOWED_ORIGINS sin ningún origen HTTPS');
}

// ── Tiempo de build ──────────────────────────────────────────────────────
seccion('Build');
console.log('  No se ejecuta aquí. Medir una vez con:');
console.log('    time npm run build');
console.log('  y ajustar CMS_PUBLISH_TIMEOUT_MS a ~3× lo medido.');
console.log(
  `  CPUs: ${os.cpus().length} · memoria total: ${(os.totalmem() / 1024 ** 3).toFixed(1)} GB`
);
if (os.totalmem() / 1024 ** 3 < 1)
  warn('menos de 1 GB de memoria: `astro check` puede quedarse sin memoria');

// ── Resumen ──────────────────────────────────────────────────────────────
console.log(`\n\x1b[1mResumen:\x1b[0m ${fallos} fallo(s), ${avisos} aviso(s).`);
process.exit(fallos > 0 ? 1 : 0);
