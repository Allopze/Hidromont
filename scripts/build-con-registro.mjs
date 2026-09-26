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
 * **Compila a un directorio aparte y solo sustituye `dist` si termina bien.**
 * Astro vacía su directorio de salida antes de generar, así que un build que
 * falle a mitad deja el sitio sin páginas. Pasó en producción: un fallo al
 * lanzar un proceso dejó `dist` con lo copiado de `public/` y nada más, y la
 * web estuvo devolviendo 500 hasta restaurarla a mano. Con el ciclo
 * automático eso lo dispararía un editor pulsando «Publicar», sin saberlo.
 *
 * Uso:  npm run build:log            (build completo, con astro check)
 *       npm run build:log -- ligero  (sin astro check, para poca memoria)
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(raiz, '_build.log');
// El .env decide el perfil (PUBLIC_ENABLE_CMS). Astro lo lee por su cuenta,
// pero este script también necesita saberlo para compilar el perfil del
// editor aparte. `loadEnvFile` no pisa variables ya definidas: si lo lanza el
// CMS, manda lo que el proceso ya cargó.
const envFile = path.join(raiz, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile);
}
/**
 * P2-01 (auditoría 2026-09): el sitio público y el editor salían del mismo
 * build con PUBLIC_ENABLE_CMS=1, así que el HTML público llevaba la interfaz
 * del editor oculta con `hidden` (43 nodos «+ Agregar imagen», «solo la ve
 * quien edita…»), 8.463 atributos `data-cms-*` y el arranque del overlay.
 * Cuando el despliegue lleva editor se compilan dos perfiles: `dist/` limpio
 * para hidromontchile.cl y `dist-editor/` para editor.*; `cms/staticSite.ts`
 * elige por dominio.
 */
const DOS_PERFILES = process.env.PUBLIC_ENABLE_CMS === '1';
// El campo «Run JS script» de cPanel no pasa argumentos extra: el intento de
// `build:log -- ligero` acabó ejecutando `build` a secas. Por eso la variante
// también se puede pedir por variable de entorno, que es lo que usa el script
// `build:log:ligero`.
const LIGERO = process.argv.includes('ligero') || process.env.BUILD_LIGERO === '1';
const guion = LIGERO ? 'build:servidor' : 'build';

// Escritura síncrona, no un WriteStream. El flujo se vacía de forma
// asíncrona, así que una salida abrupta —un `throw`, un `process.exit`, el
// proceso matado por un límite del plan— dejaba el archivo vacío justo en los
// casos en que hace falta leerlo. Aquí el volumen es pequeño y la durabilidad
// vale más que el rendimiento.
fs.writeFileSync(destino, '');
const escribir = (texto) => {
  fs.appendFileSync(destino, texto);
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

/**
 * Dónde están de verdad `astro` y `tsx`.
 *
 * No se componen las rutas a mano. Se intentó —`<raiz>/node_modules/astro/
 * astro.js`— y desde cron no existe: ni siquiera FTP puede entrar ahí, aunque
 * sí lista el directorio padre, lo que apunta a que la sesión FTP, el proceso
 * de Passenger y el de cron no ven el mismo sistema de archivos (CageFS).
 *
 * El resolvedor de Node no tiene ese problema: encuentra el paquete por el
 * mismo camino que usaría un `import`, viva donde viva.
 */
const requerir = createRequire(path.join(raiz, 'package.json'));
/**
 * El ejecutable se lee del campo `bin` del propio paquete: Astro 7 lo movió de
 * `astro.js` a `bin/astro.mjs`, y con la ruta escrita aquí el build fallaba en
 * 0 s sin tocar nada. `relativo` queda como respaldo.
 */
function binarioDe(paquete, relativo) {
  try {
    const manifiesto = requerir.resolve(`${paquete}/package.json`);
    const { bin } = JSON.parse(fs.readFileSync(manifiesto, 'utf8'));
    const declarado = typeof bin === 'string' ? bin : bin?.[paquete];
    return path.join(path.dirname(manifiesto), declarado || relativo);
  } catch {
    return null;
  }
}

const ASTRO = binarioDe('astro', 'astro.js');
const TSX = binarioDe('tsx', 'dist/cli.mjs');

if (!ASTRO || !TSX) {
  // Diagnóstico, porque desde cron no hay forma de mirar a mano.
  escribir(`\n# No se pudo resolver ${!ASTRO ? 'astro' : 'tsx'} desde ${raiz}\n`);
  const nm = path.join(raiz, 'node_modules');
  try {
    const enlace = fs.lstatSync(nm).isSymbolicLink();
    escribir(`# node_modules: ${enlace ? `enlace → ${fs.readlinkSync(nm)}` : 'directorio'}\n`);
    escribir(`# ruta real: ${fs.realpathSync(nm)}\n`);
    const hay = fs.readdirSync(nm);
    escribir(
      `# contiene ${hay.length} entradas · ¿astro? ${hay.includes('astro') ? 'sí' : 'NO'}\n`
    );
  } catch (error) {
    escribir(`# no se pudo inspeccionar ${nm}: ${error.message}\n`);
  }
  escribir('# Si node_modules no es alcanzable desde cron, hay que instalar las\n');
  escribir('# dependencias en una ruta que sí lo sea, o compilar fuera del servidor.\n');
  process.exit(1);
}

escribir(`# astro: ${ASTRO}\n# tsx:   ${TSX}\n`);

/**
 * P2-05 (auditoría 2026-09): dos builds a la vez (un «Publicar» y un
 * `npm run deploy`, o dos publicaciones) compartían `dist.nuevo` y fallaban
 * sin motivo aparente (3 de 5 ensayos). El cerrojo del CMS solo ve su propio
 * proceso; este archivo lo comparten todos. Un cerrojo cuyo proceso ya no
 * existe (un build matado) se considera abandonado y se retoma.
 */
const CERROJO = path.join(raiz, '.build.lock');
function tomarCerrojo() {
  for (let intento = 0; intento < 2; intento += 1) {
    try {
      const fd = fs.openSync(CERROJO, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      process.on('exit', () => {
        try {
          if (fs.readFileSync(CERROJO, 'utf8') === String(process.pid)) fs.unlinkSync(CERROJO);
        } catch {
          // Ya no está: nada que soltar.
        }
      });
      return true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const pid = Number(fs.readFileSync(CERROJO, 'utf8'));
      let vivo = false;
      try {
        process.kill(pid, 0);
        vivo = Number.isInteger(pid) && pid > 0;
      } catch {
        vivo = false;
      }
      if (vivo) return false;
      fs.rmSync(CERROJO, { force: true });
    }
  }
  return false;
}
if (!tomarCerrojo()) {
  escribir('\n# Ya hay otro build en curso (ver .build.lock): este no se ejecuta.\n');
  escribir('# Espera a que termine y vuelve a intentarlo.\n');
  process.exit(1);
}

// Se compila aquí y solo al final se pone en su sitio.
const DIST = path.join(raiz, 'dist');
const NUEVO = path.join(raiz, 'dist.nuevo');
const VIEJO = path.join(raiz, 'dist.anterior');
const DIST_EDITOR = path.join(raiz, 'dist-editor');
const NUEVO_EDITOR = path.join(raiz, 'dist-editor.nuevo');
const VIEJO_EDITOR = path.join(raiz, 'dist-editor.anterior');
fs.rmSync(NUEVO, { recursive: true, force: true });
fs.rmSync(NUEVO_EDITOR, { recursive: true, force: true });

const perfil = (valor) => ({ PUBLIC_ENABLE_CMS: valor });
const pasos = [
  ...(LIGERO ? [] : [{ nombre: 'astro check', args: [ASTRO, 'check'] }]),
  {
    nombre: DOS_PERFILES ? 'astro build (sitio público)' : 'astro build',
    args: [ASTRO, 'build', '--outDir', NUEVO],
    env: DOS_PERFILES ? perfil('0') : {},
  },
  {
    nombre: 'sync-csp-headers',
    args: [TSX, path.join('scripts', 'sync-csp-headers.ts'), NUEVO],
  },
  ...(DOS_PERFILES
    ? [
        {
          nombre: 'astro build (editor)',
          args: [ASTRO, 'build', '--outDir', NUEVO_EDITOR],
          env: perfil('1'),
        },
        {
          nombre: 'sync-csp-headers (editor)',
          args: [TSX, path.join('scripts', 'sync-csp-headers.ts'), NUEVO_EDITOR],
        },
      ]
    : []),
];

/**
 * Ejecuta un paso volcando su salida al registro según llega.
 *
 * Antes se usaba `spawnSync`, que solo entrega la salida al terminar: cuando
 * el servidor mató `astro check` a media ejecución, el registro se quedó en
 * «→ astro check» y no hubo forma de saber dónde ni por qué. Con la salida en
 * vivo, lo que haya alcanzado a imprimir queda escrito.
 */
function ejecutar(paso) {
  return new Promise((resolver) => {
    const hijo = spawn(process.execPath, paso.args, {
      cwd: raiz,
      env: {
        ...process.env,
        // El servidor falló con `pthread_create: Resource temporarily
        // unavailable`: la cuenta tiene un tope de hilos que no aparece en
        // /proc/limits porque lo aplica LVE aparte. Acotar el grupo de hilos
        // de libuv reduce cuántos pide sharp al procesar imágenes.
        UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE ?? '2',
        ...(opciones ? { NODE_OPTIONS: opciones } : {}),
        // Vite da prioridad a las variables ya presentes sobre el .env.
        ...(paso.env ?? {}),
      },
    });
    hijo.stdout.on('data', (b) => escribir(b.toString()));
    hijo.stderr.on('data', (b) => escribir(b.toString()));
    hijo.on('close', (status, signal) => resolver({ status, signal }));
    hijo.on('error', (error) => resolver({ status: 1, signal: null, error }));
  });
}

let codigoFinal = 0;
for (const paso of pasos) {
  escribir(`\n# → ${paso.nombre}\n`);
  const res = await ejecutar(paso);
  if (res.error) {
    escribir(`\n# no se pudo lanzar ${paso.nombre}: ${res.error.message}\n`);
    codigoFinal = 1;
    break;
  }
  if (res.signal) {
    escribir(`\n# ${paso.nombre} matado por ${res.signal}.\n`);
    escribir('# Es un límite del plan, no un fallo de Astro. `astro check` es el paso\n');
    escribir('# más caro (907 MB medidos): pruebe con BUILD_LIGERO=1, que lo salta.\n');
    codigoFinal = 1;
    break;
  }
  if (res.status !== 0) {
    escribir(`\n# ${paso.nombre} terminó con código ${res.status}\n`);
    codigoFinal = res.status ?? 1;
    break;
  }
}

// ── Sustitución, solo si todo fue bien ────────────────────────────────
if (codigoFinal === 0) {
  const faltaIndex =
    !fs.existsSync(path.join(NUEVO, 'index.html')) ||
    (DOS_PERFILES && !fs.existsSync(path.join(NUEVO_EDITOR, 'index.html')));
  if (faltaIndex) {
    escribir('\n# El build dijo que sí pero no hay index.html: no se sustituye nada.\n');
    codigoFinal = 1;
    fs.rmSync(NUEVO, { recursive: true, force: true });
    fs.rmSync(NUEVO_EDITOR, { recursive: true, force: true });
  } else {
    // Dos renombrados dentro del mismo sistema de archivos: instantáneos. El
    // sitio no llega a quedarse sin páginas.
    const sustituir = (actual, nuevo, viejo) => {
      fs.rmSync(viejo, { recursive: true, force: true });
      if (fs.existsSync(actual)) fs.renameSync(actual, viejo);
      fs.renameSync(nuevo, actual);
      fs.rmSync(viejo, { recursive: true, force: true });
    };
    sustituir(DIST, NUEVO, VIEJO);
    if (DOS_PERFILES) {
      sustituir(DIST_EDITOR, NUEVO_EDITOR, VIEJO_EDITOR);
      escribir('\n# dist (sitio público) y dist-editor sustituidos.\n');
    } else {
      // Sin editor en este despliegue: un dist-editor viejo serviría una
      // versión desfasada en editor.*.
      fs.rmSync(DIST_EDITOR, { recursive: true, force: true });
      escribir('\n# dist sustituido.\n');
    }
  }
} else {
  escribir('\n# El build falló: dist NO se ha tocado, el sitio sigue como estaba.\n');
  fs.rmSync(NUEVO, { recursive: true, force: true });
  fs.rmSync(NUEVO_EDITOR, { recursive: true, force: true });
}

const seg = ((Date.now() - inicio) / 1000).toFixed(1);
escribir(`\n# terminó en ${seg} s · código ${codigoFinal}\n`);
process.exit(codigoFinal);
