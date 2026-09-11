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
const guion = process.argv.includes('ligero') ? 'build:servidor' : 'build';

const salida = fs.createWriteStream(destino, { flags: 'w' });
const escribir = (texto) => {
  salida.write(texto);
  process.stdout.write(texto);
};

escribir(`# ${new Date().toISOString()} · npm run ${guion}\n`);
escribir(`# node ${process.version} · ${process.platform} ${process.arch}\n`);
escribir(`# memoria libre del sistema: ${Math.round(os.freemem() / 1048576)} MB\n\n`);

const inicio = Date.now();
const hijo = spawn('npm', ['run', guion], { cwd: raiz, shell: false });

hijo.stdout.on('data', (b) => escribir(b.toString()));
hijo.stderr.on('data', (b) => escribir(b.toString()));

hijo.on('close', (codigo, senal) => {
  const seg = ((Date.now() - inicio) / 1000).toFixed(1);
  escribir(`\n# terminó en ${seg} s · código ${codigo}${senal ? ` · señal ${senal}` : ''}\n`);
  // Una señal en vez de un código es la firma de un proceso matado por el
  // límite de memoria o de tiempo del hosting, no de un error del build.
  if (senal) {
    escribir(`# matado por ${senal}: casi seguro un límite del plan, no un fallo de Astro.\n`);
    escribir('# Pruebe `npm run build:log -- ligero`, que se salta astro check (907 MB).\n');
  }
  salida.end(() => process.exit(codigo ?? 1));
});

hijo.on('error', (error) => {
  escribir(`\n# no se pudo lanzar npm: ${error.message}\n`);
  salida.end(() => process.exit(1));
});
