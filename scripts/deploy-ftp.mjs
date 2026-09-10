#!/usr/bin/env node
/**
 * Sube los paquetes de `npm run pack:deploy` al servidor por FTP.
 *
 * Las credenciales se leen de `.env.deploy`, que está fuera del control de
 * versiones. Nunca se pasan por la línea de órdenes: los argumentos de un
 * proceso son visibles para cualquier usuario de la máquina con `ps`, así que
 * viajan a `curl` por su archivo de configuración, en la entrada estándar.
 *
 * Lo que este script NO hace, porque FTP no puede: descomprimir en el
 * servidor, instalar dependencias ni reiniciar la aplicación. Eso sigue siendo
 * manual desde cPanel. Con acceso SSH sí se podría automatizar entero.
 *
 * Uso:
 *   npm run deploy:ftp -- --dry     ensayo: dice qué haría, sin conectarse
 *   npm run deploy:ftp              sube el paquete de aplicación
 *   npm run deploy:ftp -- --datos   sube además la base y la biblioteca
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const CON_DATOS = process.argv.includes('--datos');
const log = (m) => process.stdout.write(`${m}\n`);
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;

function credenciales() {
  const archivo = path.join(raiz, '.env.deploy');
  if (!fs.existsSync(archivo)) {
    throw new Error(
      'Falta .env.deploy. Cópielo de .env.deploy.example y rellene sus datos.\n' +
        '  Ese archivo está en .gitignore: la contraseña no debe entrar al repositorio.'
    );
  }
  // Se lee a mano en vez de con loadEnvFile para no dejar la contraseña en
  // process.env, donde acabaría heredada por cualquier proceso hijo.
  const env = {};
  for (const linea of fs.readFileSync(archivo, 'utf8').split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const i = limpia.indexOf('=');
    if (i > 0) env[limpia.slice(0, i).trim()] = limpia.slice(i + 1).trim();
  }

  const faltan = ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD', 'FTP_DIR'].filter((k) => !env[k]);
  if (faltan.length) throw new Error(`Faltan en .env.deploy: ${faltan.join(', ')}`);

  const protocolo = (env.FTP_PROTOCOL || 'ftps').toLowerCase();
  if (!['ftp', 'ftps'].includes(protocolo)) {
    throw new Error(`FTP_PROTOCOL debe ser ftps o ftp, no "${protocolo}"`);
  }

  // El directorio destino se normaliza y se comprueba: subir a la raíz de la
  // cuenta esparciría el contenido del zip por encima de todo lo demás.
  const dir = `/${env.FTP_DIR.replace(/^\/+|\/+$/g, '')}`;
  if (dir === '/') {
    throw new Error(
      'FTP_DIR apunta a la raíz de la cuenta. Indique la carpeta de la aplicación, p. ej. /hidromont'
    );
  }
  return { ...env, protocolo, dir };
}

/**
 * Ejecuta curl con la configuración por stdin, para que ni la contraseña ni la
 * URL con credenciales aparezcan en la lista de procesos.
 */
function curl(cred, lineas) {
  const config = [
    `user = "${cred.FTP_USER}:${cred.FTP_PASSWORD}"`,
    // En FTPS explícito curl negocia TLS con AUTH TLS sobre el puerto de FTP.
    ...(cred.protocolo === 'ftps' ? ['ssl-reqd'] : []),
    'silent',
    'show-error',
    ...lineas,
  ].join('\n');

  return execFileSync('curl', ['--config', '-'], {
    input: `${config}\n`,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

/** Lista el directorio remoto: sirve de prueba de conexión y de verificación. */
function listar(cred) {
  const salida = curl(cred, [
    `url = "${cred.protocolo}://${cred.FTP_HOST}${cred.dir}/"`,
    'list-only',
  ]);
  return salida.split('\n').filter(Boolean);
}

function subir(cred, archivoLocal) {
  const nombre = path.basename(archivoLocal);
  const destino = `${cred.protocolo}://${cred.FTP_HOST}${cred.dir}/${nombre}`;
  execFileSync('curl', ['--config', '-', '--upload-file', archivoLocal, '--progress-bar'], {
    input:
      [
        `user = "${cred.FTP_USER}:${cred.FTP_PASSWORD}"`,
        ...(cred.protocolo === 'ftps' ? ['ssl-reqd'] : []),
        'show-error',
        'fail',
        `url = "${destino}"`,
      ].join('\n') + '\n',
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

function main() {
  const paquetes = [
    { archivo: path.join(raiz, '_deploy', 'hidromont-app.zip'), nombre: 'aplicación' },
  ];
  if (CON_DATOS) {
    paquetes.push({ archivo: path.join(raiz, '_deploy', 'hidromont-datos.zip'), nombre: 'datos' });
  }

  for (const p of paquetes) {
    if (!fs.existsSync(p.archivo)) {
      throw new Error(`No existe ${path.relative(raiz, p.archivo)}. Ejecute npm run pack:deploy.`);
    }
  }

  if (CON_DATOS) {
    log('⚠ Va a subir el paquete de DATOS.');
    log('  Eso sobrescribe la base de datos y la biblioteca del servidor con las');
    log('  copias locales: se pierde todo lo editado en producción desde la última');
    log('  bajada. Solo tiene sentido en el primer despliegue.\n');
  }

  const cred = credenciales();
  log(`Destino: ${cred.protocolo}://${cred.FTP_HOST}${cred.dir}`);
  if (cred.protocolo === 'ftp') {
    log('⚠ FTP sin cifrar: la contraseña y los archivos viajan en claro.');
    log('  Ponga FTP_PROTOCOL=ftps en .env.deploy si el servidor lo admite.');
  }
  for (const p of paquetes) {
    log(`  ${p.nombre}: ${path.basename(p.archivo)} · ${mb(fs.statSync(p.archivo).size)}`);
  }

  if (DRY) {
    log('\n(--dry: no se conectó ni se subió nada)');
    return;
  }

  log('\nComprobando la conexión...');
  const antes = listar(cred);
  log(`  conectado · ${antes.length} entradas en el directorio`);

  for (const p of paquetes) {
    log(`\nSubiendo ${path.basename(p.archivo)}...`);
    subir(cred, p.archivo);
  }

  // Verificación: que el archivo esté de verdad allí, no que curl no protestara.
  const despues = listar(cred);
  const faltantes = paquetes
    .map((p) => path.basename(p.archivo))
    .filter((n) => !despues.includes(n));
  if (faltantes.length) {
    throw new Error(`Subida terminada pero no aparecen en el servidor: ${faltantes.join(', ')}`);
  }
  log(`\n✓ Verificado: ${paquetes.length} archivo(s) presentes en el servidor.`);

  log('\nFalta el paso que FTP no puede hacer, desde cPanel:');
  log('  1. Gestor de archivos → seleccionar el zip → Extract');
  log('  2. Pantalla de la aplicación Node → Run NPM Install');
  log('  3. Run JS script → build');
  log('  4. Restart');
}

try {
  main();
} catch (error) {
  // Un operador no necesita la traza: necesita saber qué arreglar. El detalle
  // técnico de curl ya salió por stderr cuando lo hubo.
  process.stderr.write(`\n✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
