import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { config } from '../config/unifiedConfig';
import type { MediaRepository } from '../repositories/MediaRepository';

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);
// SVG is allowed for catalog sync of existing assets but blocked for user uploads
// to avoid stored-XSS via embedded <script> or event handlers without a sanitizer.
const allowedUploadMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
const publicMediaRoots = ['fotos', 'logos-clientes', path.join('uploads', 'cms')];

// CMS-L8: sharp already defaults to a bounded limitInputPixels, but pinning it
// explicitly here documents the intent and doesn't depend on that default
// staying the same across sharp versions. ~50MP is generous for any real
// photo while still bounding decompression-bomb-style memory use.
const MAX_INPUT_PIXELS = 50_000_000;

function mimeFromExt(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return undefined;
}

function safeFilename(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const base = path
    .basename(name, ext)
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${base || 'imagen'}-${nanoid(8)}${ext}`;
}

export class MediaService {
  constructor(private readonly mediaRepository: MediaRepository) {}

  listMedia(limit = 100, offset = 0, q?: string) {
    return this.mediaRepository.list(limit, offset, q);
  }

  getMediaWithUsages(id: string) {
    const asset = this.mediaRepository.find(id);
    if (!asset) throw new Error(`Media asset ${id} no encontrado`);
    const usages = this.mediaRepository.getUsages(id);
    return { ...asset, usages };
  }

  async syncPublicMedia(): Promise<{ imported: number; orphaned: string[] }> {
    let imported = 0;
    for (const root of publicMediaRoots) {
      const directory = path.join(config.rootDir, 'public', root);
      if (!fs.existsSync(directory)) continue;
      const files = this.walkFiles(directory);
      for (const filePath of files) {
        const mime = mimeFromExt(filePath);
        if (!mime || !allowedMime.has(mime)) continue;

        const publicPath = `/${path.relative(path.join(config.rootDir, 'public'), filePath).split(path.sep).join('/')}`;
        const existing = this.mediaRepository.findByPath(publicPath);
        if (existing) continue;

        const buffer = fs.readFileSync(filePath);
        let metadata: { width?: number; height?: number } | undefined;
        if (mime !== 'image/svg+xml') {
          try {
            const meta = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
            metadata = { width: meta.width, height: meta.height };
          } catch {
            metadata = undefined;
          }
        }
        const now = new Date().toISOString();
        this.mediaRepository.upsertByPath({
          id: nanoid(),
          name: path.basename(filePath),
          path: publicPath,
          mime,
          width: metadata?.width,
          height: metadata?.height,
          size: buffer.byteLength,
          alt: path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, ' '),
          focalX: 0.5,
          focalY: 0.5,
          checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
          createdAt: now,
          updatedAt: now,
        });
        imported += 1;
      }
    }

    // A1-012: detección de media huerfano. Un media_asset puede apuntar a un archivo
    // que fue borrado de disco fuera del CMS (p. ej. limpieza manual, git pull sin
    // assets). No lo borramos automaticamente (podria estar en uso por items de
    // galería); lo reportamos para que el operador decida.
    const orphaned = this.detectOrphanedMedia();
    if (orphaned.length > 0) {
      process.stderr.write(
        `[CMS] ADVERTENCIA: ${orphaned.length} media asset(s) referencian archivos que ya no existen en disco:\n` +
          orphaned
            .slice(0, 10)
            .map((p) => `  - ${p}`)
            .join('\n') +
          (orphaned.length > 10 ? `\n  ... y ${orphaned.length - 10} más` : '') +
          '\n[CMS] Revise la biblioteca de medios y reasigne o elimine según corresponda.\n'
      );
    }

    return { imported, orphaned };
  }

  /**
   * A1-012: retorna los paths públicos de media_assets cuyo archivo físico ya no
   * existe en disco. No muta la DB; sólo reporta para que el operador actúe.
   */
  private detectOrphanedMedia(): string[] {
    const { items: all } = this.mediaRepository.list(100000, 0);
    const orphaned: string[] = [];
    for (const asset of all) {
      // Sólo verificar assets de los roots públicos (no uploads huérfanos de otros origenes).
      const localPath = path.join(config.rootDir, 'public', asset.path);
      if (!fs.existsSync(localPath)) {
        orphaned.push(`${asset.path} (${asset.name})`);
      }
    }
    return orphaned;
  }

  async createMedia(input: { filename: string; mime: string; buffer: Buffer; alt?: string }) {
    if (!allowedUploadMime.has(input.mime))
      throw new Error('Tipo de archivo no permitido. Solo se aceptan JPEG, PNG y WebP.');
    if (input.buffer.byteLength > config.cms.uploadMaxBytes)
      throw new Error('Archivo demasiado grande');

    // Verify MIME matches actual file extension to catch spoofed uploads.
    // CMS-6: reject filenames with no recognized extension outright instead of
    // silently skipping this check — a spoofed upload could otherwise use an
    // extensionless/unknown-extension filename to bypass it entirely.
    const declaredMime = mimeFromExt(input.filename);
    if (!declaredMime)
      throw new Error('El archivo debe tener una extensión reconocida (.jpg, .jpeg, .png, .webp)');
    if (declaredMime !== input.mime)
      throw new Error('El tipo MIME no coincide con la extensión del archivo');

    // CMS-6: validate the bytes are actually a decodable image BEFORE writing
    // anything to disk. Previously this wrote the file first and validated
    // after, leaving an orphaned file (no DB row, never cleaned up) on every
    // upload of undecodable bytes with a spoofed-but-matching MIME/extension.
    const metadata =
      input.mime === 'image/svg+xml'
        ? undefined
        : await sharp(input.buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();

    fs.mkdirSync(config.cms.uploadDir, { recursive: true });

    const name = safeFilename(input.filename);
    const fullPath = path.join(config.cms.uploadDir, name);
    const publicPath = `${config.cms.publicUploadBase}/${name}`;

    if (!fullPath.startsWith(config.cms.uploadDir)) throw new Error('Ruta de archivo inválida');

    fs.writeFileSync(fullPath, input.buffer);

    const checksum = crypto.createHash('sha256').update(input.buffer).digest('hex');
    const now = new Date().toISOString();

    try {
      return this.mediaRepository.create({
        id: nanoid(),
        name,
        path: publicPath,
        mime: input.mime,
        width: metadata?.width,
        height: metadata?.height,
        size: input.buffer.byteLength,
        alt: input.alt,
        focalX: 0.5,
        focalY: 0.5,
        checksum,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      // CMS-6: don't leave an orphaned file if the DB insert fails.
      fs.unlinkSync(fullPath);
      throw error;
    }
  }

  updateMedia(input: { id: string; alt?: string; focalX?: number; focalY?: number }) {
    return this.mediaRepository.update({
      ...input,
      now: new Date().toISOString(),
    });
  }

  /**
   * Elimina un media asset. Antes de borrar, reporta cuantos items de galeria quedaran
   * huerfanos (media_id -> NULL tras el ON DELETE SET NULL, ver A1-004). El caller
   * puede usar este recuento para advertir al usuario en la UI.
   */
  deleteMedia(id: string): { orphanedGalleryItems: number } {
    const asset = this.mediaRepository.find(id);
    if (!asset) throw new Error(`Media asset ${id} no encontrado`);

    // Contar items de galeria que referencian este media ANTES de borrarlo.
    // FK ON DELETE SET NULL los dejara con media_id=NULL (no se pierden).
    const orphanedGalleryItems = this.mediaRepository.countGalleryItemsByMedia(id);

    // Sólo eliminar del disco si fue subido a través del CMS (uploads/cms)
    if (asset.path.startsWith(config.cms.publicUploadBase)) {
      const fullPath = path.join(config.rootDir, 'public', asset.path);
      const canonPath = path.resolve(fullPath);
      const uploadDir = path.resolve(config.cms.uploadDir);
      if (canonPath.startsWith(uploadDir) && fs.existsSync(canonPath)) {
        fs.unlinkSync(canonPath);
      }
    }

    this.mediaRepository.delete(id);
    return { orphanedGalleryItems };
  }

  findMedia(id: string) {
    return this.mediaRepository.find(id);
  }

  private walkFiles(directory: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return this.walkFiles(fullPath);
      if (entry.isFile()) return [fullPath];
      return [];
    });
  }
}
