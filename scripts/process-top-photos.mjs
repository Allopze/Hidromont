/**
 * Process photos from top/ folder for service pages.
 *
 * Phase 1: Optimize selected photos for service galleries → public/fotos/curadas/
 * Phase 2: Update cms-content.json with the resulting paths
 *
 * GAL-6: este script tenía una fase que escribía src/data/gallery.json
 * directamente. La galería de /galeria se administra desde el CMS y su JSON lo
 * regenera `npm run cms:export` desde SQLite, así que escribirlo por fuera
 * creaba dos fuentes de verdad — y la que perdía era la del CMS, que en el
 * siguiente export borraba silenciosamente todo lo que este script había
 * añadido. Para incorporar fotos nuevas a la galería: súbelas por el CMS, o
 * déjalas en public/fotos/ y corre `npm run cms:sync-media` para que el CMS
 * las vea.
 *
 * Run: node scripts/process-top-photos.mjs
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const ROOT = process.cwd();
const TOP = path.join(ROOT, 'top');
const CURADAS_DIR = path.join(ROOT, 'public', 'fotos', 'curadas');

// ─── Helpers ──────────────────────────────────────────────────────

function shortHash(filePath) {
  return createHash('md5').update(filePath).digest('hex').slice(0, 8);
}

/** Parse score from top/ filename format: RANK_SCORE_name.ext */
function parseScore(filename) {
  const m = filename.match(/^(\d+)_([\d.]+)_(.+)$/);
  if (!m) return { rank: 9999, score: 0, name: filename };
  return { rank: parseInt(m[1]), score: parseFloat(m[2]), name: m[3] };
}

/** Get top N photos from a folder, sorted by rank (lower = better). */
function getTopPhotos(folder, maxN) {
  if (!fs.existsSync(folder)) return [];
  const files = fs.readdirSync(folder)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f) && !f.startsWith('.'))
    .map(f => ({ file: f, ...parseScore(f) }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, maxN);
  return files.map(f => ({ path: path.join(folder, f.file), name: f.name, score: f.score }));
}

/** Optimize image to WebP with max width, return metadata. */
async function optimizeToWebp(srcPath, destPath, maxWidth = 1600) {
  const img = sharp(srcPath);
  const meta = await img.metadata();
  const w = Math.min(meta.width || 1600, maxWidth);
  await img
    .resize({ width: w, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(destPath);
  const outMeta = await sharp(destPath).metadata();
  return { width: outMeta.width, height: outMeta.height };
}

// ─── Phase 1: Service Gallery Photos ──────────────────────────────

/**
 * For each service, select and optimize photos from top/ and curadas.
 * Returns map of service slug → array of { src, alt } for cms-content.json.
 */
async function processServiceGalleryPhotos() {
  console.log('\n=== Phase 1: Service Gallery Photos ===\n');

  const servicePhotos = {};

  // Tuberías Forzadas — use existing curadas photos (different from hero)
  servicePhotos['tuberias-forzadas'] = [
    { src: '/fotos/curadas/bifurcacion-primer-taller.webp', alt: 'Fabricación de bifurcación en Y con refuerzos estructurales en taller Hidromont' },
    { src: '/fotos/curadas/fabricacion-tuberias-taller.webp', alt: 'Proceso de conformado y rolado de virolas de acero para tubería forzada' },
    { src: '/fotos/curadas/proyecto-tuberia-montana.webp', alt: 'Tubería forzada instalada en ladera de montaña para central hidroeléctrica' },
  ];

  // Compuertas — process from CH_Canal_Chacayes (bocatoma/compuerta) and Sifones
  const compuertaSrcs = [
    ...getTopPhotos(path.join(TOP, 'CH_Canal_Chacayes'), 2),
    ...getTopPhotos(path.join(TOP, 'CH_Sifones_BioBioSur'), 1),
  ];
  servicePhotos['compuertas'] = [];
  for (let i = 0; i < Math.min(3, compuertaSrcs.length); i++) {
    const src = compuertaSrcs[i];
    const destName = `compuertas-obra-${i + 1}.webp`;
    const destPath = path.join(CURADAS_DIR, destName);
    if (!fs.existsSync(destPath)) {
      console.log(`  Optimizing ${src.name} → ${destName}`);
      await optimizeToWebp(src.path, destPath, 1200);
    }
    const alts = [
      'Montaje de compuerta metálica en bocatoma de central hidroeléctrica',
      'Instalación de estructura de compuerta con grúa en obra hidráulica',
      'Compuerta radial en sifón para sistema de riego BioBío Sur',
    ];
    servicePhotos['compuertas'].push({ src: `/fotos/curadas/${destName}`, alt: alts[i] });
  }

  // Válvulas — use existing curadas + one from Los Condores
  const valvulaSrc = getTopPhotos(path.join(TOP, 'CH_Los_Condores'), 1);
  if (valvulaSrc.length > 0) {
    const destName = 'valvulas-montaje-condores.webp';
    const destPath = path.join(CURADAS_DIR, destName);
    if (!fs.existsSync(destPath)) {
      console.log(`  Optimizing ${valvulaSrc[0].name} → ${destName}`);
      await optimizeToWebp(valvulaSrc[0].path, destPath, 1200);
    }
  }
  servicePhotos['valvulas'] = [
    { src: '/fotos/curadas/valvulas.jpg', alt: 'Válvulas mariposa de gran diámetro para central hidroeléctrica' },
    { src: '/fotos/curadas/proyecto-valvula-tunel.jpg', alt: 'Válvula esférica instalada en galería subterránea de central' },
    { src: '/fotos/curadas/valvulas-montaje-condores.webp', alt: 'Montaje de válvula de guardia en caverna de C.H. Los Condores' },
  ];

  // Turbinas — process from Los Hierros (tiene soldadura en turbinas y virolas)
  const turbinaSrcs = getTopPhotos(path.join(TOP, 'CH_Los_Hierros'), 3);
  servicePhotos['turbinas'] = [];
  for (let i = 0; i < Math.min(3, turbinaSrcs.length); i++) {
    const src = turbinaSrcs[i];
    const destName = `turbinas-obra-${i + 1}.webp`;
    const destPath = path.join(CURADAS_DIR, destName);
    if (!fs.existsSync(destPath)) {
      console.log(`  Optimizing ${src.name} → ${destName}`);
      await optimizeToWebp(src.path, destPath, 1200);
    }
    const alts = [
      'Soldadura de virola de acero para carcasa de turbina en taller',
      'Fabricación de componente de turbina hidráulica de gran diámetro',
      'Proceso de calderería para equipo rotante de central hidroeléctrica',
    ];
    servicePhotos['turbinas'].push({ src: `/fotos/curadas/${destName}`, alt: alts[i] });
  }

  // Limpiarrejas — process from Pangal and Peuchen (obras de captación)
  const limpiarrejaSrcs = [
    ...getTopPhotos(path.join(TOP, 'CH_Pangal'), 2),
    ...getTopPhotos(path.join(TOP, 'CH_Peuchen_y_Mampil'), 1),
  ];
  servicePhotos['limpiarrejas'] = [];
  for (let i = 0; i < Math.min(3, limpiarrejaSrcs.length); i++) {
    const src = limpiarrejaSrcs[i];
    const destName = `limpiarrejas-obra-${i + 1}.webp`;
    const destPath = path.join(CURADAS_DIR, destName);
    if (!fs.existsSync(destPath)) {
      console.log(`  Optimizing ${src.name} → ${destName}`);
      await optimizeToWebp(src.path, destPath, 1200);
    }
    const alts = [
      'Montaje de sistema de captación con limpiarreja en C.H. Pangal',
      'Instalación de equipos de bocatoma y reja en obra hidroeléctrica',
      'Sistema limpiarrejas fabricado por Hidromont en operación en central',
    ];
    servicePhotos['limpiarrejas'].push({ src: `/fotos/curadas/${destName}`, alt: alts[i] });
  }

  // Otros Montajes — use existing curadas photos
  servicePhotos['otros-montajes'] = [
    { src: '/fotos/curadas/montaje-vertical-caverna.webp', alt: 'Montaje vertical de tubería forzada en caverna subterránea de gran profundidad' },
    { src: '/fotos/curadas/proyecto-montaje-tuberia.jpg', alt: 'Montaje de secciones de tubería de gran diámetro con grúa en obra' },
    { src: '/fotos/curadas/proyecto-bifurcacion-obra.jpg', alt: 'Bifurcación de tubería forzada instalada en obra de central hidroeléctrica' },
  ];

  console.log('\n  Service gallery photos ready:');
  for (const [slug, photos] of Object.entries(servicePhotos)) {
    console.log(`    ${slug}: ${photos.length} fotos`);
  }

  return servicePhotos;
}

// ─── Phase 3: Update CMS Content ──────────────────────────────────

function updateCmsContent(servicePhotos) {
  console.log('\n=== Phase 3: Update cms-content.json ===\n');

  const cmsPath = path.join(ROOT, 'src', 'data', 'cms-content.json');
  const cms = JSON.parse(fs.readFileSync(cmsPath, 'utf-8'));

  for (const [slug, photos] of Object.entries(servicePhotos)) {
    const entryKey = `service-gallery.${slug}`;
    const entry = cms.entries[entryKey];
    if (!entry) {
      console.log(`  ⚠ CMS entry ${entryKey} not found`);
      continue;
    }

    for (let i = 0; i < photos.length; i++) {
      const n = i + 1;
      entry.fields[`gallery${n}`] = { type: 'image', value: photos[i].src };
      entry.fields[`gallery${n}Alt`] = { type: 'text', value: photos[i].alt };
    }
    console.log(`  ✅ ${slug}: ${photos.length} gallery photos set`);
  }

  cms.updatedAt = new Date().toISOString();
  fs.writeFileSync(cmsPath, JSON.stringify(cms, null, 2) + '\n');
  console.log('\n  cms-content.json updated');
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('🖼  Processing top/ photos for Hidromont web\n');

  // Ensure output dirs exist
  fs.mkdirSync(CURADAS_DIR, { recursive: true });

  // Phase 1: Service gallery photos
  const servicePhotos = await processServiceGalleryPhotos();

  // Phase 2: Update CMS content
  updateCmsContent(servicePhotos);

  console.log('\n🎉 Done! Run `npm run build` to verify.\n');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
