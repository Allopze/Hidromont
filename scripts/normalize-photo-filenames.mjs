/**
 * GAL-9 — Normaliza nombres de archivo de fotos a kebab-case ASCII.
 *
 * 17 archivos bajo public/fotos/proyectos/ tenían espacios, acentos y paréntesis
 * ("Tratamiento de Superficies Tubería Lican ().webp"). Además de ensuciar las
 * URLs con %20/%CC%81, los espacios rompen el atributo `srcset`: su gramática
 * separa URL y descriptor por espacios, así que el navegador descartaba el
 * candidato entero y ninguna de esas fotos tenía variantes responsive.
 *
 * Renombra en disco y actualiza en la misma pasada las rutas registradas en
 * media_assets. El gallery.json lo regenera despues `npm run cms:export`.
 *
 * Idempotente: un archivo ya normalizado no se toca.
 *
 * Uso: node scripts/normalize-photo-filenames.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const ROOT = process.cwd();
const PHOTO_ROOT = path.join(ROOT, 'public', 'fotos');

const DB_PATH = path.join(ROOT, 'cms', 'data', 'hidromont-cms.sqlite');
const DRY = process.argv.includes('--dry');

// Caracteres que una URL puede llevar sin percent-encoding y que `srcset`
// tolera. Los puntos entran: "foto-15.25.45.jpeg" es perfectamente válido y
// renombrarlo sería ruido sin beneficio.
const SAFE_CHARS = /^[A-Za-z0-9._-]+$/;

/** "Bifurcación    C. H. Trueno ().webp" → "bifurcacion-c-h-trueno.webp" */
function normalizeBasename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const stem = filename.slice(0, filename.length - path.extname(filename).length);
  const slug = stem
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos
    .replace(/[^A-Za-z0-9]+/g, '-') // espacios, paréntesis, puntos → guion
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${slug || 'foto'}${ext}`;
}

/**
 * Solo se tocan los nombres que rompen algo: espacios (invalidan el candidato
 * en `srcset`, cuya gramática los usa como separador) o caracteres fuera del
 * juego seguro (obligan a percent-encoding: %20, %CC%81…). Mayúsculas, puntos
 * y guiones bajos se dejan como están.
 */
function needsNormalizing(filename) {
  return /\s/.test(filename) || !SAFE_CHARS.test(filename);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(webp|jpe?g|png)$/i.test(entry)) out.push(full);
  }
  return out;
}

const renames = []; // { fromUrl, toUrl, fromAbs, toAbs }
// Destinos ya comprometidos en esta pasada. Sin esto, dos archivos que
// normalizan al mismo nombre ("… Lican ().webp" y "… Lican.webp") se pisarían:
// fs.existsSync() no ve un renombrado que todavía no se ejecutó.
const claimed = new Set();

for (const abs of walk(PHOTO_ROOT)) {
  const base = path.basename(abs);
  if (!needsNormalizing(base)) continue;

  const dir = path.dirname(abs);
  const normalized = normalizeBasename(base);
  const ext = path.extname(normalized);
  const stem = normalized.slice(0, -ext.length);

  let target = normalized;
  let n = 1;
  const taken = (candidate) => {
    const full = path.join(dir, candidate);
    if (claimed.has(full)) return true;
    return fs.existsSync(full) && full !== abs;
  };
  while (taken(target)) target = `${stem}-${++n}${ext}`;
  claimed.add(path.join(dir, target));

  renames.push({
    fromAbs: abs,
    toAbs: path.join(dir, target),
    fromUrl: '/' + path.relative(path.join(ROOT, 'public'), abs).split(path.sep).join('/'),
    toUrl:
      '/' +
      path.relative(path.join(ROOT, 'public'), path.join(dir, target)).split(path.sep).join('/'),
  });
}

if (renames.length === 0) {
  process.stdout.write('Nada que normalizar: todos los nombres ya son limpios.\n');
  process.exit(0);
}

process.stdout.write(`${renames.length} archivo(s) a renombrar:\n`);
for (const r of renames) process.stdout.write(`  ${r.fromUrl}\n    → ${r.toUrl}\n`);

if (DRY) {
  process.stdout.write('\n(--dry: no se escribió nada)\n');
  process.exit(0);
}

// 1. Disco
for (const r of renames) fs.renameSync(r.fromAbs, r.toAbs);

// 2. media_assets.path + name
//
// GAL-6: no se toca src/data/gallery.json. Ese archivo lo regenera
// `npm run cms:export` desde SQLite; escribirlo aquí crearía una segunda
// fuente de verdad. Basta con corregir el path del media y exportar.
if (fs.existsSync(DB_PATH)) {
  const db = new Database(DB_PATH);
  const update = db.prepare('UPDATE media_assets SET path = ?, name = ?, updated_at = ? WHERE path = ?');
  const now = new Date().toISOString();
  let touched = 0;
  const tx = db.transaction(() => {
    for (const r of renames) {
      touched += update.run(r.toUrl, path.basename(r.toAbs), now, r.fromUrl).changes;
    }
  });
  tx();
  db.close();
  process.stdout.write(`media_assets: ${touched} fila(s) actualizada(s).\n`);
}

process.stdout.write('\nListo.\n');
