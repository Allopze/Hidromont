import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PROJECT_ROOT = process.cwd();
const ORIGINALS_ROOT = path.join(PROJECT_ROOT, 'assets', 'originales');

// Destination base directory for optimized web photos
const DEST_BASE = path.join(PROJECT_ROOT, 'public', 'fotos', 'proyectos');

// Configuration for project curation
const CURATION_CONFIG = [
  {
    name: 'C.H. Pangal (Helicóptero y Montaje Aéreo)',
    slug: 'ch-pangal',
    prefix: 'ch-pangal',
    sources: [
      { dir: path.join(ORIGINALS_ROOT, 'Pangal', 'Helicóptero'), tag: 'helicoptero', max: 10 },
      { dir: path.join(ORIGINALS_ROOT, 'Pangal'), tag: 'terreno', max: 15 },
      { dir: path.join(ORIGINALS_ROOT, 'Pangal', 'Whatsapp'), tag: 'obra', max: 10 }
    ]
  },
  {
    name: 'C.H. Canal Chacayes',
    slug: 'ch-chacayes',
    prefix: 'ch-chacayes',
    sources: [
      { dir: path.join(ORIGINALS_ROOT, 'Canal Chacayes', '1'), tag: 'fase1', max: 6 },
      { dir: path.join(ORIGINALS_ROOT, 'Canal Chacayes', '2'), tag: 'fase2', max: 6 },
      { dir: path.join(ORIGINALS_ROOT, 'Canal Chacayes', '3'), tag: 'fase3', max: 15 },
      { dir: path.join(ORIGINALS_ROOT, 'Canal Chacayes', '4'), tag: 'fase4', max: 5 }
    ]
  },
  {
    name: 'Fotos Curadas WhatsApp (Terreno / Galería)',
    slug: 'curadas-whatsapp',
    prefix: 'terreno-hidromont',
    sources: [
      { dir: path.join(PROJECT_ROOT, 'public', 'fotos', 'curadas'), filter: (f) => f.startsWith('whatsapp-image-'), tag: 'whatsapp', max: 25 }
    ]
  }
];

async function isGoodImage(filePath) {
  try {
    const meta = await sharp(filePath).metadata();
    if (!meta.width || !meta.height) return false;
    // Filter out low resolution images (smaller than 800x600)
    if (meta.width < 800 || meta.height < 600) return false;
    return meta;
  } catch (err) {
    return false;
  }
}

async function processImage(srcPath, destPath) {
  const meta = await sharp(srcPath).metadata();
  const pipeline = sharp(srcPath);

  // Resize if larger than 1920px wide or 1200px tall
  if (meta.width > 1920 || meta.height > 1200) {
    pipeline.resize({
      width: 1920,
      height: 1200,
      fit: 'inside',
      withoutEnlargement: true
    });
  }

  // Convert to WebP with 82 quality
  await pipeline
    .webp({ quality: 82, effort: 4 })
    .toFile(destPath);

  const origSize = fs.statSync(srcPath).size;
  const newSize = fs.statSync(destPath).size;
  return { origSize, newSize };
}

async function run() {
  console.log('🚀 Iniciando curaduría y optimización de imágenes para Hidromont Chile...\n');

  let totalOrigBytes = 0;
  let totalOptBytes = 0;
  let totalImagesProcessed = 0;

  for (const config of CURATION_CONFIG) {
    const targetDir = path.join(DEST_BASE, config.slug);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    console.log(`📸 PROCESANDO: ${config.name}`);
    console.log(`📁 Carpeta destino: ${path.relative(PROJECT_ROOT, targetDir)}`);

    let projectProcessed = 0;

    for (const source of config.sources) {
      if (!fs.existsSync(source.dir)) {
        console.log(`⚠️  Directorio no encontrado: ${source.dir}`);
        continue;
      }

      const files = fs.readdirSync(source.dir).filter((f) => {
        if (f.startsWith('.')) return false;
        if (source.filter) return source.filter(f);
        return /\.(jpg|jpeg|png|webp)$/i.test(f);
      });

      console.log(`   - Escaneando ${files.length} archivos en: ${path.relative(PROJECT_ROOT, source.dir)} (${source.tag})`);

      // Shuffle or evenly sample files to get diverse photos
      const step = Math.max(1, Math.floor(files.length / (source.max * 1.5)));
      const candidates = [];

      for (let i = 0; i < files.length && candidates.length < source.max; i += step) {
        const file = files[i];
        const filePath = path.join(source.dir, file);
        const meta = await isGoodImage(filePath);
        if (meta) {
          candidates.push({ file, filePath, meta });
        }
      }

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const idxStr = String(projectProcessed + 1).padStart(2, '0');
        const fileName = `${config.prefix}-${source.tag}-${idxStr}.webp`;
        const destPath = path.join(targetDir, fileName);

        try {
          const { origSize, newSize } = await processImage(candidate.filePath, destPath);
          totalOrigBytes += origSize;
          totalOptBytes += newSize;
          totalImagesProcessed++;
          projectProcessed++;

          const savedPct = Math.round(((origSize - newSize) / origSize) * 100);
          console.log(`     ✅ Guardado: ${fileName} | ${(origSize / 1024 / 1024).toFixed(2)}MB ➔ ${(newSize / 1024).toFixed(0)}KB (-${savedPct}%)`);
        } catch (err) {
          console.error(`     ❌ Error procesando ${candidate.file}:`, err.message);
        }
      }
    }

    console.log(`   ✨ Proyecto ${config.slug}: ${projectProcessed} imágenes curadas y optimizadas.\n`);
  }

  console.log('=====================================================');
  console.log(`🎉 COMPLETADO: ${totalImagesProcessed} imágenes procesadas y optimizadas`);
  console.log(`📦 Peso original: ${(totalOrigBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`⚡ Peso optimizado (WebP): ${(totalOptBytes / 1024 / 1024).toFixed(2)} MB`);
  const totalSaved = Math.round(((totalOrigBytes - totalOptBytes) / totalOrigBytes) * 100);
  console.log(`💪 Ahorro total de peso: ${totalSaved}%`);
  console.log('=====================================================\n');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
