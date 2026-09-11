#!/usr/bin/env node
/**
 * Averigua si el compilador de Astro puede arrancar en este servidor y con qué
 * opciones.
 *
 * El build muere con `WebAssembly.instantiate(): Out of memory` y la sonda de
 * memoria dice que no se pueden reservar ni 16 MB de WebAssembly, mientras la
 * máquina informa de 40 GB libres. Esa contradicción tiene una explicación
 * conocida: V8, cuando usa el manejador de trampas para las comprobaciones de
 * límites, reserva por cada memoria de Wasm una región de guarda enorme de
 * *espacio de direcciones* —no de memoria física—. En un hosting que limita el
 * espacio de direcciones (`ulimit -v`, habitual en CloudLinux), esa reserva
 * falla aunque sobre RAM.
 *
 * V8 tiene una salida: `--wasm-enforce-bounds-checks` obliga a comprobar los
 * límites explícitamente y deja de necesitar las regiones de guarda. El precio
 * es algo de rendimiento, irrelevante para un build. No se puede poner en
 * NODE_OPTIONS —Node lo rechaza—, así que va en la línea de órdenes.
 *
 * Esta sonda prueba varias combinaciones contra el `astro.wasm` de verdad, no
 * contra una reserva sintética: lo que importa es si el compilador arranca.
 *
 * Uso:  npm run probar:wasm
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// El informe se escribe desde aquí, con ruta absoluta, en vez de por
// redirección del shell: el primer intento en el servidor terminó con SIGABRT
// y no dejó ningún archivo, probablemente porque la redirección dependía del
// directorio de trabajo o de cómo invoca el panel al script.
const informe = path.join(raiz, '_wasm.log');
fs.writeFileSync(informe, '');
const log = (m) => {
  fs.appendFileSync(informe, `${m}\n`);
  process.stdout.write(`${m}\n`);
};

/**
 * Compila un fragmento .astro mínimo: fuerza la instanciación del Wasm.
 *
 * Se escribe a un archivo dentro del proyecto en vez de pasarse con `node -e`.
 * Con `-e` el módulo padre es `[eval1]` y desde cron no resuelve
 * `@astrojs/compiler`, porque aquí `node_modules` es un enlace al virtualenv
 * de cPanel y la resolución solo funcionaba gracias al NODE_PATH que activa el
 * panel. Un archivo real resuelve por el camino normal, venga de donde venga.
 */
const PRUEBA = `
  const { transform } = await import('@astrojs/compiler');
  const r = await transform('<h1>hola</h1>', { filename: 'p.astro' });
  if (!r.code) throw new Error('sin salida');
  console.log('OK');
`;

const CANDIDATOS = [
  { nombre: 'sin opciones (lo que hace el build hoy)', flags: [] },
  { nombre: 'montón acotado', flags: ['--max-old-space-size=256'] },
  { nombre: 'sin manejador de trampas', flags: ['--wasm-enforce-bounds-checks'] },
  {
    nombre: 'sin manejador de trampas + montón acotado',
    flags: ['--wasm-enforce-bounds-checks', '--max-old-space-size=256'],
  },
  {
    nombre: 'sin trampas + montón acotado + código wasm mínimo',
    flags: [
      '--wasm-enforce-bounds-checks',
      '--max-old-space-size=256',
      '--wasm-max-initial-code-space-reservation=1',
    ],
  },
];

log(`node ${process.version} · ${process.platform} ${process.arch}`);
log(`memoria de la máquina: ${Math.round(os.totalmem() / 1048576)} MB`);
const limite = process.constrainedMemory?.();
log(`límite declarado por cgroup: ${limite ? `${Math.round(limite / 1048576)} MB` : 'ninguno'}`);
log('');

const guionHijo = path.join(raiz, 'scripts', '.probar-wasm-hijo.mjs');
fs.writeFileSync(guionHijo, PRUEBA);

let ganadora = null;
for (const candidato of CANDIDATOS) {
  const res = spawnSync(process.execPath, [...candidato.flags, guionHijo], {
    cwd: raiz,
    encoding: 'utf8',
    timeout: 60_000,
    // Node y npm viven en el mismo directorio; desde cron el PATH no los trae.
    env: { ...process.env, PATH: `${path.dirname(process.execPath)}:${process.env.PATH ?? ''}` },
  });
  const ok = res.status === 0 && (res.stdout ?? '').includes('OK');
  log(`${ok ? '✓' : '✗'} ${candidato.nombre}`);
  if (!ok) {
    const motivo = `${res.stderr ?? ''}`
      .split('\n')
      .find((l) => /Error|error/.test(l))
      ?.trim();
    if (motivo) log(`    ${motivo.slice(0, 120)}`);
  }
  if (ok && !ganadora) ganadora = candidato;
}

fs.rmSync(guionHijo, { force: true });

log('');
if (ganadora) {
  log(`Funciona con: ${ganadora.flags.join(' ') || '(sin opciones)'}`);
  log('El servidor SÍ puede compilar. Siguiente paso: npm run build:servidor con esas');
  log('opciones, que es lo que hará `build:log:ligero` en cuanto se le pasen.');
} else {
  log('Ninguna combinación permite arrancar el compilador de Astro.');
  log('El límite no se puede sortear desde el código: o el proveedor amplía el');
  log('espacio de direcciones de la cuenta, o el sitio se compila fuera del servidor.');
}
