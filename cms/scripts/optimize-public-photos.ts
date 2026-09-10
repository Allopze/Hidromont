/**
 * Convierte a WebP las fotos de `public/fotos` que aún son JPEG/PNG y aparta
 * las que ya no referencia nadie.
 *
 * A diferencia de `optimize-uploads`, estas SÍ las sirve el sitio a los
 * visitantes, así que el ahorro es doble: menos disco y menos descarga. Había
 * fotos de 1,8 MB sirviéndose tal cual, con anchos de hasta 4.160 px cuando el
 * sitio nunca muestra más de 1.600.
 *
 * Cambia la extensión, así que actualiza también todas las referencias:
 *   - `media_assets.path` y los campos de contenido de tipo `image`
 *   - los campos hermanos `*Width`/`*Height`, porque redimensionar cambia las
 *     dimensiones y `src/test/image-references.test.ts` comprueba que lo
 *     declarado coincida con el archivo
 *   - las rutas escritas a mano en `src/**` (project-images.ts y compañía)
 * Los `.md` y los JSON de `src/data` no se tocan aquí: los regenera el export.
 *
 * Nada se borra. Los archivos sustituidos y los huérfanos se mueven a
 * `public/_fotos-retiradas/`, que está fuera del despliegue.
 *
 * La lista de «qué usa el sitio» sale del **HTML ya compilado**, no de un
 * análisis del código. Se intentó lo segundo y era inseguro: las galerías de
 * proyecto construyen sus rutas con plantillas
 * (`/fotos/proyectos/${slug}/${archivo}`), así que 44 archivos en uso
 * aparecían como huérfanos. Por eso el script exige un `dist/` recién
 * construido y aborta si no lo encuentra.
 *
 * Idempotente. Uso: npm run build && npm run cms:optimize-fotos [-- --dry]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config/unifiedConfig';
import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { captureException, initErrorTracking } from '../utils/errorTracking';

initErrorTracking();

const DRY = process.argv.includes('--dry');
const SOLO_HUERFANOS = process.argv.includes('--solo-huerfanos');
const MAX_WIDTH = 1600;
const QUALITY = 82;

const root = config.rootDir;
const fotosDir = path.join(root, 'public', 'fotos');
// FUERA de public/: Astro copia public/ entero a dist/, así que dejar aquí
// los archivos retirados los devolvía al build y engordaba el despliegue en
// vez de adelgazarlo (medido: dist pasaba de 236 a 261 MB).
const retiradasDir = path.join(root, '_retirados', 'fotos');
const log = (m: string) => process.stdout.write(`${m}\n`);
const mb = (b: number) => (b / 1048576).toFixed(1);

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, acc);
    else if (!e.name.startsWith('.')) acc.push(f);
  }
  return acc;
}

const aRutaPublica = (abs: string) =>
  '/' + path.relative(path.join(root, 'public'), abs).split(path.sep).join('/');

/**
 * Todo el texto del árbol fuente. Se incluyen a propósito los .md y los JSON
 * que regenera el export: aunque se reescriban, son evidencia válida de que
 * una foto está en uso, y dejarlos fuera hacía que 92 archivos usados
 * salieran como huérfanos.
 */
function fuentesDeTexto(): string[] {
  const acc: string[] = [];
  const dir = path.join(root, 'src');
  if (!fs.existsSync(dir)) return acc;
  for (const f of walk(dir)) {
    if (/\.(astro|ts|js|json|md)$/i.test(f)) acc.push(f);
  }
  return acc;
}

async function main(): Promise<void> {
  migrate();
  const db = getDb();

  // ── Qué referencia el sitio ────────────────────────────────────────────
  const referenciadas = new Set<string>();
  // Una fila de media_assets ya es motivo suficiente para conservar el archivo,
  // aunque hoy ninguna página lo use: la biblioteca de medios es una curación
  // deliberada y el editor elige de ahí. Sin esta consulta la primera pasada de
  // este script se llevó 89 fotos de /fotos/curadas que no estaban en ninguna
  // página pero sí en la biblioteca, y el CMS quedó avisando en cada arranque
  // de 89 miniaturas rotas. Se recuperaron desde _retirados/.
  for (const r of db.prepare('SELECT path FROM media_assets').all() as Array<{ path: string }>) {
    referenciadas.add(r.path);
  }
  for (const r of db
    .prepare('SELECT m.path FROM gallery_items gi JOIN media_assets m ON m.id = gi.media_id')
    .all() as Array<{ path: string }>) {
    referenciadas.add(r.path);
  }
  for (const r of db
    .prepare("SELECT value_json FROM content_fields WHERE type = 'image'")
    .all() as Array<{ value_json: string }>) {
    try {
      const v = JSON.parse(r.value_json) as unknown;
      if (typeof v === 'string' && v) referenciadas.add(v);
    } catch {
      /* valor no parseable: se ignora */
    }
  }
  for (const contenido of fuentesDeTexto().map((f) => fs.readFileSync(f, 'utf8'))) {
    for (const m of contenido.matchAll(/\/fotos\/[A-Za-z0-9._/-]+\.(?:webp|jpe?g|png|svg)/g)) {
      referenciadas.add(m[0]);
    }
  }

  // Fuente de verdad: TODO el texto del build, no solo el HTML.
  //
  // Se intentó deducirlo del código y era inseguro por partida doble: las
  // galerías de proyecto arman sus rutas con plantillas
  // (`/fotos/proyectos/${slug}/${archivo}`), y un CSS o un JS pueden
  // referenciar una foto que ningún .astro nombra. Mirando solo el HTML,
  // 44 archivos en uso salían como huérfanos. Se compara por nombre de
  // archivo además de por ruta, para no depender de cómo quedó escrita.
  const distDir = config.cms.staticDir;
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(
      `No hay build en ${distDir}. Ejecute \`npm run build\` antes: sin él no se puede ` +
        'saber con seguridad qué fotos usa el sitio.'
    );
  }
  let textoDelBuild = '';
  (function recorrer(dir: string): void {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(f);
      else if (/\.(html|css|js|json|xml|txt|map)$/i.test(e.name)) {
        textoDelBuild += fs.readFileSync(f, 'utf8');
      }
    }
  })(distDir);

  const mencionados = new Set<string>();
  for (const ruta of referenciadas) mencionados.add(path.posix.basename(ruta));
  for (const contenido of [
    textoDelBuild,
    ...fuentesDeTexto().map((f) => fs.readFileSync(f, 'utf8')),
  ]) {
    for (const m of contenido.matchAll(/[A-Za-z0-9._-]+\.(?:webp|jpe?g|png|svg)/g)) {
      mencionados.add(m[0]);
    }
  }

  const archivos = walk(fotosDir);
  // Huérfano solo si su nombre no aparece en NINGUNA parte.
  const huerfanos = archivos.filter((f) => !mencionados.has(path.basename(f)));
  const enUso = (f: string) => mencionados.has(path.basename(f));
  const convertibles = SOLO_HUERFANOS
    ? []
    : archivos.filter((f) => enUso(f) && /\.(jpe?g|png)$/i.test(f));

  log(
    `public/fotos: ${archivos.length} archivo(s), ${mb(archivos.reduce((a, f) => a + fs.statSync(f).size, 0))} MB`
  );
  log(
    `  sin referencia: ${huerfanos.length} (${mb(huerfanos.reduce((a, f) => a + fs.statSync(f).size, 0))} MB)`
  );
  log(
    `  convertibles a WebP: ${convertibles.length} (${mb(convertibles.reduce((a, f) => a + fs.statSync(f).size, 0))} MB)`
  );

  // ── Conversión ─────────────────────────────────────────────────────────
  type Cambio = {
    viejoAbs: string;
    nuevoAbs: string;
    viejaRuta: string;
    nuevaRuta: string;
    buffer: Buffer;
    width: number;
    height: number;
  };
  const cambios: Cambio[] = [];
  const fallidos: string[] = [];

  for (const abs of convertibles) {
    try {
      const buffer = await sharp(abs)
        .rotate()
        .resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();
      const meta = await sharp(buffer).metadata();
      const nuevoAbs = abs.replace(/\.(jpe?g|png)$/i, '.webp');
      // Si ya existe un .webp con ese nombre, no lo pisamos.
      if (fs.existsSync(nuevoAbs)) {
        fallidos.push(`${aRutaPublica(abs)}: ya existe ${path.basename(nuevoAbs)}`);
        continue;
      }
      cambios.push({
        viejoAbs: abs,
        nuevoAbs,
        viejaRuta: aRutaPublica(abs),
        nuevaRuta: aRutaPublica(nuevoAbs),
        buffer,
        width: meta.width ?? 0,
        height: meta.height ?? 0,
      });
    } catch (error) {
      fallidos.push(
        `${aRutaPublica(abs)}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const antes = cambios.reduce((a, c) => a + fs.statSync(c.viejoAbs).size, 0);
  const despues = cambios.reduce((a, c) => a + c.buffer.length, 0);
  if (cambios.length > 0) {
    log(
      `\nConversión: ${mb(antes)} MB → ${mb(despues)} MB  (-${(100 - (despues / antes) * 100).toFixed(0)} %)`
    );
  }
  if (fallidos.length > 0) {
    log(`\n⚠ ${fallidos.length} archivo(s) no se convierten:`);
    fallidos.slice(0, 10).forEach((f) => log(`  - ${f}`));
  }

  if (DRY) {
    log('\n(--dry: no se escribió nada)');
    if (huerfanos.length > 0) {
      log('\nSin referencia (se apartarían):');
      huerfanos.slice(0, 60).forEach((f) => log(`  - ${aRutaPublica(f)}`));
      if (huerfanos.length > 60) log(`  … y ${huerfanos.length - 60} más`);
    }
    return;
  }

  // ── Escritura ──────────────────────────────────────────────────────────
  fs.mkdirSync(retiradasDir, { recursive: true });
  const apartar = (abs: string) => {
    const destino = path.join(retiradasDir, path.relative(fotosDir, abs));
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.renameSync(abs, destino);
  };

  for (const c of cambios) {
    fs.writeFileSync(c.nuevoAbs, c.buffer);
    apartar(c.viejoAbs);
  }
  for (const h of huerfanos) apartar(h);

  // ── Referencias en la base ─────────────────────────────────────────────
  const ahora = new Date().toISOString();
  const updateMedia = db.prepare(
    `UPDATE media_assets SET name = ?, path = ?, mime = 'image/webp', size = ?, width = ?, height = ?, checksum = ?, updated_at = ? WHERE path = ?`
  );
  const camposImagen = db.prepare(
    "SELECT entry_id, key, value_json FROM content_fields WHERE type = 'image'"
  );
  const updateCampo = db.prepare(
    'UPDATE content_fields SET value_json = ?, updated_at = ? WHERE entry_id = ? AND key = ?'
  );
  const updateDimension = db.prepare(
    'UPDATE content_fields SET value_json = ?, updated_at = ? WHERE entry_id = ? AND key = ?'
  );

  let filasMedia = 0;
  let filasCampo = 0;
  let filasDimension = 0;

  db.transaction(() => {
    for (const c of cambios) {
      const checksum = crypto.createHash('sha256').update(c.buffer).digest('hex');
      filasMedia += updateMedia.run(
        path.basename(c.nuevaRuta),
        c.nuevaRuta,
        c.buffer.length,
        c.width,
        c.height,
        checksum,
        ahora,
        c.viejaRuta
      ).changes;
    }

    const porRutaVieja = new Map(cambios.map((c) => [c.viejaRuta, c]));
    for (const fila of camposImagen.all() as Array<{
      entry_id: string;
      key: string;
      value_json: string;
    }>) {
      let valor: unknown;
      try {
        valor = JSON.parse(fila.value_json);
      } catch {
        continue;
      }
      if (typeof valor !== 'string') continue;
      const cambio = porRutaVieja.get(valor);
      if (!cambio) continue;

      filasCampo += updateCampo.run(
        JSON.stringify(cambio.nuevaRuta),
        ahora,
        fila.entry_id,
        fila.key
      ).changes;

      // Las dimensiones declaradas viven en campos hermanos, y el test de
      // referencias comprueba que coincidan con el archivo real.
      const sufijo = fila.key === 'image' ? '' : fila.key;
      for (const [suf, valorNuevo] of [
        [sufijo ? `${sufijo}Width` : 'imageWidth', cambio.width],
        [sufijo ? `${sufijo}Height` : 'imageHeight', cambio.height],
      ] as Array<[string, number]>) {
        filasDimension += updateDimension.run(
          JSON.stringify(valorNuevo),
          ahora,
          fila.entry_id,
          suf
        ).changes;
      }
    }
  })();

  // ── Referencias escritas a mano en src/ ────────────────────────────────
  let archivosTocados = 0;
  for (const file of fuentesDeTexto()) {
    const original = fs.readFileSync(file, 'utf8');
    let actualizado = original;
    for (const c of cambios) actualizado = actualizado.split(c.viejaRuta).join(c.nuevaRuta);
    if (actualizado !== original) {
      fs.writeFileSync(file, actualizado);
      archivosTocados += 1;
    }
  }

  log(`\nConvertidos: ${cambios.length} · apartados sin referencia: ${huerfanos.length}`);
  log(
    `Base: ${filasMedia} media, ${filasCampo} campo(s) de imagen, ${filasDimension} dimensión(es).`
  );
  log(`Código: ${archivosTocados} archivo(s) con rutas actualizadas.`);
  log(`Retirados en public/_fotos-retiradas/ (revisar y borrar cuando estés conforme).`);
  log('\nSiguiente paso: npm run cms:export && npm test');
}

main().catch((error) => {
  captureException(error, { action: 'cmsOptimizePublicPhotos' });
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
