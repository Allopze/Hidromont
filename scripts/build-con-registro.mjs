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
 * Uso:  npm run build:log            (build completo, con astro check)
 *       npm run build:log -- ligero  (sin astro check, para poca memoria)
 */
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(raiz, '_build.log');
const LIGERO = process.argv.includes('ligero');
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
escribir('\n');

const inicio = Date.now();
const hijo = spawn('npm', ['run', guion], {
  cwd: raiz,
  shell: false,
  env: opciones ? { ...process.env, NODE_OPTIONS: opciones } : process.env,
});

hijo.stdout.on('data', (b) => escribir(b.toString()));
hijo.stderr.on('data', (b) => escribir(b.toString()));

hijo.on('close', (codigo, senal) => {
  const seg = ((Date.now() - inicio) / 1000).toFixed(1);
  escribir(`\n# terminó en ${seg} s · código ${codigo}${senal ? ` · señal ${senal}` : ''}\n`);
  // Una señal en vez de un código es la firma de un proceso matado por el
  // límite de memoria o de tiempo del hosting, no de un error del build.
  if (senal) {
    escribir(`# matado por ${senal}: casi seguro un límite del plan, no un fallo de Astro.\n`);
    escribir('# Pruebe `npm run build:log -- ligero`, que acota el montón de JS.\n');
  }
  salida.end(() => process.exit(codigo ?? 1));
});

hijo.on('error', (error) => {
  escribir(`\n# no se pudo lanzar npm: ${error.message}\n`);
  salida.end(() => process.exit(1));
});
