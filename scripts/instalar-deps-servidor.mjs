#!/usr/bin/env node
/**
 * Instala las dependencias en un lugar que el cron del servidor sí alcance.
 *
 * El problema: cPanel deja `~/hidromont/node_modules` como un enlace a
 * `~/nodevenv/hidromont/24/lib/node_modules`, y ese subárbol no es visible
 * desde un proceso lanzado por cron —comprobado por las dos rutas que expone
 * CageFS, `/home4/hidrochile` y `/home/hidrochile`—. El proceso de Passenger
 * sí lo ve; el de cron no. Y compilar tiene que hacerse desde cron, porque es
 * el único contexto sin el límite de espacio de direcciones de 4 GiB.
 *
 * Qué hace, en este orden y por buenas razones:
 *
 *   1. Instala en `~/build-deps`, no en el sitio definitivo. Así el sitio
 *      sigue en pie durante los diez o veinte minutos que tarda.
 *   2. Comprueba que la instalación sirve —que `astro` se resuelve— antes de
 *      tocar nada del directorio de la aplicación.
 *   3. Sustituye el enlace por uno **relativo** (`../build-deps/node_modules`).
 *      Un enlace relativo resuelve igual se llame el home `/home4/hidrochile`
 *      o `/home/hidrochile`, que es justo lo que rompía el de cPanel.
 *
 * El cambio de enlace es un `rm` y un `ln`: la ventana en la que la aplicación
 * no tiene dependencias dura milisegundos, no la instalación entera.
 *
 * Idempotente: si ya está instalado y el enlace apunta bien, no hace nada.
 *
 * Uso:  node scripts/instalar-deps-servidor.mjs [--dry]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const informe = path.join(raiz, '_deps.log');
fs.writeFileSync(informe, '');
const log = (m) => {
  fs.appendFileSync(informe, `${m}\n`);
  process.stdout.write(`${m}\n`);
};

const destino = path.resolve(raiz, '..', 'build-deps');
const enlaceRelativo = path.join('..', 'build-deps', 'node_modules');
const nodeModules = path.join(raiz, 'node_modules');

/** ¿Se resuelve `astro` desde este directorio? Es la prueba que importa. */
function astroResoluble(desde) {
  try {
    createRequire(path.join(desde, 'package.json')).resolve('astro/package.json');
    return true;
  } catch {
    return false;
  }
}

function estadoDelEnlace() {
  try {
    const st = fs.lstatSync(nodeModules);
    if (!st.isSymbolicLink()) return { tipo: 'directorio' };
    const apunta = fs.readlinkSync(nodeModules);
    return { tipo: 'enlace', apunta, roto: !fs.existsSync(nodeModules) };
  } catch {
    return { tipo: 'ausente' };
  }
}

log(`# ${new Date().toISOString()}`);
log(`# node ${process.version} · HOME=${process.env.HOME}`);
log(`# aplicación: ${raiz}`);
log(`# destino de las dependencias: ${destino}`);

const antes = estadoDelEnlace();
log(
  `# node_modules ahora: ${antes.tipo}${antes.apunta ? ` → ${antes.apunta}` : ''}${antes.roto ? ' (ROTO)' : ''}`
);

if (astroResoluble(raiz)) {
  log('\n✓ Las dependencias ya son alcanzables desde aquí. No hay nada que hacer.');
  process.exit(0);
}

// ── 1. Instalar aparte ────────────────────────────────────────────────
if (!astroResoluble(destino)) {
  log(`\n# Instalando en ${destino} (esto tarda; el sitio sigue en pie)`);
  if (!DRY) {
    fs.mkdirSync(destino, { recursive: true });
    for (const archivo of ['package.json', 'package-lock.json']) {
      fs.copyFileSync(path.join(raiz, archivo), path.join(destino, archivo));
    }
    const npm = path.join(path.dirname(process.execPath), 'npm');
    const res = spawnSync(process.execPath, [npm, 'ci', '--no-audit', '--no-fund'], {
      cwd: destino,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        PATH: `${path.dirname(process.execPath)}:${process.env.PATH ?? ''}`,
      },
    });
    if (res.stdout) log(res.stdout.trimEnd());
    if (res.stderr) log(res.stderr.trimEnd());
    if (res.status !== 0) {
      log(`\n✖ npm ci terminó con código ${res.status}. No se toca el enlace.`);
      process.exit(1);
    }
  }
} else {
  log(`\n# Ya hay una instalación utilizable en ${destino}: se reutiliza.`);
}

// ── 2. Comprobar antes de tocar nada ──────────────────────────────────
if (!DRY && !astroResoluble(destino)) {
  log('\n✖ La instalación terminó pero `astro` no se resuelve desde ahí.');
  log('  No se toca el enlace: la aplicación sigue como estaba.');
  process.exit(1);
}

// ── 3. Cambiar el enlace ──────────────────────────────────────────────
log(`\n# Apuntando node_modules → ${enlaceRelativo}`);
if (!DRY) {
  // `rm` de un enlace y `ln` son inmediatos: la ventana sin dependencias es de
  // milisegundos, no de la instalación entera.
  fs.rmSync(nodeModules, { force: true, recursive: antes.tipo === 'directorio' });
  fs.symlinkSync(enlaceRelativo, nodeModules, 'dir');
}

const despues = estadoDelEnlace();
log(`# node_modules ahora: ${despues.tipo} → ${despues.apunta ?? ''}`);

if (!DRY && !astroResoluble(raiz)) {
  log('\n✖ El enlace se cambió pero `astro` sigue sin resolverse desde la aplicación.');
  process.exit(1);
}

log(DRY ? '\n(--dry: no se escribió nada)' : '\n✓ Listo. Siguiente paso: el build desde cron.');
