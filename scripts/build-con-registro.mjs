#!/usr/bin/env node
/**
 * Ejecuta el build guardando toda su salida en `_build.log`.
 *
 * El botón «Run JS script» de cPanel no muestra lo que imprime el proceso:
 * ante un fallo enseña `[object Object]` y un código de salida, y el registro
 * de npm solo añade `verbose exit 1`. Con eso no se puede diagnosticar nada, y
 * sin SSH tampoco hay forma de ejecutarlo a mano y mirar.
 *
 * Así que la salida se escribe también en un archivo, que se puede traer por
 * FTP:
 *
 *   npm run deploy:ftp -- --traer /hidromont/_build.log
 *
 * Se conserva el código de salida original: el panel debe seguir enterándose
 * de que falló, y `CMS_PUBLISH_CHECK_COMMAND` depende de ello para no dar por
 * buena una publicación rota.
 *
 * No invoca `npm run build`, sino cada paso con la ruta absoluta de su
 * binario. Desde cron, `npm` sí arranca pero el script muere en
 * «sh: astro: command not found»: npm añade `node_modules/.bin` al PATH de sus
 * scripts, y aquí eso no ocurre porque `node_modules` es un enlace al
 * virtualenv de cPanel. Añadir ese directorio al PATH a mano tampoco bastó.
 * Llamar a `node <ruta>/astro.js` no depende del PATH en absoluto.
 *
 * El precio es duplicar la definición del build que vive en `package.json`.
 * Lo cubre `src/test/build-pasos.test.ts`, que compara ambas listas.
 *
 * Uso:  npm run build:log            (build completo, con astro check)
 *       npm run build:log -- ligero  (sin astro check, para poca memoria)
 */
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(raiz, '_build.log');
// El campo «Run JS script» de cPanel no pasa argumentos extra: el intento de
// `build:log -- ligero` acabó ejecutando `build` a secas. Por eso la variante
// también se puede pedir por variable de entorno, que es lo que usa el script
// `build:log:ligero`.
const LIGERO = process.argv.includes('ligero') || process.env.BUILD_LIGERO === '1';
const guion = LIGERO ? 'build:servidor' : 'build';

const salida = fs.createWriteStream(destino, { flags: 'w' });
const escribir = (texto) => {
  salida.write(texto);
  process.stdout.write(texto);
};

escribir(`# ${new Date().toISOString()} · npm run ${guion}\n`);
escribir(`# node ${process.version} · ${process.platform} ${process.arch}\n`);
// `freemem()` informa de la máquina entera, no del límite de la cuenta: en el
// servidor decía 41.906 MB mientras el build moría por falta de memoria.
// `constrainedMemory()` sí lee el límite del cgroup, que es el que manda en un
// hosting compartido con CloudLinux.
const limite = process.constrainedMemory?.();
escribir(`# memoria libre de la máquina: ${Math.round(os.freemem() / 1048576)} MB\n`);
escribir(
  `# límite de la cuenta (cgroup): ${limite ? `${Math.round(limite / 1048576)} MB` : 'no declarado'}\n`
);
escribir(
  `# disponible ahora: ${process.availableMemory ? `${Math.round(process.availableMemory() / 1048576)} MB` : 'desconocido'}\n`
);

// El compilador de Astro es Go compilado a WebAssembly, y su memoria lineal se
// reserva fuera del montón de JavaScript. Bajo un límite de espacio de
// direcciones, reservar menos montón deja sitio para que el Wasm quepa. Por
// eso la variante ligera prueba además con un montón acotado: el fallo
// observado fue `WebAssembly.instantiate(): Out of memory`, no un montón
// agotado.
const opciones = LIGERO ? '--max-old-space-size=512' : '';
if (opciones) escribir(`# NODE_OPTIONS=${opciones}\n`);
// Sonda: cuánta memoria de WebAssembly se puede reservar de verdad. Es el
// techo que importa, porque el compilador de Astro es Go compilado a Wasm y
// su memoria lineal vive fuera del montón de JavaScript. En este servidor
// `constrainedMemory()` no declara nada —CloudLinux no lo expone por cgroup—,
// así que se mide probando.
let techo = 0;
for (const mb of [16, 32, 64, 128, 256, 512, 1024, 2048]) {
  try {
    // Una página de Wasm son 64 KiB.
    new WebAssembly.Memory({ initial: (mb * 1024 * 1024) / 65536 });
    techo = mb;
  } catch {
    break;
  }
}
escribir(`# techo de memoria WebAssembly: ${techo ? `${techo} MB` : 'menos de 16 MB'}\n`);
escribir('\n');

const inicio = Date.now();

/** Los pasos del build, cada uno como argumentos para `node`. */
const ASTRO = path.join(raiz, 'node_modules', 'astro', 'astro.js');
const TSX = path.join(raiz, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const pasos = [
  ...(LIGERO ? [] : [{ nombre: 'astro check', args: [ASTRO, 'check'] }]),
  { nombre: 'astro build', args: [ASTRO, 'build'] },
  { nombre: 'sync-csp-headers', args: [TSX, path.join('scripts', 'sync-csp-headers.ts')] },
];

for (const ruta of [ASTRO, TSX]) {
  if (!fs.existsSync(ruta)) {
    escribir(`\n# No existe ${ruta}\n# ¿Se instalaron las dependencias? npm install\n`);
    salida.end(() => process.exit(1));
  }
}

let codigoFinal = 0;
for (const paso of pasos) {
  escribir(`\n# → ${paso.nombre}\n`);
  const res = spawnSync(process.execPath, paso.args, {
    cwd: raiz,
    encoding: 'utf8',
    env: opciones ? { ...process.env, NODE_OPTIONS: opciones } : process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.stdout) escribir(res.stdout);
  if (res.stderr) escribir(res.stderr);
  if (res.signal) {
    escribir(
      `\n# ${paso.nombre} matado por ${res.signal}: es un límite del plan, no un fallo de Astro.\n`
    );
    escribir('# Pruebe `build:log:ligero`, que se salta astro check.\n');
    codigoFinal = 1;
    break;
  }
  if (res.status !== 0) {
    escribir(`\n# ${paso.nombre} terminó con código ${res.status}\n`);
    codigoFinal = res.status ?? 1;
    break;
  }
}

const seg = ((Date.now() - inicio) / 1000).toFixed(1);
escribir(`\n# terminó en ${seg} s · código ${codigoFinal}\n`);
salida.end(() => process.exit(codigoFinal));
