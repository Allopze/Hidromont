/**
 * Reescribe el `script-src` de `dist/_headers` con los hashes reales de los
 * scripts inline que acaba de producir el build.
 *
 * Los hashes se mantenían a mano y se comprobó que ninguno de los dos
 * declarados correspondía a un script del build: como CSP nivel 3 ignora
 * `'unsafe-inline'` en cuanto hay un hash-source, los dos scripts inline del
 * sitio estaban bloqueados en producción y nada lo delataba. Además, el
 * conjunto cambia según el perfil del build (con o sin el overlay del CMS),
 * así que una lista fija no puede ser correcta para los dos.
 *
 * Corre como último paso de `npm run build`. Al servir desde Node el módulo
 * hace lo mismo en memoria; esto cubre a Cloudflare Pages y a Apache, que
 * leen el archivo.
 *
 * Uso: npx tsx scripts/sync-csp-headers.ts [directorio-dist]
 */
import fs from 'node:fs';
import path from 'node:path';
import { collectInlineScriptHashes } from '../cms/security/headers';

const distDir = process.argv[2] ?? 'dist';
const headersFile = path.join(distDir, '_headers');

if (!fs.existsSync(headersFile)) {
  process.stdout.write(`CSP: ${headersFile} no existe; nada que sincronizar.\n`);
  process.exit(0);
}

const hashes = collectInlineScriptHashes(distDir);
const original = fs.readFileSync(headersFile, 'utf8');

if (!/script-src [^;]+;/.test(original)) {
  process.stderr.write(`CSP: no se encontró una directiva script-src en ${headersFile}.\n`);
  process.exit(1);
}

const scriptSrc = ["'self'", ...hashes.map((h) => `'sha256-${h}'`)].join(' ');
const actualizado = original.replace(/script-src [^;]+;/, `script-src ${scriptSrc};`);

if (actualizado === original) {
  process.stdout.write(`CSP: ${hashes.length} hash(es), sin cambios.\n`);
} else {
  fs.writeFileSync(headersFile, actualizado);
  process.stdout.write(`CSP: ${hashes.length} hash(es) sincronizado(s) en ${headersFile}.\n`);
}
