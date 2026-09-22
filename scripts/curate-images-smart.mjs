import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PROJECT_ROOT = process.cwd();
const ORIGINALS_ROOT = path.join(PROJECT_ROOT, 'assets', 'originales');
const DEST_BASE = path.join(PROJECT_ROOT, 'public', 'fotos', 'proyectos');
const PREVIEW_HTML_PATH = path.join(PROJECT_ROOT, 'public', 'fotos', 'curacion-preview.html');

// Projects to analyze and curate
const PROJECTS_CONFIG = [
  {
    name: 'C.H. Pangal — Montaje Aéreo con Helicóptero',
    slug: 'ch-pangal-helicoptero',
    prefix: 'pangal-helico',
    maxOutput: 12,
    sources: [path.join(ORIGINALS_ROOT, 'Pangal', 'Helicóptero')],
  },
  {
    name: 'C.H. Pangal — Tuberías, Caverna y Terreno',
    slug: 'ch-pangal-terreno',
    prefix: 'pangal-obra',
    maxOutput: 16,
    sources: [path.join(ORIGINALS_ROOT, 'Pangal')],
  },
  {
    name: 'C.H. Canal Chacayes — Obras y Montaje Hidromecánico',
    slug: 'ch-chacayes',
    prefix: 'chacayes-obra',
    maxOutput: 16,
    sources: [
      path.join(ORIGINALS_ROOT, 'Canal Chacayes', '1'),
      path.join(ORIGINALS_ROOT, 'Canal Chacayes', '2'),
      path.join(ORIGINALS_ROOT, 'Canal Chacayes', '3'),
      path.join(ORIGINALS_ROOT, 'Canal Chacayes', '4'),
    ],
  },
];

/**
 * Computes image quality metrics using Sharp:
 * - Sharpness: Variance of Laplacian operator
 * - Contrast: Standard deviation of pixel intensities
 * - Brightness: Mean pixel intensity
 * - Saturation: Colorfulness (RGB standard deviation across channels)
 * - Aspect Ratio: Width / Height
 */
async function analyzeImage(filePath) {
  try {
    const meta = await sharp(filePath).metadata();
    if (!meta.width || !meta.height) return null;

    // Must be horizontal landscape aspect ratio suitable for web cards/heroes (e.g. 1.2 to 2.0)
    const aspectRatio = meta.width / meta.height;
    if (aspectRatio < 1.15 || aspectRatio > 2.2) return null;
    if (meta.width < 1200 || meta.height < 700) return null;

    // Extract grayscale raw pixels for sharpness and contrast
    const { data: grayData, info: grayInfo } = await sharp(filePath)
      .resize(400, 300, { fit: 'inside' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = grayInfo.width;
    const h = grayInfo.height;
    const totalPixels = grayData.length;

    let sum = 0;
    for (let i = 0; i < totalPixels; i++) sum += grayData[i];
    const mean = sum / totalPixels;

    let varSum = 0;
    for (let i = 0; i < totalPixels; i++) {
      const diff = grayData[i] - mean;
      varSum += diff * diff;
    }
    const contrast = Math.sqrt(varSum / totalPixels);

    // Laplacian variance (Sharpness metric)
    let lapSum = 0;
    let lapCount = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const val =
          4 * grayData[idx] -
          grayData[idx - 1] -
          grayData[idx + 1] -
          grayData[idx - w] -
          grayData[idx + w];
        lapSum += val * val;
        lapCount++;
      }
    }
    const sharpness = lapSum / lapCount;

    // Check color saturation (ensure it's not a paper document or monochrome white sheet)
    const { data: rgbData } = await sharp(filePath)
      .resize(200, 150, { fit: 'inside' })
      .toFormat('raw')
      .toBuffer({ resolveWithObject: true });

    const numRgbPixels = rgbData.length / 3;
    let colorVar = 0;
    for (let i = 0; i < rgbData.length; i += 3) {
      const r = rgbData[i],
        g = rgbData[i + 1],
        b = rgbData[i + 2];
      colorVar += Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
    }
    const colorScore = colorVar / numRgbPixels;

    // Rejection thresholds for quality:
    // 1. Sharpness must be >= 110 (filters blurry/out-of-focus photos)
    // 2. Contrast must be >= 45 (filters washed out foggy photos)
    // 3. Mean brightness between 45 and 215 (filters black or overexposed)
    // 4. Color score >= 12 (filters white paper document scans/spreadsheets)
    const isQualityPass =
      sharpness >= 110 && contrast >= 45 && mean >= 45 && mean <= 215 && colorScore >= 12;

    // Overall quality composite score (higher is better)
    const qualityScore = sharpness * 0.4 + contrast * 0.4 + colorScore * 0.2;

    return {
      filePath,
      fileName: path.basename(filePath),
      width: meta.width,
      height: meta.height,
      aspectRatio,
      mean,
      contrast,
      sharpness,
      colorScore,
      qualityScore,
      isQualityPass,
      origSize: fs.statSync(filePath).size,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Deduplicates bursts of photos (e.g. photos taken seconds apart) by keeping only the single best scored photo.
 */
function deduplicateBurstCandidates(candidates) {
  const sorted = [...candidates].sort((a, b) => b.qualityScore - a.qualityScore);
  const selected = [];

  for (const item of sorted) {
    // Check if we already have an item with similar brightness/contrast/filename timestamp
    const isDuplicate = selected.some((sel) => {
      const diffMean = Math.abs(sel.mean - item.mean);
      const diffContrast = Math.abs(sel.contrast - item.contrast);
      const diffSharpness = Math.abs(sel.sharpness - item.sharpness);
      return diffMean < 3 && diffContrast < 3 && diffSharpness < 15;
    });

    if (!isDuplicate) {
      selected.push(item);
    }
  }

  return selected;
}

async function convertToWebP(srcPath, destPath) {
  const meta = await sharp(srcPath).metadata();
  const pipeline = sharp(srcPath);

  if (meta.width > 1920 || meta.height > 1200) {
    pipeline.resize({
      width: 1920,
      height: 1200,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  await pipeline.webp({ quality: 84, effort: 4 }).toFile(destPath);

  return fs.statSync(destPath).size;
}

async function run() {
  console.log('🔬 INICIANDO ANÁLISIS DE CALIDAD VISUAL SMART...\n');

  if (fs.existsSync(DEST_BASE)) {
    fs.rmSync(DEST_BASE, { recursive: true, force: true });
  }

  let totalCurated = 0;
  let htmlCards = '';

  for (const proj of PROJECTS_CONFIG) {
    console.log(`📌 ANALIZANDO PROYECTO: ${proj.name}`);
    const projDestDir = path.join(DEST_BASE, proj.slug);
    fs.mkdirSync(projDestDir, { recursive: true });

    let rawCandidates = [];
    for (const srcDir of proj.sources) {
      if (!fs.existsSync(srcDir)) continue;
      const files = fs.readdirSync(srcDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
      console.log(
        `   - Evaluando ${files.length} imágenes en ${path.relative(PROJECT_ROOT, srcDir)}...`
      );

      for (const file of files) {
        const fp = path.join(srcDir, file);
        const analysis = await analyzeImage(fp);
        if (analysis && analysis.isQualityPass) {
          rawCandidates.push(analysis);
        }
      }
    }

    console.log(
      `   - Encontradas ${rawCandidates.length} imágenes que superan el umbral de nitidez y contraste.`
    );

    // Deduplicate similar shots and pick top distinct photos
    const deduplicated = deduplicateBurstCandidates(rawCandidates);
    const finalSelected = deduplicated.slice(0, proj.maxOutput);

    console.log(`   🏆 Seleccionadas las ${finalSelected.length} MEJORES fotografías para la web.`);

    let projIndex = 1;
    for (const item of finalSelected) {
      const idxStr = String(projIndex).padStart(2, '0');
      const webpName = `${proj.prefix}-${idxStr}.webp`;
      const destPath = path.join(projDestDir, webpName);

      const newSize = await convertToWebP(item.filePath, destPath);
      const relDestPath = path.relative(path.join(PROJECT_ROOT, 'public'), destPath);

      projIndex++;
      totalCurated++;

      // Create preview HTML card
      htmlCards += `
        <div class="card">
          <div class="img-wrapper">
            <img src="/${relDestPath}" alt="${webpName}" loading="lazy" />
            <span class="badge badge-success">Top Calidad</span>
          </div>
          <div class="card-body">
            <h3>${webpName}</h3>
            <p class="project-tag">${proj.name}</p>
            <div class="metrics">
              <span title="Nitidez Laplacian">🎯 Nitidez: <strong>${Math.round(item.sharpness)}</strong></span>
              <span title="Contraste">Contrast: <strong>${Math.round(item.contrast)}</strong></span>
              <span title="Brillo">Brillo: <strong>${Math.round(item.mean)}</strong></span>
              <span title="Color">Color: <strong>${Math.round(item.colorScore)}</strong></span>
            </div>
            <p class="size-info">Original: ${(item.origSize / 1024 / 1024).toFixed(2)} MB ➔ WebP: ${(newSize / 1024).toFixed(0)} KB</p>
          </div>
        </div>
      `;
    }

    console.log(
      `   ✅ Proyecto ${proj.slug} completado (${finalSelected.length} fotos curadas).\n`
    );
  }

  // Generate preview HTML file
  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Curaduría Visual de Fotografía — Hidromont Chile</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --accent: #10b981;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 2rem;
    }
    header {
      margin-bottom: 2rem;
      border-bottom: 1fr solid #334155;
      padding-bottom: 1rem;
    }
    h1 { margin: 0 0 0.5rem 0; color: var(--primary); }
    p { color: var(--text-muted); margin: 0; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }
    .card {
      background: var(--card-bg);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #334155;
      display: flex;
      flex-direction: column;
    }
    .img-wrapper {
      position: relative;
      aspect-ratio: 16/10;
      background: #000;
    }
    .img-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .badge {
      position: absolute;
      top: 10px;
      right: 10px;
      background: var(--accent);
      color: #000;
      font-weight: bold;
      font-size: 0.75rem;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .card-body {
      padding: 1rem;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .card-body h3 {
      font-size: 1rem;
      margin: 0 0 0.25rem 0;
      color: #fff;
    }
    .project-tag {
      font-size: 0.8rem;
      color: var(--primary);
      margin-bottom: 0.75rem;
    }
    .metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      font-size: 0.8rem;
      background: #0f172a;
      padding: 0.5rem;
      border-radius: 6px;
      margin-bottom: 0.75rem;
    }
    .size-info {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: auto;
    }
  </style>
</head>
<body>
  <header>
    <h1>Galería de Curaduría Visual — Hidromont Chile</h1>
    <p>Se procesaron y filtraron matemáticamente las fotos descartando borrosas, oscuras, descoloridas y duplicadas. Total seleccionadas: ${totalCurated} fotos de alta calidad.</p>
  </header>
  <main class="grid">
    ${htmlCards}
  </main>
</body>
</html>
  `;

  fs.writeFileSync(PREVIEW_HTML_PATH, htmlContent, 'utf-8');
  console.log(`🎉 COMPLETO: ${totalCurated} fotos de alta calidad seleccionadas y optimizadas.`);
  console.log(`📄 Vista previa interactiva generada en: public/fotos/curacion-preview.html`);
}

run().catch(console.error);
