import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config, resolvePublicAssetPath } from '../config/unifiedConfig';

export interface DerivedImage {
  src: string;
  width: number;
  height: number;
}

export interface ImageDerivatives {
  src: string;
  width: number;
  height: number;
  srcset: string;
  lqip: string;
}

const WIDTHS = [640, 1024, 1600];
const LQIP_WIDTH = 32;
const LQIP_QUALITY = 40;
// CMS-L8: see mediaService.ts — explicit bound, defense-in-depth against
// decompression-bomb-style inputs regardless of sharp's own default.
const MAX_INPUT_PIXELS = 50_000_000;

export class ImageService {
  private derivedDir: string;
  private derivedUrlBase = '/gallery/derived';
  /**
   * El LQIP no se sirve nunca: viaja incrustado como data URI en
   * `gallery.json`, y el archivo en disco solo evita recalcularlo. Vivía en
   * `public/gallery/derived/` junto a los candidatos del srcset, así que Astro
   * copiaba a `dist/` 221 archivos —884 KB— que ninguna página pide. Se aparta
   * fuera de `public/`, donde el build no lo ve.
   *
   * Perderlo no tiene consecuencia: regenerarlo da el mismo byte —comprobado
   * borrando varios y reexportando, con `gallery.json` idéntico—, así que en
   * un clon nuevo la primera exportación lo reconstruye.
   */
  private lqipCacheDir: string;

  constructor(rootDir: string = config.rootDir) {
    this.derivedDir = path.join(rootDir, 'public', 'gallery', 'derived');
    this.lqipCacheDir = path.join(rootDir, 'cms', 'data', 'lqip-cache');
  }

  /**
   * Generate responsive derivatives (WebP) for a single image.
   * Returns srcset string, lqip base64, and metadata for the largest derived.
   */
  async generateDerivatives(sourcePath: string): Promise<ImageDerivatives> {
    const absoluteSource = resolvePublicAssetPath(sourcePath);

    if (!fs.existsSync(absoluteSource)) {
      throw new Error(`Source image not found: ${absoluteSource}`);
    }

    fs.mkdirSync(this.derivedDir, { recursive: true });

    const buffer = fs.readFileSync(absoluteSource);
    // CMS-M10 fix: hash the actual bytes, not the public path. Assets synced
    // from public/fotos|logos-clientes (unlike CMS uploads, which always get a
    // unique nanoid'd filename) can have their content replaced at the same
    // path — a path-based hash would keep serving the old derivatives forever
    // since `fs.existsSync(outPath)` below would find the stale file already
    // there under the unchanged hash.
    const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 8);
    const metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    const originalWidth = metadata.width ?? 1600;
    const originalHeight = metadata.height ?? 1200;

    const srcsetParts: string[] = [];

    for (const w of WIDTHS) {
      if (w > originalWidth) continue;
      const filename = `${hash}-${w}.webp`;
      const outPath = path.join(this.derivedDir, filename);

      if (!fs.existsSync(outPath)) {
        await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
          .resize(w, undefined, { withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(outPath);
      }

      const derivedMeta = await sharp(outPath).metadata();
      srcsetParts.push(`${this.derivedUrlBase}/${filename} ${derivedMeta.width}w`);
    }

    // If no derivatives were generated (image smaller than smallest width), use original
    if (srcsetParts.length === 0) {
      srcsetParts.push(`${sourcePath} ${originalWidth}w`);
    }

    // Generate LQIP
    const lqipFilename = `${hash}-lqip.webp`;
    const lqipPath = path.join(this.lqipCacheDir, lqipFilename);
    let lqipBase64: string;

    if (fs.existsSync(lqipPath)) {
      lqipBase64 = fs.readFileSync(lqipPath).toString('base64');
    } else {
      const lqipBuffer = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
        .resize(LQIP_WIDTH, undefined, { withoutEnlargement: true })
        .webp({ quality: LQIP_QUALITY })
        .toBuffer();
      fs.mkdirSync(this.lqipCacheDir, { recursive: true });
      fs.writeFileSync(lqipPath, lqipBuffer);
      lqipBase64 = lqipBuffer.toString('base64');
    }

    // Determine the src (largest derived or original)
    const largestDerived = srcsetParts[srcsetParts.length - 1];
    const largestSrc = largestDerived.split(' ')[0];

    // Get actual dimensions of the largest derived
    const largestPath = resolvePublicAssetPath(largestSrc);
    const largestMeta = fs.existsSync(largestPath)
      ? await sharp(largestPath).metadata()
      : { width: originalWidth, height: originalHeight };

    return {
      src: largestSrc,
      width: largestMeta.width ?? originalWidth,
      height: largestMeta.height ?? originalHeight,
      srcset: srcsetParts.join(', '),
      lqip: `data:image/webp;base64,${lqipBase64}`,
    };
  }
}
