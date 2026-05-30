/**
 * Genera activos de imagen faltantes y convierte PNGs pesados a WebP.
 * Ejecutar: node scripts/generate-images.mjs
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

// ── 1. OG image por defecto (1200×630) ──────────────────────────────────────
async function generateOgImage() {
  const outPath = path.join(PUBLIC, 'og', 'og-default.jpg');
  if (fs.existsSync(outPath)) {
    console.log('⏭  og-default.jpg ya existe, saltando.');
    return;
  }

  const W = 1200, H = 630;

  // Cargamos el logo y lo escalamos a 320px de ancho
  const logoPath = path.join(PUBLIC, 'logo.png');
  const logoBuffer = await sharp(logoPath)
    .resize({ width: 320, withoutEnlargement: true })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logoBuffer).metadata();
  const logoH = logoMeta.height ?? 100;

  // SVG de fondo con gradiente y tipografía
  const svgBg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F2433"/>
      <stop offset="60%" stop-color="#003D66"/>
      <stop offset="100%" stop-color="#0065A9"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- Grid técnico sutil -->
  <rect width="${W}" height="${H}" fill="none"
    style="background-image:linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);background-size:60px 60px;"/>
  <!-- Separador de logo y texto -->
  <rect x="60" y="${Math.round(H / 2) + 20}" width="56" height="3" rx="1.5" fill="#00A6D6"/>
  <!-- Eslogan -->
  <text x="60" y="${Math.round(H / 2) + 70}" font-family="Arial,Helvetica,sans-serif" font-size="22"
    fill="rgba(255,255,255,0.65)">Ingeniería · Fabricación · Montaje de equipos hidromecánicos</text>
  <!-- Año -->
  <text x="60" y="${H - 48}" font-family="Arial,Helvetica,sans-serif" font-size="16"
    fill="rgba(255,255,255,0.35)">Desde 1983 · Los Ángeles, Chile · hidromont.cl</text>
</svg>`;

  const base = await sharp(Buffer.from(svgBg)).png().toBuffer();

  const logoLeft = 60;
  const logoTop = Math.round(H / 2) - logoH - 30;

  await sharp(base)
    .composite([{ input: logoBuffer, left: logoLeft, top: Math.max(logoTop, 40) }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(outPath);

  const { size } = fs.statSync(outPath);
  console.log(`✅  og-default.jpg creado (${Math.round(size / 1024)} KB)`);
}

// ── 2. Apple Touch Icon (180×180) ───────────────────────────────────────────
async function generateAppleTouchIcon() {
  const outPath = path.join(PUBLIC, 'apple-touch-icon.png');
  if (fs.existsSync(outPath)) {
    console.log('⏭  apple-touch-icon.png ya existe, saltando.');
    return;
  }

  const logoPath = path.join(PUBLIC, 'logo.png');
  const logoMeta = await sharp(logoPath).metadata();
  const isLandscape = (logoMeta.width ?? 1) > (logoMeta.height ?? 1);

  // Fondo azul corporativo 180×180 con el logo encuadrado
  const BG = 180;
  const logoPad = 20; // padding interior
  const logoFit = BG - logoPad * 2;

  const logoResized = await sharp(logoPath)
    .resize({
      width: isLandscape ? logoFit : undefined,
      height: isLandscape ? undefined : logoFit,
      fit: 'inside',
    })
    .png()
    .toBuffer();

  const lMeta = await sharp(logoResized).metadata();
  const lW = lMeta.width ?? logoFit;
  const lH = lMeta.height ?? logoFit;

  const left = Math.round((BG - lW) / 2);
  const top  = Math.round((BG - lH) / 2);

  const bgSvg = `<svg width="${BG}" height="${BG}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${BG}" height="${BG}" rx="22" fill="#0065A9"/>
  </svg>`;

  await sharp(Buffer.from(bgSvg))
    .png()
    .composite([{ input: logoResized, left, top }])
    .toFile(outPath);

  const { size } = fs.statSync(outPath);
  console.log(`✅  apple-touch-icon.png creado (${Math.round(size / 1024)} KB)`);
}

// ── 3. Convertir PNGs pesados a WebP ────────────────────────────────────────
const PNG_TO_CONVERT = [
  'fotos/curadas/empresa-taller.png',
  'fotos/curadas/proyecto-tuberia-montana.png',
  'fotos/curadas/taller-aereo.png',
];

async function convertPngsToWebp() {
  for (const rel of PNG_TO_CONVERT) {
    const srcPath = path.join(PUBLIC, rel);
    const outPath = srcPath.replace(/\.png$/, '.webp');

    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠️  No encontrado: ${rel}`);
      continue;
    }
    if (fs.existsSync(outPath)) {
      console.log(`⏭  ${path.basename(outPath)} ya existe, saltando.`);
      continue;
    }

    const { size: origSize } = fs.statSync(srcPath);
    await sharp(srcPath)
      .webp({ quality: 82, effort: 6 })
      .toFile(outPath);

    const { size: newSize } = fs.statSync(outPath);
    const pct = Math.round((1 - newSize / origSize) * 100);
    console.log(`✅  ${path.basename(outPath)} — ${Math.round(origSize / 1024)} KB → ${Math.round(newSize / 1024)} KB (−${pct}%)`);
  }
}

// ── 4. Optimizar logo.png (JSON-LD) ─────────────────────────────────────────
async function optimizeLogo() {
  const logoPath = path.join(PUBLIC, 'logo.png');
  const { size: origSize } = fs.statSync(logoPath);
  if (origSize < 200_000) {
    console.log('⏭  logo.png ya está optimizado.');
    return;
  }
  const tmpPath = logoPath + '.tmp.png';
  const meta = await sharp(logoPath).metadata();
  const targetW = Math.min(meta.width ?? 800, 800);

  await sharp(logoPath)
    .resize({ width: targetW, withoutEnlargement: true })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(tmpPath);

  const { size: newSize } = fs.statSync(tmpPath);
  if (newSize < origSize) {
    fs.renameSync(tmpPath, logoPath);
    const pct = Math.round((1 - newSize / origSize) * 100);
    console.log(`✅  logo.png optimizado: ${Math.round(origSize / 1024)} KB → ${Math.round(newSize / 1024)} KB (−${pct}%)`);
  } else {
    fs.unlinkSync(tmpPath);
    console.log('⏭  logo.png ya es óptimo para su tamaño.');
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await generateOgImage();
    await generateAppleTouchIcon();
    await convertPngsToWebp();
    await optimizeLogo();
    console.log('\nListo.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
