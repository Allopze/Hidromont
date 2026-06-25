import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../config/unifiedConfig';

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

export class ImageService {
  private derivedDir: string;
  private derivedUrlBase = '/gallery/derived';

  constructor(rootDir: string = config.rootDir) {
    this.derivedDir = path.join(rootDir, 'public', 'gallery', 'derived');
  }

  /**
   * Generate responsive derivatives (WebP) for a single image.
   * Returns srcset string, lqip base64, and metadata for the largest derived.
   */
  async generateDerivatives(sourcePath: string): Promise<ImageDerivatives> {
    const absoluteSource = path.join(config.rootDir, 'public', sourcePath.startsWith('/') ? sourcePath.slice(1) : sourcePath);

    if (!fs.existsSync(absoluteSource)) {
      throw new Error(`Source image not found: ${absoluteSource}`);
    }

    fs.mkdirSync(this.derivedDir, { recursive: true });

    const hash = crypto.createHash('md5').update(sourcePath).digest('hex').slice(0, 8);
    const buffer = fs.readFileSync(absoluteSource);
    const metadata = await sharp(buffer).metadata();
    const originalWidth = metadata.width ?? 1600;
    const originalHeight = metadata.height ?? 1200;

    const srcsetParts: string[] = [];

    for (const w of WIDTHS) {
      if (w > originalWidth) continue;
      const filename = `${hash}-${w}.webp`;
      const outPath = path.join(this.derivedDir, filename);

      if (!fs.existsSync(outPath)) {
        await sharp(buffer)
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
    const lqipPath = path.join(this.derivedDir, lqipFilename);
    let lqipBase64: string;

    if (fs.existsSync(lqipPath)) {
      lqipBase64 = fs.readFileSync(lqipPath).toString('base64');
    } else {
      const lqipBuffer = await sharp(buffer)
        .resize(LQIP_WIDTH, undefined, { withoutEnlargement: true })
        .webp({ quality: LQIP_QUALITY })
        .toBuffer();
      fs.writeFileSync(lqipPath, lqipBuffer);
      lqipBase64 = lqipBuffer.toString('base64');
    }

    // Determine the src (largest derived or original)
    const largestDerived = srcsetParts[srcsetParts.length - 1];
    const largestSrc = largestDerived.split(' ')[0];

    // Get actual dimensions of the largest derived
    const largestPath = path.join(
      config.rootDir,
      'public',
      largestSrc.startsWith('/') ? largestSrc.slice(1) : largestSrc
    );
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
