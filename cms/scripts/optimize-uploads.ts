/**
 * Reduce los originales subidos por el CMS a lo que el sitio realmente sirve.
 *
 * `uploads/cms` pesaba 2,2 GB en 1.705 originales de cámara (mediana 2.048 px
 * de ancho, hasta 4.608) y ni uno solo estaba referenciado por el sitio: son
 * el archivo del que el editor elige en la biblioteca de medios. Pero el
 * sitio nunca sirve más de 1.600 px — `ImageService` genera derivados WebP a
 * 640/1024/1600 y sirve esos —, así que guardar el original a resolución
 * completa en el servidor no aporta nada y multiplica por ocho el espacio.
 *
 * Convierte cada imagen a WebP con un ancho máximo de 1.600 px, actualiza su
 * fila en `media_assets` (ruta, nombre, mime, tamaño, dimensiones, checksum)
 * y fusiona los duplicados exactos que aparezcan.
 *
 * Los originales NO se borran: se mueven a `uploads/_originales/`, que está
 * fuera de lo que se despliega. Archívalos donde corresponda y bórralos de
 * ahí cuando estés conforme con el resultado.
 *
 * Idempotente: un archivo ya convertido (.webp dentro del límite) se salta.
 *
 * Uso: npm run cms:optimize-uploads [-- --dry] [-- --max=1600]
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
const MAX_WIDTH = Number(process.argv.find((a) => a.startsWith('--max='))?.slice(6) ?? 1600);
const QUALITY = 80;
const MAX_INPUT_PIXELS = 50_000_000;

const uploadDir = config.cms.uploadDir;
const originalsDir = path.join(config.rootDir, 'uploads', '_originales');
const log = (msg: string) => process.stdout.write(`${msg}\n`);
const mb = (bytes: number) => (bytes / 1048576).toFixed(0);

async function main(): Promise<void> {
  migrate();
  const db = getDb();

  if (!fs.existsSync(uploadDir)) {
    log(`No existe ${uploadDir}; nada que optimizar.`);
    return;
  }

  const archivos = fs
    .readdirSync(uploadDir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name))
    .map((e) => e.name);

  const pesoAntes = archivos.reduce((a, n) => a + fs.statSync(path.join(uploadDir, n)).size, 0);
  log(
    `Origen: ${archivos.length} archivo(s), ${mb(pesoAntes)} MB. Ancho máximo objetivo: ${MAX_WIDTH} px.`
  );

  const findByPath = db.prepare('SELECT id FROM media_assets WHERE path = ?');
  const updateRow = db.prepare(
    `UPDATE media_assets
        SET name = ?, path = ?, mime = 'image/webp', size = ?, width = ?, height = ?,
            checksum = ?, updated_at = ?
      WHERE id = ?`
  );
  const deleteRow = db.prepare('DELETE FROM media_assets WHERE id = ?');

  type Pendiente = {
    nombreViejo: string;
    nombreNuevo: string;
    buffer: Buffer;
    width: number;
    height: number;
    checksum: string;
  };
  const pendientes: Pendiente[] = [];
  let saltados = 0;
  const fallidos: string[] = [];

  for (const nombre of archivos) {
    const src = path.join(uploadDir, nombre);
    try {
      const meta = await sharp(src, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
      const yaOptimo = meta.format === 'webp' && (meta.width ?? 0) <= MAX_WIDTH;
      if (yaOptimo) {
        saltados += 1;
        continue;
      }

      const buffer = await sharp(src, { limitInputPixels: MAX_INPUT_PIXELS })
        // `rotate()` sin argumentos aplica la orientación EXIF antes de
        // redimensionar: sin esto, las fotos verticales de móvil salen giradas.
        .rotate()
        .resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();
      const nuevaMeta = await sharp(buffer).metadata();

      pendientes.push({
        nombreViejo: nombre,
        nombreNuevo: `${path.basename(nombre, path.extname(nombre))}.webp`,
        buffer,
        width: nuevaMeta.width ?? 0,
        height: nuevaMeta.height ?? 0,
        checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
      });
    } catch (error) {
      fallidos.push(`${nombre}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const pesoDespues = pendientes.reduce((a, p) => a + p.buffer.length, 0);
  const pesoOriginalConvertido = pendientes.reduce(
    (a, p) => a + fs.statSync(path.join(uploadDir, p.nombreViejo)).size,
    0
  );

  log(
    `A convertir: ${pendientes.length} · ya óptimos: ${saltados} · ilegibles: ${fallidos.length}`
  );
  log(
    `  ${mb(pesoOriginalConvertido)} MB → ${mb(pesoDespues)} MB` +
      (pesoOriginalConvertido > 0
        ? `  (-${(100 - (pesoDespues / pesoOriginalConvertido) * 100).toFixed(0)} %)`
        : '')
  );

  if (fallidos.length > 0) {
    log(`\n⚠ ${fallidos.length} archivo(s) no se pudieron leer y se dejan intactos:`);
    fallidos.slice(0, 10).forEach((f) => log(`  - ${f}`));
  }

  if (DRY) {
    log('\n(--dry: no se escribió nada)');
    return;
  }

  fs.mkdirSync(originalsDir, { recursive: true });

  // Escribir primero, mover el original después: si algo falla a mitad, el
  // original sigue en su sitio y el script se puede repetir.
  let convertidos = 0;
  let fusionados = 0;
  const vistos = new Map<string, string>(); // checksum → ruta pública conservada

  for (const p of pendientes) {
    const destino = path.join(uploadDir, p.nombreNuevo);
    const rutaPublica = `${config.cms.publicUploadBase}/${p.nombreNuevo}`;
    const rutaVieja = `${config.cms.publicUploadBase}/${p.nombreViejo}`;
    const fila = findByPath.get(rutaVieja) as { id: string } | undefined;

    const duplicadoDe = vistos.get(p.checksum);
    if (duplicadoDe) {
      // Mismo contenido que otra imagen ya procesada: no se guarda dos veces.
      // Como ningún archivo de uploads está referenciado por el sitio, borrar
      // la fila sobrante no deja nada colgando.
      if (fila) {
        deleteRow.run(fila.id);
        fusionados += 1;
      }
      fs.renameSync(path.join(uploadDir, p.nombreViejo), path.join(originalsDir, p.nombreViejo));
      continue;
    }

    fs.writeFileSync(destino, p.buffer);
    vistos.set(p.checksum, rutaPublica);

    if (fila) {
      updateRow.run(
        p.nombreNuevo,
        rutaPublica,
        p.buffer.length,
        p.width,
        p.height,
        p.checksum,
        new Date().toISOString(),
        fila.id
      );
    }

    if (p.nombreViejo !== p.nombreNuevo) {
      fs.renameSync(path.join(uploadDir, p.nombreViejo), path.join(originalsDir, p.nombreViejo));
    }
    convertidos += 1;
  }

  const pesoFinal = fs
    .readdirSync(uploadDir)
    .filter((n) => fs.statSync(path.join(uploadDir, n)).isFile())
    .reduce((a, n) => a + fs.statSync(path.join(uploadDir, n)).size, 0);

  log(`\nConvertidos: ${convertidos} · duplicados fusionados: ${fusionados}`);
  log(`uploads/cms: ${mb(pesoAntes)} MB → ${mb(pesoFinal)} MB`);
  log(`Originales apartados en uploads/_originales/ (${mb(pesoOriginalConvertido)} MB).`);
  log('  NO se despliegan. Archívalos donde corresponda y bórralos cuando estés conforme.');
  log('\nSiguiente paso: npm run cms:export');
}

main().catch((error) => {
  captureException(error, { action: 'cmsOptimizeUploads' });
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
