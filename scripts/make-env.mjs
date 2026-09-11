#!/usr/bin/env node
/**
 * Escribe el `.env` de producción en `_deploy/`, listo para subir.
 *
 * Se hace con un script y no a mano porque el archivo tiene veintitantas
 * claves y varias fallan en silencio: un `CMS_ALLOWED_ORIGINS` mal escrito no
 * rompe el arranque, solo hace que el panel rechace cada petición del dominio
 * real sin decir por qué. Escribirlo en el editor del gestor de archivos de
 * cPanel, sin autocompletado ni revisión, es el paso más fácil de estropear de
 * todo el despliegue.
 *
 * Parte de `.env.production.example`, que es la plantilla mantenida, y solo
 * rellena lo que falta: el correo del administrador y una contraseña nueva.
 *
 * La contraseña se genera aquí y **no se imprime**: queda escrita en
 * `_deploy/.env`, que está fuera del control de versiones. Ábrelo para
 * copiarla a tu gestor de contraseñas. Así no pasa por el historial de la
 * terminal ni por ninguna conversación.
 *
 * Uso:
 *   npm run env:produccion -- --correo tu@correo.cl
 *   npm run env:produccion -- --correo tu@correo.cl --rehacer   (nueva contraseña)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(raiz, '_deploy', '.env');
const log = (m) => process.stdout.write(`${m}\n`);

function argumento(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

/**
 * Contraseña de 24 caracteres de un alfabeto sin ambigüedades visuales: se va
 * a teclear alguna vez a mano desde un móvil o leer de un papel, y confundir
 * un 1 con una l ahí cuesta un rato de desconcierto.
 */
function generarContrasena() {
  const alfabeto = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(24);
  // Rechazo por módulo: se descartan los bytes que caerían fuera del último
  // múltiplo completo del alfabeto, para no sesgar hacia las primeras letras.
  const limite = 256 - (256 % alfabeto.length);
  let salida = '';
  let i = 0;
  let pool = bytes;
  while (salida.length < 24) {
    if (i >= pool.length) {
      pool = crypto.randomBytes(24);
      i = 0;
    }
    const b = pool[i++];
    if (b < limite) salida += alfabeto[b % alfabeto.length];
  }
  return salida;
}

function main() {
  const REHACER = process.argv.includes('--rehacer');
  if (fs.existsSync(destino) && !REHACER) {
    log(`Ya existe _deploy/.env. No se toca, para no cambiar la contraseña sin querer.`);
    log('  Para generar uno nuevo: npm run env:produccion -- --correo tu@correo.cl --rehacer');
    return;
  }

  const correo = argumento('correo');
  if (!correo || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    throw new Error(
      'Indique el correo del administrador:\n' + '  npm run env:produccion -- --correo tu@correo.cl'
    );
  }

  const plantilla = path.join(raiz, '.env.production.example');
  if (!fs.existsSync(plantilla)) throw new Error('Falta .env.production.example');

  let contenido = fs.readFileSync(plantilla, 'utf8');
  const contrasena = generarContrasena();

  contenido = contenido
    .replace(/^CMS_ADMIN_EMAIL=.*$/m, `CMS_ADMIN_EMAIL=${correo}`)
    .replace(/^CMS_ADMIN_PASSWORD=.*$/m, `CMS_ADMIN_PASSWORD=${contrasena}`);

  // Que no quede ningún marcador de la plantilla sin sustituir: un `<...>` en
  // el servidor es una clave que no significa nada y que solo se descubre
  // cuando algo falla.
  const pendientes = contenido
    .split('\n')
    .filter((l) => /^[A-Z_]+=.*<.*>/.test(l))
    .map((l) => l.split('=')[0]);
  if (pendientes.length) {
    throw new Error(`Quedan marcadores sin rellenar en la plantilla: ${pendientes.join(', ')}`);
  }

  fs.mkdirSync(path.dirname(destino), { recursive: true });
  // 0600: solo el dueño. El archivo lleva la contraseña de administración.
  fs.writeFileSync(destino, contenido, { mode: 0o600 });

  const claves = contenido.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).length;
  log(`Escrito _deploy/.env · ${claves} claves · permisos 0600`);
  log(`  administrador: ${correo}`);
  log('  contraseña: generada, 24 caracteres. NO se imprime aquí a propósito.');
  log('    Ábrelo para copiarla a tu gestor de contraseñas:');
  log('    open -e _deploy/.env');
  log('\nPara subirlo:  npm run deploy:ftp -- --env');
}

try {
  main();
} catch (error) {
  process.stderr.write(`\n✖ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
